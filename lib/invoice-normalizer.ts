export interface NormalizedInvoice {
  invoice_number: string
  invoice_type: 'sales' | 'purchase'
  customer_name?: string
  supplier_name?: string
  invoice_date: string
  due_date?: string
  total_amount: number
  tax_amount: number
  subtotal: number
  currency: string
  status: 'pending' | 'paid' | 'overdue' | 'cancelled'
  notes?: string
  line_items: NormalizedLineItem[]
}

export interface NormalizedLineItem {
  description: string
  quantity: number
  unit_price: number
  total_price: number
  tax_rate: number
}

export interface NormalizationResult {
  success: NormalizedInvoice[]
  errors: Array<{ row: number; reason: string; raw: Record<string, unknown> }>
}

// Column name aliases for flexible parsing
const COLUMN_ALIASES: Record<string, string[]> = {
  invoice_number: ['invoice_number', 'invoice_no', 'invoice #', 'inv_no', 'inv #', 'number', 'invoice id', 'bill_no', 'bill no'],
  invoice_type: ['invoice_type', 'type', 'transaction_type', 'kind'],
  customer_name: ['customer_name', 'customer', 'client', 'client_name', 'buyer', 'bill_to', 'billed to'],
  supplier_name: ['supplier_name', 'supplier', 'vendor', 'vendor_name', 'seller', 'from'],
  invoice_date: ['invoice_date', 'date', 'bill_date', 'issue_date', 'created_date', 'invoice date'],
  due_date: ['due_date', 'payment_due', 'due by', 'payment_date', 'due date'],
  total_amount: ['total_amount', 'total', 'amount', 'grand_total', 'invoice_total', 'total amount', 'grand total'],
  tax_amount: ['tax_amount', 'tax', 'gst', 'vat', 'tax_total', 'taxes'],
  subtotal: ['subtotal', 'sub_total', 'amount_before_tax', 'net_amount', 'sub total'],
  currency: ['currency', 'currency_code', 'curr'],
  status: ['status', 'payment_status', 'state'],
  notes: ['notes', 'remarks', 'description', 'comment', 'memo'],
  item_description: ['item_description', 'description', 'item', 'product', 'service', 'particulars'],
  quantity: ['quantity', 'qty', 'units', 'count'],
  unit_price: ['unit_price', 'price', 'rate', 'unit_cost', 'unit price'],
  tax_rate: ['tax_rate', 'gst_rate', 'vat_rate', 'tax %', 'tax_percent'],
}

function findColumn(headers: string[], field: string): string | null {
  const aliases = COLUMN_ALIASES[field] ?? [field]
  for (const alias of aliases) {
    const found = headers.find(h => h.toLowerCase().trim() === alias.toLowerCase())
    if (found) return found
  }
  return null
}

function parseDate(value: unknown): string | null {
  if (!value) return null
  const str = String(value).trim()

  // Excel serial date
  if (/^\d{5}$/.test(str)) {
    const date = new Date((Number(str) - 25569) * 86400 * 1000)
    return date.toISOString().split('T')[0]
  }

  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/,
    /^(\d{2})\/(\d{2})\/(\d{4})$/,
    /^(\d{2})-(\d{2})-(\d{4})$/,
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
  ]

  for (const fmt of formats) {
    const m = str.match(fmt)
    if (m) {
      const d = new Date(str)
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
    }
  }

  const d = new Date(str)
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  return null
}

function parseAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const str = String(value).replace(/[$,£€₹\s]/g, '').trim()
  const num = parseFloat(str)
  return isNaN(num) ? null : Math.round(num * 100) / 100
}

function inferInvoiceType(row: Record<string, unknown>, typeCol: string | null): 'sales' | 'purchase' {
  if (typeCol) {
    const val = String(row[typeCol] ?? '').toLowerCase()
    if (val.includes('purchase') || val.includes('buy') || val.includes('vendor') || val.includes('supplier')) {
      return 'purchase'
    }
  }
  // If supplier column has a value but customer doesn't, it's a purchase
  const supplierCol = findColumn(Object.keys(row), 'supplier_name')
  const customerCol = findColumn(Object.keys(row), 'customer_name')
  if (supplierCol && row[supplierCol] && (!customerCol || !row[customerCol])) return 'purchase'
  return 'sales'
}

function inferStatus(value: unknown): 'pending' | 'paid' | 'overdue' | 'cancelled' {
  const val = String(value ?? '').toLowerCase()
  if (val.includes('paid') || val.includes('complete') || val.includes('settled')) return 'paid'
  if (val.includes('overdue') || val.includes('late')) return 'overdue'
  if (val.includes('cancel') || val.includes('void')) return 'cancelled'
  return 'pending'
}

