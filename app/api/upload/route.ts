import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizeInvoiceRows, NormalizedInvoice } from '@/lib/invoice-normalizer'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

async function upsertCustomer(supabase: ReturnType<typeof createServiceClient>, name: string) {
  const { data } = await supabase
    .from('customers')
    .upsert({ name }, { onConflict: 'name', ignoreDuplicates: false })
    .select('id')
    .single()
  if (data) return data.id

  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('name', name)
    .single()
  return existing?.id
}

async function upsertSupplier(supabase: ReturnType<typeof createServiceClient>, name: string) {
  const { data } = await supabase
    .from('suppliers')
    .upsert({ name }, { onConflict: 'name', ignoreDuplicates: false })
    .select('id')
    .single()
  if (data) return data.id

  const { data: existing } = await supabase
    .from('suppliers')
    .select('id')
    .eq('name', name)
    .single()
  return existing?.id
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
      { onConflict: 'invoice_number,invoice_type', ignoreDuplicates: false }
    )
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return data
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

  if (!['csv', 'xlsx', 'xls'].includes(ext ?? '')) {
    return NextResponse.json({ error: 'Only CSV and Excel files are supported' }, { status: 400 })
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

    const { success: normalized, errors } = normalizeInvoiceRows(rows)

    let processed = 0
    const insertErrors: { row: number; reason: string }[] = errors.map(e => ({ row: e.row, reason: e.reason }))

    for (const inv of normalized) {
      try {
        let customerId: string | undefined
        let supplierId: string | undefined

        if (inv.customer_name) {
          customerId = await upsertCustomer(supabase, inv.customer_name)
        }
        if (inv.supplier_name) {
          supplierId = await upsertSupplier(supabase, inv.supplier_name)
        }

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
          total_rows: rows.length,
          processed_rows: processed,
          failed_rows: rows.length - processed,
          errors: insertErrors,
          status: 'completed',
        })
        .eq('id', logId)
    }

    return NextResponse.json({
      total: rows.length,
      processed,
      failed: rows.length - processed,
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
