import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizeInvoiceRows, NormalizedInvoice } from '@/lib/invoice-normalizer'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import Anthropic from '@anthropic-ai/sdk'
import type { DocumentBlockParam } from '@anthropic-ai/sdk/resources/messages/messages'

/**
 * Find an existing customer by name, or insert a new one.
 * Does NOT rely on a UNIQUE constraint — uses SELECT-first, INSERT-if-missing.
 */
async function upsertCustomer(supabase: ReturnType<typeof createServiceClient>, name: string) {
  const trimmed = name.trim()
  if (!trimmed) return undefined

  // 1. Try to find existing
  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .ilike('name', trimmed)   // case-insensitive match
    .maybeSingle()
  if (existing?.id) return existing.id as string

  // 2. Insert new
  const { data: inserted, error } = await supabase
    .from('customers')
    .insert({ name: trimmed })
    .select('id')
    .single()
  if (error) console.error('[upsertCustomer]', error.message)
  return inserted?.id as string | undefined
}

/**
 * Find an existing supplier by name, or insert a new one.
 */
async function upsertSupplier(supabase: ReturnType<typeof createServiceClient>, name: string) {
  const trimmed = name.trim()
  if (!trimmed) return undefined

  const { data: existing } = await supabase
    .from('suppliers')
    .select('id')
    .ilike('name', trimmed)
    .maybeSingle()
  if (existing?.id) return existing.id as string

  const { data: inserted, error } = await supabase
    .from('suppliers')
    .insert({ name: trimmed })
    .select('id')
    .single()
  if (error) console.error('[upsertSupplier]', error.message)
  return inserted?.id as string | undefined
}

async function insertInvoice(
  supabase: ReturnType<typeof createServiceClient>,
  inv: NormalizedInvoice,
  customerId?: string,
  supplierId?: string
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('invoices')
    .upsert(
      {
        invoice_number: inv.invoice_number,
        invoice_type: inv.invoice_type,
        customer_id: customerId ?? null,
        supplier_id: supplierId ?? null,
        invoice_date: inv.invoice_date,
        due_date: inv.due_date ?? null,
        subtotal: inv.subtotal,
        tax_amount: inv.tax_amount,
        total_amount: inv.total_amount,
        status: inv.status,
        currency: inv.currency,
        notes: inv.notes ?? null,
      },
      { onConflict: 'invoice_number,invoice_type', ignoreDuplicates: false, defaultToNull: false }
    )
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return data
}

/**
 * Send the raw PDF bytes directly to Claude as a base64-encoded document.
 * No PDF parsing library needed — Claude reads the PDF natively.
 */
async function extractInvoicesFromPdf(pdfBuffer: Buffer): Promise<NormalizedInvoice[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const base64Pdf = pdfBuffer.toString('base64')

  const PROMPT = `You are an expert at extracting structured data from Indian GST tax invoices. Extract ALL invoice data from this PDF and return a valid JSON array.

ROLE IDENTIFICATION (critical for Indian invoices):
- The company printed at the TOP / in the header = SUPPLIER (the issuer / seller)
- The section labeled "Buyer", "Bill To", "Consignee", or "To" = CUSTOMER (the receiver / buyer)
- ALWAYS extract BOTH supplier_name AND customer_name when both appear on the invoice.
- invoice_type = "sales"    → when a clear Buyer section exists (standard B2B tax invoice)
- invoice_type = "purchase" → only if labeled as Purchase Order or no buyer is identified

TAX FIELDS (Indian GST):
- tax_amount = CGST + SGST + IGST combined (not just one component)
- subtotal   = taxable value / amount before tax
- total_amount = subtotal + tax_amount

Return a JSON array where each element has EXACTLY these fields:
{
  "invoice_number": string,         // e.g. "RDPL/227/24-25"; use "UNKNOWN-1" only if truly absent
  "invoice_type": "sales" | "purchase",
  "customer_name": string | undefined,  // full legal name of the BUYER
  "supplier_name": string | undefined,  // full legal name of the SELLER / issuer
  "invoice_date": string,           // YYYY-MM-DD
  "due_date": string | undefined,   // YYYY-MM-DD if mentioned
  "total_amount": number,           // grand total including tax, no symbols or commas
  "tax_amount": number,             // total GST (CGST+SGST or IGST); 0 if not present
  "subtotal": number,               // taxable amount before GST
  "currency": "INR",                // always INR for Indian invoices
  "status": "pending" | "paid" | "overdue" | "cancelled",  // default "pending"
  "notes": string | undefined,      // payment terms, work order refs, etc.
  "line_items": [
    {
      "description": string,        // service / product description
      "quantity": number,           // default 1 if not stated
      "unit_price": number,         // price per unit before tax
      "total_price": number,        // line total before tax
      "tax_rate": number            // GST % on this line (e.g. 18); 0 if not stated
    }
  ]
}

STRICT OUTPUT RULES:
- Return ONLY a raw JSON array — absolutely no markdown fences, no prose, no explanation.
- Numbers must be plain numerics: 200000 not "2,00,000" or "₹2,00,000".
- Dates must be YYYY-MM-DD: "2025-02-12" not "12-Feb-2025".
- If no invoice data is found at all, return [].
- If the PDF has multiple invoices, return all of them as separate array elements.`

  const message = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Pdf,
            },
          } as DocumentBlockParam,
          {
            type: 'text',
            text: PROMPT,
          },
        ],
      },
    ],
  })

  const raw = message.content[0]
  if (raw.type !== 'text') throw new Error('Unexpected AI response type')

  // Strip accidental markdown code fences
  const cleaned = raw.text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('Claude returned malformed JSON. Please try again.')
  }

  if (!Array.isArray(parsed)) throw new Error('Expected a JSON array from AI extraction.')
  return parsed as NormalizedInvoice[]
}

