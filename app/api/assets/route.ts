import { createClient } from '@/lib/supabase/server'
import { getAuthUser, unauthorized, serverError } from '@/lib/api'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const user = await getAuthUser()
  if (!user) return unauthorized()

  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')

  let query = supabase.from('assets').select('*').order('asset_type')

  if (!date || date === 'latest') {
    const { data: latest } = await supabase
      .from('assets').select('snapshot_date').order('snapshot_date', { ascending: false }).limit(1).single()
    if (latest) query = query.eq('snapshot_date', latest.snapshot_date)
  } else {
    const [year, month] = date.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    query = query.eq('snapshot_date', `${date}-${String(lastDay).padStart(2, '0')}`)
  }

  const { data, error } = await query
  if (error) return serverError(error.message)
  return NextResponse.json(data)
}
