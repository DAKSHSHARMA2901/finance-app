import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Anthropic from "npm:@anthropic-ai/sdk"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface QueryRequest {
  question: string
  userId?: string
}

interface QueryResponse {
  sql: string
  explanation: string
  safe: boolean
}

const SCHEMA_DESCRIPTION = `
Database schema for financial application:
- customers(id, name, email, phone, address, created_at)
- suppliers(id, name, email, phone, address, created_at)
- products(id, name, description, unit_price, sku, created_at)
- invoices(id, invoice_number, invoice_type ['sales'|'purchase'], customer_id, supplier_id, invoice_date, due_date, subtotal, tax_amount, total_amount, status ['pending'|'paid'|'overdue'|'cancelled'], currency, notes, created_at)
- invoice_line_items(id, invoice_id, product_id, description, quantity, unit_price, tax_rate, total_price, created_at)
- transactions(id, invoice_id, transaction_date, amount, transaction_type ['payment'|'refund'|'credit'], reference, notes, created_at)

Relationships:
- invoices.customer_id -> customers.id
- invoices.supplier_id -> suppliers.id
- invoice_line_items.invoice_id -> invoices.id
- invoice_line_items.product_id -> products.id
- transactions.invoice_id -> invoices.id
`

async function generateQueryWithClaude(question: string): Promise<QueryResponse> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY")
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured")

  const client = new Anthropic({ apiKey })

  const prompt = `You are a PostgreSQL expert. Convert this financial question into a safe SQL SELECT query.

${SCHEMA_DESCRIPTION}

Rules:
1. ONLY SELECT queries
2. Use ROUND() for monetary values
3. Return valid JSON only: {"sql": "...", "explanation": "..."}

Question: ${question}`

  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 8096,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: prompt }],
  })

  // Find text block (skip thinking blocks)
  const textBlock = response.content.find((block) => block.type === "text")
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude")
  }

  const text = textBlock.text
  const cleaned = text.replace(/```json\n?|\n?```/g, "").replace(/```\n?|\n?```/g, "").trim()
  const parsed = JSON.parse(cleaned)

  // Clean trailing semicolons to prevent syntax errors in subqueries
  parsed.sql = parsed.sql.trim()
  if (parsed.sql.endsWith(";")) {
    parsed.sql = parsed.sql.slice(0, -1).trim()
  }

  // Validate SQL
  const sqlUpper = parsed.sql.toUpperCase()
  if (!sqlUpper.startsWith("SELECT") && !sqlUpper.startsWith("WITH")) {
    throw new Error("Invalid query type")
  }

  if (sqlUpper.match(/\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE)\b/)) {
    throw new Error("Dangerous SQL keywords")
  }

  return {
    sql: parsed.sql,
    explanation: parsed.explanation,
    safe: true,
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { question, userId } = (await req.json()) as QueryRequest

    if (!question) {
      return new Response(JSON.stringify({ error: "Question required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Log query for audit trail
    console.log(`[AI Query] User: ${userId}, Question: ${question.substring(0, 100)}`)

    const result = await generateQueryWithClaude(question)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error"
    console.error("Error:", errorMessage)
    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})