export interface DuplicateCheckResult {
  isDuplicate: boolean
  matchingInvoice?: string
  confidence: number // 0-100
}

/**
 * Check if invoice likely duplicates an existing one
 */
export async function checkForDuplicate(
  invoice: NormalizedInvoice,
  supabaseClient: any
): Promise<DuplicateCheckResult> {
  try {
    // Exact match check
    const { data: exactMatch } = await supabaseClient
      .from('invoices')
      .select('id, invoice_number')
      .eq('invoice_number', invoice.invoice_number)
      .single()

    if (exactMatch) {
      return { isDuplicate: true, matchingInvoice: exactMatch.invoice_number, confidence: 100 }
    }

    // Fuzzy match check: similar amount and date
    const startDate = new Date(invoice.invoice_date)
    startDate.setDate(startDate.getDate() - 3)
    const endDate = new Date(invoice.invoice_date)
    endDate.setDate(endDate.getDate() + 3)

    const { data: similarInvoices } = await supabaseClient
      .from('invoices')
      .select('id, invoice_number, total_amount, invoice_date')
      .gte('invoice_date', startDate.toISOString().split('T')[0])
      .lte('invoice_date', endDate.toISOString().split('T')[0])
      .limit(10)

    const tolerance = invoice.total_amount * 0.05 // 5% tolerance
    for (const existing of similarInvoices || []) {
      if (Math.abs(existing.total_amount - invoice.total_amount) < tolerance) {
        const confidence = 75 - Math.abs(existing.total_amount - invoice.total_amount) / tolerance * 25
        return {
          isDuplicate: true,
          matchingInvoice: existing.invoice_number,
          confidence: Math.round(confidence),
        }
      }
    }

    return { isDuplicate: false, confidence: 0 }
  } catch (error) {
    console.warn('Duplicate check failed:', error)
    return { isDuplicate: false, confidence: 0 }
  }
}

/**
 * Validate normalized invoice
 */
