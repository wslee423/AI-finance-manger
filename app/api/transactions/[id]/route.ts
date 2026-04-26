import { createClient } from '@/lib/supabase/server'
import { getAuthUser, unauthorized, serverError } from '@/lib/api'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (!user) return unauthorized()

  const supabase = await createClient()
  const { id } = await params
  const body = await request.json()

  const { data, error } = await supabase
    .from('transactions').update(body).eq('id', id).is('deleted_at', null).select().single()

  if (error) return serverError(error.message)
  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (!user) return unauthorized()

  const supabase = await createClient()
  const { id } = await params

  const { error } = await supabase
    .from('transactions').update({ deleted_at: new Date().toISOString() }).eq('id', id)

  if (error) return serverError(error.message)
  return NextResponse.json({ success: true })
}
