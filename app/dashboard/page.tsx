import { createClient } from '@/lib/supabase/server'
import { TrendingUp, TrendingDown, FileText, Users, AlertCircle } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string
  sub?: string
  icon: React.ReactNode
  color: string
}

function StatCard({ title, value, sub, icon, color }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${color}`}>{icon}</div>
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = createClient()

  const [
    { count: totalInvoices },
    { count: totalCustomers },
    { data: salesData },
    { data: purchaseData },
    { data: recentInvoices },
    { data: overdueData },
  ] = await Promise.all([
    supabase.from('invoices').select('*', { count: 'exact', head: true }),
    supabase.from('customers').select('*', { count: 'exact', head: true }),
    supabase
      .from('invoices')
      .select('total_amount')
      .eq('invoice_type', 'sales')
      .eq('status', 'paid'),
    supabase
      .from('invoices')
      .select('total_amount')
      .eq('invoice_type', 'purchase')
      .eq('status', 'paid'),
    supabase
      .from('invoices')
      .select('id, invoice_number, invoice_type, invoice_date, total_amount, status, customers(name), suppliers(name)')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('invoices')
      .select('total_amount')
      .eq('status', 'overdue'),
  ])

  const totalSales = salesData?.reduce((sum, r) => sum + Number(r.total_amount), 0) ?? 0
  const totalPurchases = purchaseData?.reduce((sum, r) => sum + Number(r.total_amount), 0) ?? 0
  const totalOverdue = overdueData?.reduce((sum, r) => sum + Number(r.total_amount), 0) ?? 0

  function fmt(n: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
  }

  const statusColors: Record<string, string> = {
    paid: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    overdue: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500',
  }

  return (
    <div className="p-8">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Financial summary across all invoices</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total Invoices"
          value={String(totalInvoices ?? 0)}
          icon={<FileText size={20} className="text-blue-600" />}
          color="bg-blue-50"
        />
        <StatCard
          title="Total Sales"
          value={fmt(totalSales)}
          sub="Paid sales invoices"
          icon={<TrendingUp size={20} className="text-green-600" />}
          color="bg-green-50"
        />
        <StatCard
          title="Total Purchases"
          value={fmt(totalPurchases)}
          sub="Paid purchase invoices"
          icon={<TrendingDown size={20} className="text-orange-600" />}
          color="bg-orange-50"
        />
        <StatCard
          title="Overdue"
          value={fmt(totalOverdue)}
          sub={`${overdueData?.length ?? 0} invoices`}
          icon={<AlertCircle size={20} className="text-red-600" />}
          color="bg-red-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Customers</h2>
          <p className="text-3xl font-bold text-gray-900">{totalCustomers ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">Total registered customers</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Net Position</h2>
          <p className={`text-3xl font-bold ${totalSales - totalPurchases >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {fmt(totalSales - totalPurchases)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Sales minus purchases</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Profit Margin</h2>
          <p className="text-3xl font-bold text-gray-900">
            {totalSales > 0 ? ((totalSales - totalPurchases) / totalSales * 100).toFixed(1) + '%' : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Based on paid invoices</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Recent Invoices</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Invoice #</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Party</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentInvoices && recentInvoices.length > 0 ? (
                recentInvoices.map((inv: Record<string, unknown>) => {
                  const customer = inv.customers as { name: string } | null
                  const supplier = inv.suppliers as { name: string } | null
                  const party = customer?.name ?? supplier?.name ?? '—'
                  const status = String(inv.status)
                  return (
                    <tr key={String(inv.id)} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-medium text-blue-700">{String(inv.invoice_number)}</td>
                      <td className="px-5 py-3 capitalize text-gray-600">{String(inv.invoice_type)}</td>
                      <td className="px-5 py-3 text-gray-700">{party}</td>
                      <td className="px-5 py-3 text-gray-500">{String(inv.invoice_date)}</td>
                      <td className="px-5 py-3 text-right font-medium">{fmt(Number(inv.total_amount))}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">
                    No invoices yet. Upload a file to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
