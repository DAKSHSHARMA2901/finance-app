'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trash2, Search, AlertTriangle, Trash } from 'lucide-react'

interface Invoice {
  id: string
  invoice_number: string
  invoice_type: string
  invoice_date: string
  total_amount: number
  status: string
  customers: { name: string } | null
  suppliers: { name: string } | null
}

type Status = 'pending' | 'paid' | 'overdue' | 'cancelled'

const STATUSES: Status[] = ['pending', 'paid', 'overdue', 'cancelled']

const STATUS_COLORS: Record<string, string> = {
  paid:      'bg-green-100 text-green-700 border-green-200',
  pending:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  overdue:   'bg-red-100 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)
}

/* ── Status Select ── */
function StatusSelect({
  invoiceId,
  current,
  onChange,
}: {
  invoiceId: string
  current: string
  onChange: (id: string, newStatus: string) => void
}) {
  const [saving, setSaving] = useState(false)

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const status = e.target.value as Status
    if (status === current) return
    setSaving(true)
    const res = await fetch(`/api/invoices/${invoiceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) onChange(invoiceId, status)
    setSaving(false)
  }

  const colorClass = STATUS_COLORS[current] ?? 'bg-gray-100 text-gray-500 border-gray-200'

  return (
    <select
      value={current}
      onChange={handleChange}
      disabled={saving}
      className={`text-xs font-medium rounded-full border px-2.5 py-0.5 capitalize cursor-pointer
        focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 transition-opacity
        ${colorClass}
        ${saving ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}`}
    >
      {STATUSES.map(s => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  )
}

/* ── Single Delete Modal ── */
function DeleteModal({
  invoice,
  onConfirm,
  onCancel,
  deleting,
  error,
}: {
  invoice: Invoice
  onConfirm: () => void
  onCancel: () => void
  deleting: boolean
  error: string | null
}) {
  const party = invoice.customers?.name ?? invoice.suppliers?.name ?? '—'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={!deleting ? onCancel : undefined} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-11 h-11 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-1.5">Delete Invoice?</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Invoice <span className="font-semibold text-gray-700">{invoice.invoice_number}</span> for{' '}
              <span className="font-semibold text-gray-700">{party}</span> will be permanently deleted.
            </p>
          </div>
        </div>
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-700">
            {error}
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Delete All Modal ── */
function DeleteAllModal({
  count,
  onConfirm,
  onCancel,
  deleting,
  error,
}: {
  count: number
  onConfirm: () => void
  onCancel: () => void
  deleting: boolean
  error: string | null
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={!deleting ? onCancel : undefined} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <Trash size={28} className="text-red-600" />
          </div>
        </div>

        <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Delete All Invoices?</h3>
        <p className="text-sm text-gray-500 text-center leading-relaxed mb-2">
          Yeh action{' '}
          <span className="font-semibold text-red-600">{count} invoice{count !== 1 ? 's' : ''}</span>{' '}
          aur unke saare line items permanently delete kar dega.
        </p>
        <p className="text-xs text-gray-400 text-center mb-5">Yeh undo nahi ho sakta.</p>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {deleting ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Deleting…
              </>
            ) : (
              'Delete All'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main Page ── */
export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'sales' | 'purchase'>('all')

  // Single delete
  const [toDelete, setToDelete] = useState<Invoice | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Delete all
  const [showDeleteAll, setShowDeleteAll] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)
  const [deleteAllError, setDeleteAllError] = useState<string | null>(null)

  const supabase = createClient()

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_number, invoice_type, invoice_date, total_amount, status, customers(name), suppliers(name)')
      .order('created_at', { ascending: false })
    setInvoices((data as unknown as Invoice[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  /* Optimistic status update */
  function handleStatusChange(id: string, newStatus: string) {
    setInvoices(prev =>
      prev.map(inv => (inv.id === id ? { ...inv, status: newStatus } : inv))
    )
  }

  /* Single delete */
  async function handleDelete() {
    if (!toDelete) return
    setDeleting(true)
    setDeleteError(null)
    const res = await fetch(`/api/invoices/${toDelete.id}`, { method: 'DELETE' })
    if (res.ok) {
      setToDelete(null)
      await fetchInvoices()
    } else {
      const data = await res.json()
      setDeleteError(data.error ?? 'Delete failed. Please try again.')
    }
    setDeleting(false)
  }

  /* Delete all */
  async function handleDeleteAll() {
    setDeletingAll(true)
    setDeleteAllError(null)
    const res = await fetch('/api/invoices', { method: 'DELETE' })
    if (res.ok) {
      setShowDeleteAll(false)
      await fetchInvoices()
    } else {
      const data = await res.json()
      setDeleteAllError(data.error ?? 'Failed to delete all invoices.')
    }
    setDeletingAll(false)
  }

  /* Filtered list */
  const filtered = invoices.filter(inv => {
    const party = inv.customers?.name ?? inv.suppliers?.name ?? ''
    const matchSearch =
      inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      party.toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'all' || inv.invoice_type === typeFilter
    return matchSearch && matchType
  })

  return (
    <>
      {/* Single delete modal */}
      {toDelete && (
        <DeleteModal
          invoice={toDelete}
          onConfirm={handleDelete}
          onCancel={() => { if (!deleting) { setToDelete(null); setDeleteError(null) } }}
          deleting={deleting}
          error={deleteError}
        />
      )}

      {/* Delete all modal */}
      {showDeleteAll && (
        <DeleteAllModal
          count={invoices.length}
          onConfirm={handleDeleteAll}
          onCancel={() => { if (!deletingAll) { setShowDeleteAll(false); setDeleteAllError(null) } }}
          deleting={deletingAll}
          error={deleteAllError}
        />
      )}

      <div className="p-4 md:p-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6 md:mb-7">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Invoices</h1>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              {loading ? '…' : `${invoices.length} total invoices`}
            </p>
          </div>

          {/* Delete All button */}
          {!loading && invoices.length > 0 && (
            <button
              onClick={() => setShowDeleteAll(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
            >
              <Trash size={15} />
              <span className="hidden sm:inline">Delete All</span>
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by invoice # or party…"
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400"
            />
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 self-start">
            {(['all', 'sales', 'purchase'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                  typeFilter === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200">
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-400">Loading invoices…</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400">
              {invoices.length === 0
                ? 'No invoices yet. Upload a file to get started.'
                : 'No invoices match your search.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="text-left px-4 md:px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Invoice #</th>
                    <th className="text-left px-4 md:px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Type</th>
                    <th className="text-left px-4 md:px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Party</th>
                    <th className="text-left px-4 md:px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Date</th>
                    <th className="text-right px-4 md:px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</th>
                    <th className="text-left px-4 md:px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Status</th>
                    <th className="px-4 md:px-5 py-3 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(inv => {
                    const party = inv.customers?.name ?? inv.suppliers?.name ?? '—'
                    return (
                      <tr key={inv.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 group">
                        <td className="px-4 md:px-5 py-3 font-medium text-blue-700 text-xs md:text-sm whitespace-nowrap">{inv.invoice_number}</td>
                        <td className="px-4 md:px-5 py-3 capitalize text-gray-600 text-xs md:text-sm hidden sm:table-cell">{inv.invoice_type}</td>
                        <td className="px-4 md:px-5 py-3 text-gray-700 text-xs md:text-sm max-w-[140px] truncate">{party}</td>
                        <td className="px-4 md:px-5 py-3 text-gray-500 text-xs md:text-sm hidden md:table-cell whitespace-nowrap">
                          {String(inv.invoice_date).split('T')[0]}
                        </td>
                        <td className="px-4 md:px-5 py-3 text-right font-medium text-xs md:text-sm whitespace-nowrap">
                          {fmt(Number(inv.total_amount))}
                        </td>
                        <td className="px-4 md:px-5 py-3 hidden sm:table-cell">
                          <StatusSelect
                            invoiceId={inv.id}
                            current={inv.status}
                            onChange={handleStatusChange}
                          />
                        </td>
                        <td className="px-4 md:px-5 py-3 text-right">
                          <button
                            onClick={() => setToDelete(inv)}
                            title="Delete invoice"
                            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
