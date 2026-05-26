import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/** DELETE /api/invoices — deletes ALL invoices (and their line items) */
export async function DELETE() {
  const supabase = createServiceClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 1. Delete all line items first
  const { error: lineErr } = await supabase
    .from('invoice_line_items')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // matches every row

  if (lineErr) {
    return NextResponse.json(
      { error: `Failed to delete line items: ${lineErr.message}` },
      { status: 500 }
    )
  }

  // 2. Delete all invoices
  const { error: invErr } = await supabase
    .from('invoices')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (invErr) {
    return NextResponse.json({ error: invErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
