import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseDirectClient } from '@supabase/supabase-js'
import { generateSQLQuery, generateNaturalLanguageAnswer, validateFinancialQuery } from '@/lib/ai-query'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const question = String(body.question ?? '').trim()
  
  // Validation
  if (!question) return NextResponse.json({ error: 'Question is required' }, { status: 400 })
  if (question.length > 500) return NextResponse.json({ error: 'Question too long (max 500 chars)' }, { status: 400 })

  // Check for valid financial query
  const validation = validateFinancialQuery(question)
  if (!validation.valid) {
    return NextResponse.json({ error: 'Invalid financial query' }, { status: 400 })
  }

  try {
    // Generate SQL
    const { sql, explanation } = await generateSQLQuery(question)

    // Log the query
    console.log(`[AI Query] User: ${user.id}, Question: ${question.substring(0, 100)}`)

    // Use service role to run the generated query (read-only SELECT)
    const adminClient = createSupabaseDirectClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: results, error: queryError } = await adminClient.rpc('run_safe_query', { query_text: sql })

    let queryResults: unknown[] = []
    if (queryError) {
      console.warn(`[Query Error] ${queryError.message}`)

      // PGRST202 = function not found in schema cache (run_safe_query not yet created)
      const isSetupRequired =
        queryError.code === 'PGRST202' ||
        queryError.message?.toLowerCase().includes('run_safe_query')

      return NextResponse.json(
        {
          question,
          sql,
          explanation,
          // Use the AI explanation as the answer instead of dumping raw SQL
          answer: explanation,
          results: [],
          setupRequired: isSetupRequired,
          warning: isSetupRequired
            ? 'Database function not found. Run the setup SQL in your Supabase SQL editor to enable live query execution.'
            : `Query execution error: ${queryError.message}`,
          ...(validation.warning && { validationWarning: validation.warning }),
        },
        { status: isSetupRequired ? 503 : 500 }
      )
    }

    queryResults = Array.isArray(results) ? results : []

    // Generate natural language answer
    const answer = await generateNaturalLanguageAnswer(question, sql, queryResults)

    // Log successful query
    try {
      await supabase.from('upload_logs').insert({
        user_id: user.id,
        filename: `query_${Date.now()}`,
        status: 'completed',
        errors: [],
      })
    } catch (err) {
      console.warn('Failed to log query:', err)
    }

    return NextResponse.json({
      question,
      sql,
      explanation,
      answer,
      results: queryResults.slice(0, 100), // Limit results to 100 rows
      rowCount: queryResults.length,
      ...(validation.warning && { validationWarning: validation.warning }),
    })
  } catch (err) {
    const errorMessage = String(err)
    console.error(`[Query Error] ${errorMessage}`)
    return NextResponse.json(
      {
        error: errorMessage,
        suggestion: 'Try rephrasing your question or breaking it into smaller parts.',
      },
      { status: 500 }
    )
  }
}