export function validateNormalizedInvoice(invoice: NormalizedInvoice): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Required fields
  if (!invoice.invoice_number) errors.push('Invoice number is required')
  if (!invoice.invoice_type) errors.push('Invoice type is required')
  if (!invoice.invoice_date) errors.push('Invoice date is required')

  // Type-specific requirements
  if (invoice.invoice_type === 'sales' && !invoice.customer_name) {
    errors.push('Sales invoices must have a customer name')
  }
  if (invoice.invoice_type === 'purchase' && !invoice.supplier_name) {
    errors.push('Purchase invoices must have a supplier name')
  }

  // Amount validation
  if (invoice.total_amount < 0) errors.push('Total amount cannot be negative')
  if (invoice.tax_amount < 0) errors.push('Tax amount cannot be negative')
  if (invoice.subtotal < 0) errors.push('Subtotal cannot be negative')

  // Date validation
  const invoiceDate = new Date(invoice.invoice_date)
  if (isNaN(invoiceDate.getTime())) errors.push('Invalid invoice date')
  if (invoiceDate > new Date()) errors.push('Invoice date cannot be in the future')

  if (invoice.due_date) {
    const dueDate = new Date(invoice.due_date)
    if (isNaN(dueDate.getTime())) errors.push('Invalid due date')
    if (dueDate < invoiceDate) errors.push('Due date cannot be before invoice date')
  }

  // Line items validation
  if (invoice.line_items.length === 0) {
    errors.push('At least one line item is required')
  } else {
    let itemTotal = 0
    for (let i = 0; i < invoice.line_items.length; i++) {
      const item = invoice.line_items[i]
      if (!item.description) errors.push(`Line item ${i + 1}: description is required`)
      if (item.quantity <= 0) errors.push(`Line item ${i + 1}: quantity must be positive`)
      if (item.unit_price < 0) errors.push(`Line item ${i + 1}: unit price cannot be negative`)
      itemTotal += item.total_price
    }

    // Verify line items total matches invoice total (with 2-3% tolerance for rounding)
    const tolerance = invoice.total_amount * 0.03
    if (Math.abs(itemTotal - invoice.total_amount) > tolerance) {
      errors.push(`Line items total (${itemTotal}) doesn't match invoice total (${invoice.total_amount})`)
    }
  }

  // Status validation
  const validStatuses = ['pending', 'paid', 'overdue', 'cancelled']
  if (!validStatuses.includes(invoice.status)) {
    errors.push(`Invalid status: ${invoice.status}`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function normalizeInvoiceRows(rows: Record<string, unknown>[]): NormalizationResult {
  if (rows.length === 0) return { success: [], errors: [] }

  const headers = Object.keys(rows[0])
  const colMap: Record<string, string | null> = {}
  for (const field of Object.keys(COLUMN_ALIASES)) {
    colMap[field] = findColumn(headers, field)
  }

  const success: NormalizedInvoice[] = []
  const errors: NormalizationResult['errors'] = []

  // Group rows by invoice number if line items are inline
  const grouped = new Map<string, Record<string, unknown>[]>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const invNumCol = colMap['invoice_number']
    const invNum = invNumCol ? String(row[invNumCol] ?? '').trim() : `AUTO-${i + 1}`

    if (!invNum) {
      errors.push({ row: i + 1, reason: 'Missing invoice number', raw: row })
      continue
    }

    if (!grouped.has(invNum)) grouped.set(invNum, [])
    grouped.get(invNum)!.push(row)
  }

  for (const [invNum, invRows] of Array.from(grouped.entries())) {
    const firstRow = invRows[0]
    const rowIndex = rows.indexOf(firstRow) + 1

    try {
      // Parse required fields
      const rawDate = colMap['invoice_date'] ? firstRow[colMap['invoice_date']!] : null
      const invoiceDate = parseDate(rawDate)
      if (!invoiceDate) {
        errors.push({ row: rowIndex, reason: 'Invalid or missing invoice date', raw: firstRow })
        continue
      }

      const rawTotal = colMap['total_amount'] ? firstRow[colMap['total_amount']!] : null
      const totalAmount = parseAmount(rawTotal)
      if (totalAmount === null) {
        errors.push({ row: rowIndex, reason: 'Invalid or missing total amount', raw: firstRow })
        continue
      }

      const taxAmount = parseAmount(colMap['tax_amount'] ? firstRow[colMap['tax_amount']!] : null) ?? 0
      const subtotal = parseAmount(colMap['subtotal'] ? firstRow[colMap['subtotal']!] : null) ?? (totalAmount - taxAmount)

      // Build line items from each row in the group
      const lineItems: NormalizedLineItem[] = []
      for (const r of invRows) {
        const desc = colMap['item_description'] ? String(r[colMap['item_description']!] ?? '').trim() : ''
        const qty = parseAmount(colMap['quantity'] ? r[colMap['quantity']!] : null) ?? 1
        const unitPrice = parseAmount(colMap['unit_price'] ? r[colMap['unit_price']!] : null) ?? 0
        const taxRate = parseAmount(colMap['tax_rate'] ? r[colMap['tax_rate']!] : null) ?? 0
        const lineTotal = parseAmount(colMap['total_amount'] ? r[colMap['total_amount']!] : null) ?? (qty * unitPrice)

        if (desc || unitPrice) {
          lineItems.push({
            description: desc || 'Item',
            quantity: qty,
            unit_price: unitPrice,
            total_price: lineTotal,
            tax_rate: taxRate / 100,
          })
        }
      }

      const invoiceType = inferInvoiceType(firstRow, colMap['invoice_type'])
      const rawStatus = colMap['status'] ? firstRow[colMap['status']!] : null
      const status = inferStatus(rawStatus)

      const normalized: NormalizedInvoice = {
        invoice_number: invNum,
        invoice_type: invoiceType,
        invoice_date: invoiceDate,
        due_date: parseDate(colMap['due_date'] ? firstRow[colMap['due_date']!] : null) ?? undefined,
        total_amount: totalAmount,
        tax_amount: taxAmount,
        subtotal,
        currency: String(colMap['currency'] ? firstRow[colMap['currency']!] : 'USD').toUpperCase() || 'USD',
        status,
        notes: colMap['notes'] ? String(firstRow[colMap['notes']!] ?? '').trim() || undefined : undefined,
        line_items: lineItems,
      }

      if (invoiceType === 'sales') {
        normalized.customer_name = colMap['customer_name']
          ? String(firstRow[colMap['customer_name']!] ?? '').trim() || undefined
          : undefined
      } else {
        normalized.supplier_name = colMap['supplier_name']
          ? String(firstRow[colMap['supplier_name']!] ?? '').trim() || undefined
          : undefined
      }

      success.push(normalized)
    } catch (err) {
      errors.push({ row: rowIndex, reason: String(err), raw: firstRow })
    }
  }

  return { success, errors }
}
