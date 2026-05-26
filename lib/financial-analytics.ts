/**
 * Financial Analytics & Calculations
 * Supports common financial metrics and comparisons
 */

export interface FinancialMetrics {
  totalSales: number
  totalPurchases: number
  totalPaid: number
  totalPending: number
  totalOverdue: number
  profitMargin: number
  cashFlow: number
  averageInvoiceValue: number
}

export interface PeriodComparison {
  period1Name: string
  period1Value: number
  period2Name: string
  period2Value: number
  difference: number
  percentageChange: number
}

export interface CustomerMetrics {
  name: string
  totalInvoices: number
  totalAmount: number
  averageInvoice: number
  status: 'active' | 'inactive' | 'at-risk'
  daysOverdue?: number
}

export interface InventoryMetrics {
  name: string
  unitPrice: number
  totalSold: number
  totalPurchased: number
  revenue: number
}

/**
 * Calculate financial metrics from invoice data
 */
export function calculateMetrics(invoices: any[]): FinancialMetrics {
  const sales = invoices.filter(i => i.invoice_type === 'sales')
  const purchases = invoices.filter(i => i.invoice_type === 'purchase')
  const paid = invoices.filter(i => i.status === 'paid')
  const pending = invoices.filter(i => i.status === 'pending')
  const overdue = invoices.filter(i => i.status === 'overdue')

  const totalSales = sales.reduce((sum, i) => sum + (i.total_amount || 0), 0)
  const totalPurchases = purchases.reduce((sum, i) => sum + (i.total_amount || 0), 0)
  const totalPaid = paid.reduce((sum, i) => sum + (i.total_amount || 0), 0)
  const totalPending = pending.reduce((sum, i) => sum + (i.total_amount || 0), 0)
  const totalOverdue = overdue.reduce((sum, i) => sum + (i.total_amount || 0), 0)

  return {
    totalSales: Math.round(totalSales * 100) / 100,
    totalPurchases: Math.round(totalPurchases * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    totalPending: Math.round(totalPending * 100) / 100,
    totalOverdue: Math.round(totalOverdue * 100) / 100,
    profitMargin: totalSales > 0 ? Math.round(((totalSales - totalPurchases) / totalSales) * 10000) / 100 : 0,
    cashFlow: Math.round((totalPaid - totalPurchases) * 100) / 100,
    averageInvoiceValue: invoices.length > 0 ? Math.round((totalSales / invoices.length) * 100) / 100 : 0,
  }
}

/**
 * Compare two periods (e.g., this month vs last month)
 */
export function comparePeriods(
  period1: any[],
  period2: any[],
  period1Name: string,
  period2Name: string,
  invoiceType: 'sales' | 'purchase' | 'all' = 'all'
): PeriodComparison {
  const filterType = (invoices: any[]) => {
    if (invoiceType === 'all') return invoices
    return invoices.filter(i => i.invoice_type === invoiceType)
  }

  const p1 = filterType(period1)
  const p2 = filterType(period2)

  const value1 = p1.reduce((sum, i) => sum + (i.total_amount || 0), 0)
  const value2 = p2.reduce((sum, i) => sum + (i.total_amount || 0), 0)
  const difference = Math.round((value2 - value1) * 100) / 100
  const percentageChange = value1 !== 0 ? Math.round(((difference / value1) * 10000)) / 100 : 0

  return {
    period1Name,
    period1Value: Math.round(value1 * 100) / 100,
    period2Name,
    period2Value: Math.round(value2 * 100) / 100,
    difference,
    percentageChange,
  }
}

/**
 * Analyze customer performance
 */
export function analyzeCustomer(invoices: any[], customerId: string, customerName: string): CustomerMetrics {
  const customerInvoices = invoices.filter(i => i.customer_id === customerId)
  const totalAmount = customerInvoices.reduce((sum, i) => sum + (i.total_amount || 0), 0)
  const overdue = customerInvoices.filter(i => i.status === 'overdue')
  const maxOverdueDate = overdue.length > 0 
    ? Math.max(...overdue.map(i => new Date(i.due_date).getTime()))
    : null

  let status: 'active' | 'inactive' | 'at-risk' = 'inactive'
  if (customerInvoices.length > 0) {
    status = overdue.length > 0 ? 'at-risk' : 'active'
  }

  const daysOverdue = maxOverdueDate
    ? Math.floor((Date.now() - maxOverdueDate) / (1000 * 60 * 60 * 24))
    : undefined

  return {
    name: customerName,
    totalInvoices: customerInvoices.length,
    totalAmount: Math.round(totalAmount * 100) / 100,
    averageInvoice: customerInvoices.length > 0 ? Math.round((totalAmount / customerInvoices.length) * 100) / 100 : 0,
    status,
    daysOverdue,
  }
}

/**
 * Calculate ROI (Return on Investment)
 */
export function calculateROI(revenue: number, cost: number): number {
  if (cost === 0) return 0
  return Math.round(((revenue - cost) / cost) * 10000) / 100
}

/**
 * Calculate breakeven point
 */
export function calculateBreakeven(fixedCosts: number, variableCostPerUnit: number, pricePerUnit: number): number {
  if (pricePerUnit <= variableCostPerUnit) return 0
  return Math.ceil(fixedCosts / (pricePerUnit - variableCostPerUnit))
}

/**
 * Identify risky invoices
 */
export function identifyRiskyInvoices(invoices: any[], daysThreshold = 30): any[] {
  const today = new Date()
  return invoices.filter(inv => {
    if (inv.status === 'paid' || inv.status === 'cancelled') return false
    const dueDate = new Date(inv.due_date || inv.invoice_date)
    const daysPast = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    return daysPast > daysThreshold
  })
}

/**
 * Calculate tax burden
 */
export function calculateTaxBurden(invoices: any[]): { totalTax: number; effectiveRate: number } {
  const totalRevenue = invoices.reduce((sum, i) => sum + (i.total_amount || 0), 0)
  const totalTax = invoices.reduce((sum, i) => sum + (i.tax_amount || 0), 0)
  const effectiveRate = totalRevenue > 0 ? Math.round(((totalTax / totalRevenue) * 10000)) / 100 : 0

  return {
    totalTax: Math.round(totalTax * 100) / 100,
    effectiveRate,
  }
}

/**
 * Format metrics for display
 */
export function formatMetrics(metrics: FinancialMetrics): Record<string, string> {
  return {
    'Total Sales': `$${metrics.totalSales.toFixed(2)}`,
    'Total Purchases': `$${metrics.totalPurchases.toFixed(2)}`,
    'Total Paid': `$${metrics.totalPaid.toFixed(2)}`,
    'Total Pending': `$${metrics.totalPending.toFixed(2)}`,
    'Total Overdue': `$${metrics.totalOverdue.toFixed(2)}`,
    'Profit Margin': `${metrics.profitMargin.toFixed(2)}%`,
    'Cash Flow': `$${metrics.cashFlow.toFixed(2)}`,
    'Average Invoice Value': `$${metrics.averageInvoiceValue.toFixed(2)}`,
  }
}
