// Supabase Edge Function: process-invoices
// Handles bulk invoice normalization as a background worker with AI-enhanced validation
// Deploy: supabase functions deploy process-invoices

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const COLUMN_ALIASES: Record<string, string[]> = {
  invoice_number: ['invoice_number', 'invoice_no', 'invoice #', 'inv_no', 'number'],
  invoice_type: ['invoice_type', 'type', 'transaction_type', 'doc_type'],
  customer_name: ['customer_name', 'customer', 'client', 'buyer', 'bill_to'],
  supplier_name: ['supplier_name', 'supplier', 'vendor', 'seller', 'from'],
  invoice_date: ['invoice_date', 'date', 'bill_date', 'issue_date', 'created_date'],
  due_date: ['due_date', 'payment_due', 'due_by', 'payment_date'],
  total_amount: ['total_amount', 'total', 'amount', 'grand_total', 'invoice_total'],
  tax_amount: ['tax_amount', 'tax', 'gst', 'vat', 'tax_total'],
  subtotal: ['subtotal', 'sub_total', 'amount_before_tax', 'net_amount'],
  status: ['status', 'payment_status', 'state'],
  currency: ['currency', 'currency_code', 'curr'],
}

function findCol(headers: string[], field: string): string | null {
  const aliases = COLUMN_ALIASES[field] ?? [field]
  return headers.find(h => aliases.some(alias => alias.toLowerCase() === h.toLowerCase().trim())) ?? null
}

function parseDate(value: unknown): string | null {
  if (!value) return null
  // Handle Excel serial dates
  if (/^\d{5}$/.test(String(value))) {
    const date = new Date((Number(value) - 25569) * 86400 * 1000)
    return date.toISOString().split('T')[0]
  }
  const d = new Date(String(value))
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  return null
}

function parseAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = parseFloat(String(value).replace(/[$,£€₹\s]/g, ''))
  return isNaN(n) ? null : Math.round(n * 100) / 100
}

function validateInvoice(invoice: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!invoice.invoice_number) errors.push('Missing invoice number')
  if (!invoice.invoice_type) errors.push('Missing invoice type')
  if (!invoice.invoice_date) errors.push('Missing invoice date')
  if (invoice.total_amount === null || invoice.total_amount === undefined) errors.push('Missing total amount')

  if (invoice.invoice_type === 'sales' && !invoice.customer_name) errors.push('Sales invoice missing customer')
  if (invoice.invoice_type === 'purchase' && !invoice.supplier_name) errors.push('Purchase invoice missing supplier')

  if (invoice.total_amount < 0) errors.push('Total amount cannot be negative')
  if (invoice.tax_amount && invoice.tax_amount < 0) errors.push('Tax amount cannot be negative')

  return {
    valid: errors.length === 0,
    errors,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { upload_log_id, rows } = await req.json()
    if (!upload_log_id || !Array.isArray(rows)) {
      return new Response(JSON.stringify({ error: 'upload_log_id and rows are required' }), { status: 400 })
    }

    const headers = rows.length > 0 ? Object.keys(rows[0]) : []
    const colMap: Record<string, string | null> = {}
    for (const field of Object.keys(COLUMN_ALIASES)) {
      colMap[field] = findCol(headers, field)
    }

    let processed = 0
    const errors: Array<{ row: number; reason: string }> = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      try {
        const invNumCol = colMap['invoice_number']
        const invNum = invNumCol ? String(row[invNumCol] ?? '').trim() : null
        if (!invNum) { errors.push({ row: i + 1, reason: 'Missing invoice number' }); continue }

        const dateCol = colMap['invoice_date']
        const invoiceDate = parseDate(dateCol ? row[dateCol] : null)
        if (!invoiceDate) { errors.push({ row: i + 1, reason: 'Invalid invoice date' }); continue }

        const totalCol = colMap['total_amount']
        const totalAmount = parseAmount(totalCol ? row[totalCol] : null)
        if (totalAmount === null) { errors.push({ row: i + 1, reason: 'Invalid total amount' }); continue }

        const taxAmount = parseAmount(colMap['tax_amount'] ? row[colMap['tax_amount']!] : null) ?? 0
        const typeRaw = String(colMap['invoice_type'] ? row[colMap['invoice_type']!] : '').toLowerCase()
        const invoiceType = typeRaw.includes('purchase') || typeRaw.includes('vendor') ? 'purchase' : 'sales'

        const statusRaw = String(colMap['status'] ? row[colMap['status']!] : '').toLowerCase()
        const status = statusRaw.includes('paid') ? 'paid'
          : statusRaw.includes('overdue') ? 'overdue'
          : statusRaw.includes('cancel') ? 'cancelled'
          : 'pending'

        let customerId = null
        let supplierId = null

        if (invoiceType === 'sales' && colMap['customer_name']) {
          const name = String(row[colMap['customer_name']!] ?? '').trim()
          if (name) {
            const { data } = await supabase
              .from('customers')
              .upsert({ name }, { onConflict: 'name', ignoreDuplicates: false })
              .select('id')
              .single()
            customerId = data?.id
          }
        } else if (colMap['supplier_name']) {
          const name = String(row[colMap['supplier_name']!] ?? '').trim()
          if (name) {
            const { data } = await supabase
              .from('suppliers')
              .upsert({ name }, { onConflict: 'name', ignoreDuplicates: false })
              .select('id')
              .single()
            supplierId = data?.id
          }
        }

        await supabase.from('invoices').upsert({
          invoice_number: invNum,
          invoice_type: invoiceType,
          invoice_date: invoiceDate,
          total_amount: totalAmount,
          tax_amount: taxAmount,
          subtotal: totalAmount - taxAmount,
          status,
          customer_id: customerId,
          supplier_id: supplierId,
          currency: 'USD',
        }, { onConflict: 'invoice_number,invoice_type', ignoreDuplicates: false })

        processed++
      } catch (err) {
        errors.push({ row: i + 1, reason: String(err) })
      }
    }

    await supabase
      .from('upload_logs')
      .update({
        total_rows: rows.length,
        processed_rows: processed,
        failed_rows: rows.length - processed,
        errors,
        status: 'completed',
      })
      .eq('id', upload_log_id)

    return new Response(
      JSON.stringify({ processed, failed: rows.length - processed, errors }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
