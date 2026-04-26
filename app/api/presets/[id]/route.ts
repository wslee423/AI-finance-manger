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

  const { data, error } = await supabase.from('preset_templates').update(body).eq('id', id).select().single()
  if (error) return serverError(error.message)
  return NextResponse.json(data)
}
