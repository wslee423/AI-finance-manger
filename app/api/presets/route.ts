import { createClient } from '@/lib/supabase/server'
import { getAuthUser, unauthorized, serverError } from '@/lib/api'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const user = await getAuthUser()
  if (!user) return unauthorized()

  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const activeOnly = searchParams.get('active') !== 'false'

  let query = supabase.from('preset_templates').select('*').order('sort_order')
  if (activeOnly) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) return serverError(error.message)
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const user = await getAuthUser()
  if (!user) return unauthorized()

  const supabase = await createClient()
  const body = await request.json()

  const { data, error } = await supabase.from('preset_templates').insert(body).select().single()
  if (error) return serverError(error.message)
  return NextResponse.json(data, { status: 201 })
}