export async function POST(request: NextRequest) {
  const supabase = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const filename = file.name
  const ext = filename.split('.').pop()?.toLowerCase()

  if (!['csv', 'xlsx', 'xls', 'pdf'].includes(ext ?? '')) {
    return NextResponse.json({ error: 'Only CSV, Excel, and PDF files are supported' }, { status: 400 })
  }

  // Create upload log
  const { data: logEntry } = await supabase
    .from('upload_logs')
    .insert({ filename, user_id: user.id, status: 'processing' })
    .select('id')
    .single()

  const logId = logEntry?.id

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    let normalized: NormalizedInvoice[] = []
    let rowCount = 0
    const extractionErrors: { row: number; reason: string }[] = []

    if (ext === 'pdf') {
      // ── PDF path: send raw PDF to Claude, get structured invoices back ──
      if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json(
          { error: 'PDF parsing requires ANTHROPIC_API_KEY to be configured.' },
          { status: 500 }
        )
      }

      normalized = await extractInvoicesFromPdf(buffer)
      rowCount = normalized.length

      if (rowCount === 0) {
        return NextResponse.json({ error: 'No invoice data found in this PDF.' }, { status: 400 })
      }
    } else {
      // ── CSV / XLSX path ──
      let rows: Record<string, unknown>[] = []

      if (ext === 'csv') {
        const text = buffer.toString('utf-8')
        const result = Papa.parse<Record<string, unknown>>(text, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
        })
        rows = result.data
      } else {
        const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      }

      if (rows.length === 0) {
        if (logId) {
          await supabase
            .from('upload_logs')
            .update({ status: 'failed', errors: [{ reason: 'File is empty' }] })
            .eq('id', logId)
        }
        return NextResponse.json({ error: 'File contains no data rows' }, { status: 400 })
      }

      rowCount = rows.length
      const { success, errors } = normalizeInvoiceRows(rows)
      normalized = success
      extractionErrors.push(...errors.map(e => ({ row: e.row, reason: e.reason })))
    }

    // ── Insert all normalized invoices into the database ──
    let processed = 0
    const insertErrors: { row: number; reason: string }[] = [...extractionErrors]

    for (const inv of normalized) {
      try {
        let customerId: string | undefined
        let supplierId: string | undefined

        if (inv.customer_name) customerId = await upsertCustomer(supabase, inv.customer_name)
        if (inv.supplier_name) supplierId = await upsertSupplier(supabase, inv.supplier_name)

        const invoiceRecord = await insertInvoice(supabase, inv, customerId, supplierId)

        if (invoiceRecord && inv.line_items.length > 0) {
          await supabase.from('invoice_line_items').upsert(
            inv.line_items.map(item => ({
              invoice_id: invoiceRecord.id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              tax_rate: item.tax_rate,
              total_price: item.total_price,
            }))
          )
        }

        processed++
      } catch (err) {
        insertErrors.push({ row: -1, reason: `Invoice ${inv.invoice_number}: ${String(err)}` })
      }
    }

    if (logId) {
      await supabase
        .from('upload_logs')
        .update({
          total_rows: rowCount,
          processed_rows: processed,
          failed_rows: rowCount - processed,
          errors: insertErrors,
          status: 'completed',
        })
        .eq('id', logId)
    }

    return NextResponse.json({
      total: rowCount,
      processed,
      failed: rowCount - processed,
      errors: insertErrors,
    })
  } catch (err) {
    if (logId) {
      await supabase
        .from('upload_logs')
        .update({ status: 'failed', errors: [{ reason: String(err) }] })
        .eq('id', logId)
    }
    return NextResponse.json({ error: 'Processing failed: ' + String(err) }, { status: 500 })
  }
}
