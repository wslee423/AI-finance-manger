import { createClient } from '@/lib/supabase/server'
import { getAuthUser, unauthorized, serverError, badRequest } from '@/lib/api'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const user = await getAuthUser()
  if (!user) return unauthorized()

  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const year = searchParams.get('year')

  let query = supabase.from('dividend').select('*').order('date', { ascending: false })
  if (year) query = query.gte('date', `${year}-01-01`).lte('date', `${year}-12-31`)

  const { data, error } = await query
  if (error) return serverError(error.message)
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const user = await getAuthUser()
  if (!user) return unauthorized()

  const supabase = await createClient()
  const body = await request.json()

  if (!body.krw_amount || body.krw_amount <= 0) return badRequest('krw_amount는 양수여야 합니다')

  const { data, error } = await supabase.from('dividend').insert(body).select().single()
  if (error) return serverError(error.message)
  return NextResponse.json(data, { status: 201 })
}
