'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileSpreadsheet, FileText, CheckCircle, XCircle, AlertCircle, Sparkles } from 'lucide-react'

interface UploadResult {
  total: number
  processed: number
  failed: number
  errors: Array<{ row: number; reason: string }>
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return <FileText size={28} className="text-red-500" />
  return <FileSpreadsheet size={28} className="text-green-600" />
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) {
      setFile(accepted[0])
      setResult(null)
      setError(null)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
  })

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Upload failed')
    } else {
      setResult(data)
    }
    setUploading(false)
  }

  function resetUpload() {
    setFile(null)
    setResult(null)
    setError(null)
  }

  const isPdf = file?.name.toLowerCase().endsWith('.pdf')

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900">Bulk Upload</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload CSV, Excel, or PDF invoice files. Mixed column names are handled automatically.
        </p>
      </div>

      {/* Format cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* Spreadsheet info */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileSpreadsheet size={16} className="text-blue-600" />
            <h3 className="text-sm font-semibold text-blue-800">CSV / Excel</h3>
          </div>
          <div className="grid grid-cols-1 gap-0.5 text-xs text-blue-700">
            <span>invoice_number / invoice_no / inv #</span>
            <span>customer / customer_name / client</span>
            <span>date / invoice_date / bill_date</span>
            <span>supplier / vendor / vendor_name</span>
            <span>total / total_amount / grand_total</span>
            <span>tax / tax_amount / gst / vat</span>
          </div>
        </div>

        {/* PDF info */}
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={16} className="text-rose-600" />
            <h3 className="text-sm font-semibold text-rose-800">PDF — AI Powered</h3>
          </div>
          <p className="text-xs text-rose-700 leading-relaxed">
            Invoice data is automatically extracted using Claude AI. Works with most standard invoice layouts.
          </p>
          <p className="text-xs text-rose-500 mt-2">
            ⚠ Scanned / image-only PDFs are not supported.
          </p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors mb-4 ${
          isDragActive
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <FileIcon name={file.name} />
            <div className="text-left">
              <p className="font-medium text-gray-800">{file.name}</p>
              <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
              {isPdf && (
                <p className="text-xs text-rose-500 mt-0.5 flex items-center gap-1">
                  <Sparkles size={11} /> Will be processed with AI
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            <Upload size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-600 font-medium">Drop your file here, or click to browse</p>
            <p className="text-xs text-gray-400 mt-1">CSV, XLSX, XLS, or PDF supported</p>
          </>
        )}
      </div>

      {/* PDF notice while uploading */}
      {uploading && isPdf && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-amber-700">
          <Sparkles size={16} className="shrink-0 animate-pulse" />
          AI is reading your PDF and extracting invoice data — this may take 10–20 seconds…
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
        >
          {uploading ? 'Processing…' : 'Upload & Process'}
        </button>
        {file && (
          <button onClick={resetUpload} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2.5">
            Clear
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-5 bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
          <XCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="mt-5 space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle size={20} className="text-green-600" />
              <h3 className="font-semibold text-gray-800">Upload Complete</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{result.total}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {isPdf ? 'Invoices found' : 'Total rows'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{result.processed}</p>
                <p className="text-xs text-gray-500 mt-1">Processed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-500">{result.failed}</p>
                <p className="text-xs text-gray-500 mt-1">Failed</p>
              </div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle size={17} className="text-amber-600" />
                <h4 className="text-sm font-semibold text-amber-800">Row Errors</h4>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-amber-700">
                    {e.row > 0 ? `Row ${e.row}: ` : ''}{e.reason}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
