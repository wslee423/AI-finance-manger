import { createClient } from '@/lib/supabase/server'
import { getAuthUser, unauthorized, serverError, badRequest } from '@/lib/api'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const user = await getAuthUser()
  if (!user) return unauthorized()

  const supabase = await createClient()
  const { items } = await request.json() as { items: Record<string, unknown>[] }

  if (!Array.isArray(items) || items.length === 0) return badRequest('items 배열이 필요합니다')

  const { data, error } = await supabase.from('transactions').insert(items).select()
  if (error) return serverError(error.message)
  return NextResponse.json(data, { status: 201 })
}
