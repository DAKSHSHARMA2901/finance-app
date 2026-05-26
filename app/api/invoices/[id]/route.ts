import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const VALID_STATUSES = ['pending', 'paid', 'overdue', 'cancelled'] as const

/** PATCH /api/invoices/[id] — update invoice status */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params
  if (!id) return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 })

  const body = await request.json()
  const status = body.status as string

  if (!VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return NextResponse.json({ error: 'Invalid status value' }, { status: 400 })
  }

  const { error } = await supabase
    .from('invoices')
    .update({ status })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServiceClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params
  if (!id) return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 })

  // Delete dependent line items first (in case there's no CASCADE on the FK)
  const { error: lineItemsError } = await supabase
    .from('invoice_line_items')
    .delete()
    .eq('invoice_id', id)

  if (lineItemsError) {
    return NextResponse.json(
      { error: `Failed to delete line items: ${lineItemsError.message}` },
      { status: 500 }
    )
  }

  // Delete the invoice itself
  const { error } = await supabase.from('invoices').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
