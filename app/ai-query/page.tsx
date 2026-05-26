'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, Code, AlertTriangle, ExternalLink, Copy, CheckCheck, X, Sparkles, Database, ArrowRight } from 'lucide-react'

const SETUP_SQL = `-- Run this once in your Supabase SQL Editor to enable AI query execution
-- https://supabase.com/dashboard/project/_/sql

CREATE OR REPLACE FUNCTION run_safe_query(query_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  normalized TEXT;
BEGIN
  normalized := TRIM(UPPER(query_text));
  IF normalized !~ '^(SELECT|WITH)' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
  IF normalized ~ '\\m(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|EXECUTE|DO)\\M' THEN
    RAISE EXCEPTION 'Forbidden SQL keyword detected';
  END IF;
  EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', query_text) INTO result;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION run_safe_query(TEXT) TO authenticated;`

interface Message {
  role: 'user' | 'assistant'
  content: string
  sql?: string
  results?: unknown[]
}

const EXAMPLE_QUESTIONS = [
  'What were total sales this year?',
  'Which customer had the highest invoices?',
  'Compare sales vs purchases for last month',
  'List all overdue invoices',
  'What is the total unpaid amount?',
]

export default function AIQueryPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSQL, setShowSQL] = useState<string | null>(null)
  const [showSetupBanner, setShowSetupBanner] = useState(false)
  const [setupSQLCopied, setSetupSQLCopied] = useState(false)
  const [copiedQuery, setCopiedQuery] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function copySetupSQL() {
    await navigator.clipboard.writeText(SETUP_SQL)
    setSetupSQLCopied(true)
    setTimeout(() => setSetupSQLCopied(false), 2000)
  }

  async function copyQuerySQL(sql: string) {
    await navigator.clipboard.writeText(sql)
    setCopiedQuery(sql)
    setTimeout(() => setCopiedQuery(null), 2000)
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function sendMessage(question: string) {
    if (!question.trim() || loading) return

    const userMsg: Message = { role: 'user', content: question }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const data = await res.json()

      if (data.setupRequired) setShowSetupBanner(true)

      const assistantMsg: Message = {
        role: 'assistant',
        content: res.ok || data.setupRequired
          ? (data.answer ?? data.explanation ?? 'Query completed.')
          : (data.error ?? 'Something went wrong.'),
        sql: data.sql,
        results: data.results,
      }

      setMessages(prev => [...prev, assistantMsg])
    } catch (error) {
      const errorMsg: Message = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 relative overflow-hidden font-sans">
      {/* CSS Keyframes and Utility Styles */}
      <style jsx global>{`
        @keyframes message-slide-user {
          0% { opacity: 0; transform: translateY(16px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes message-slide-assistant {
          0% { opacity: 0; transform: translateY(16px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes bounce-dot {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-5px); opacity: 1; }
        }
        .animate-user-msg {
          animation: message-slide-user 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-assistant-msg {
          animation: message-slide-assistant 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .glass-panel {
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .glass-card-hover {
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .glass-card-hover:hover {
          transform: translateY(-2px);
          border-color: rgba(99, 102, 241, 0.3);
          background: rgba(30, 41, 59, 0.55);
          box-shadow: 0 12px 24px -8px rgba(99, 102, 241, 0.15);
        }
      `}</style>

      {/* Floating Radial Glow Accents */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-violet-500/5 rounded-full blur-[130px] pointer-events-none" />

      {/* Header */}
      <div className="px-8 py-5 border-b border-slate-800/80 bg-slate-950/75 backdrop-blur-md z-10 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="text-indigo-400 shrink-0" size={20} />
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300">
              AI Financial Query
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">Ask questions about your invoice data in plain English</p>
        </div>
      </div>

      {/* Setup Required Banner */}
      {showSetupBanner && (
        <div className="mx-8 mt-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 animate-user-msg z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-300">One-time database setup required</p>
                <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
                  The AI can generate SQL but can&apos;t execute it yet. Copy the setup SQL and run it once in your Supabase SQL Editor — then all queries will return live data.
                </p>
                <div className="flex items-center gap-2 mt-3.5">
                  <button
                    onClick={copySetupSQL}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded-xl transition-all shadow-md shadow-amber-900/20 active:scale-95"
                  >
                    {setupSQLCopied ? <CheckCheck size={13} /> : <Copy size={13} />}
                    {setupSQLCopied ? 'Copied!' : 'Copy setup SQL'}
                  </button>
                  <a
                    href={`https://supabase.com/dashboard/project/${process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/\/\/([^.]+)\./)?.[1] ?? '_'}/sql`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3.5 py-2 border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 text-xs font-medium rounded-xl transition-all active:scale-95"
                  >
                    <ExternalLink size={13} />
                    Open SQL Editor
                  </a>
                </div>
              </div>
            </div>
            <button onClick={() => setShowSetupBanner(false)} className="text-amber-400 hover:text-amber-200 shrink-0 transition-colors p-0.5 rounded-lg hover:bg-amber-500/10">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Messages / Main Chat Area */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {messages.length === 0 && (
          <div className="max-w-2xl mx-auto mt-12 mb-8 animate-user-msg">
            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-500/30 shadow-lg shadow-indigo-500/5 relative">
                <div className="absolute inset-0 bg-indigo-500/10 rounded-2xl blur-lg animate-pulse" />
                <Bot size={32} className="text-indigo-400 relative z-10" />
              </div>
              <h2 className="text-xl font-bold text-slate-100">Analyze your finances in real time</h2>
              <p className="text-xs text-slate-400 mt-1.5 max-w-sm mx-auto leading-relaxed">
                Powered by AI — natural language prompts automatically translate to secure SQL execution.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {EXAMPLE_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="glass-panel glass-card-hover text-left p-4 rounded-2xl group transition-all duration-300 flex items-start gap-3 border border-slate-800/80"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0 group-hover:bg-indigo-500/20 group-hover:text-indigo-300 transition-colors">
                    <Database size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors leading-snug truncate">
                      {q}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 group-hover:text-slate-300 transition-colors">
                      Query database <ArrowRight size={10} className="transform group-hover:translate-x-1 transition-transform" />
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end animate-user-msg' : 'justify-start animate-assistant-msg'}`}>
            {msg.role === 'assistant' && (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-md">
                <Bot size={18} className="text-indigo-400" />
              </div>
            )}

            <div className={`max-w-2xl flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`px-5 py-3.5 rounded-2xl text-sm leading-relaxed shadow-lg ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-indigo-600 to-blue-700 text-white rounded-tr-sm shadow-indigo-600/10 border border-indigo-500/20'
                    : 'glass-panel text-slate-200 rounded-tl-sm border border-slate-800 shadow-black/10'
                }`}
              >
                {msg.content}
              </div>

              {msg.sql && (
                <div className="mt-2.5 w-full">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowSQL(showSQL === msg.sql ? null : msg.sql!)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-indigo-400 transition-colors"
                    >
                      <Code size={13} />
                      {showSQL === msg.sql ? 'Hide SQL Code' : 'Show SQL Code'}
                    </button>
                    {showSQL === msg.sql && (
                      <button
                        onClick={() => copyQuerySQL(msg.sql!)}
                        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-400 transition-colors"
                      >
                        {copiedQuery === msg.sql ? <CheckCheck size={11} className="text-green-400" /> : <Copy size={11} />}
                        {copiedQuery === msg.sql ? 'Copied' : 'Copy Code'}
                      </button>
                    )}
                  </div>
                  
                  {showSQL === msg.sql && (
                    <div className="mt-2 relative group animate-user-msg">
                      <div className="absolute top-2 right-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-md">
                        Safe Query
                      </div>
                      <pre className="bg-slate-950 border border-slate-800 text-indigo-300 rounded-xl px-5 py-4 text-xs font-mono overflow-x-auto leading-relaxed shadow-inner">
                        {msg.sql}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {msg.results && msg.results.length > 0 && (
                <div className="mt-3.5 w-full glass-panel border border-slate-800 rounded-2xl overflow-hidden shadow-xl animate-user-msg">
                  <div className="px-4 py-2.5 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      Live Query Results
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Returned {msg.results.length} rows
                    </span>
                  </div>
                  
                  <div className="overflow-x-auto max-h-56 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                    <table className="text-[11px] w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800/80 bg-slate-950/20">
                          {Object.keys(msg.results[0] as object).map(col => (
                            <th key={col} className="px-4 py-3 text-slate-400 font-semibold whitespace-nowrap uppercase tracking-wider text-[10px]">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {msg.results.slice(0, 10).map((row, ri) => (
                          <tr key={ri} className="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">
                            {Object.values(row as object).map((val, ci) => (
                              <td key={ci} className="px-4 py-2.5 text-slate-300 font-medium whitespace-nowrap">
                                {String(val ?? '—')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {msg.results.length > 10 && (
                    <div className="text-[10px] text-slate-500 px-4 py-2 border-t border-slate-850 bg-slate-900/20">
                      Showing 10 of {msg.results.length} rows
                    </div>
                  )}
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                <User size={18} className="text-slate-300" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-4 animate-assistant-msg">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-md">
              <Bot size={18} className="text-indigo-400 animate-pulse" />
            </div>
            <div className="glass-panel text-slate-200 rounded-2xl rounded-tl-sm px-5 py-4 border border-slate-800 shadow-md flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0s' }} />
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0.15s' }} />
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0.3s' }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input / Message Compose Panel */}
      <div className="border-t border-slate-800/80 bg-slate-950/75 backdrop-blur-md px-8 py-5 z-10">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-3 relative items-center">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a financial question..."
              rows={1}
              className="flex-1 bg-slate-900/50 border border-slate-800 focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 rounded-2xl px-5 py-3.5 text-sm resize-none focus:outline-none placeholder-slate-500 text-slate-100 transition-all duration-300 pr-14 shadow-inner"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="absolute right-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 disabled:pointer-events-none text-white rounded-xl w-10 h-10 flex items-center justify-center transition-all duration-300 transform active:scale-95 shadow-md shadow-indigo-600/10 shrink-0"
            >
              {loading ? <Loader2 size={16} className="animate-spin text-white" /> : <Send size={16} />}
            </button>
          </div>
          <p className="text-[10px] text-center text-slate-500 mt-2.5 tracking-wide flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500/30" />
            AI generates secure PostgreSQL queries from your natural language requests
          </p>
        </div>
      </div>
    </div>
  )
}
