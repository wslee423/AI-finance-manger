import { createClient } from '@/lib/supabase/server'
import { getAuthUser, unauthorized, serverError } from '@/lib/api'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const user = await getAuthUser()
  if (!user) return unauthorized()

  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const year = searchParams.get('year')
  const month = searchParams.get('month')

  let query = supabase
    .from('transactions')
    .select('*')
    .is('deleted_at', null)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (year && month) {
    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(Number(year), Number(month), 0).getDate()
    const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`
    query = query.gte('date', from).lte('date', to)
  }

  const { data, error } = await query
  if (error) return serverError(error.message)
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const user = await getAuthUser()
  if (!user) return unauthorized()

  const supabase = await createClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('transactions').insert(body).select().single()

  if (error) return serverError(error.message)
  return NextResponse.json(data, { status: 201 })
}
