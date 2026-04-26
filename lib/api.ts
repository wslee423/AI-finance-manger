import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// 인증된 사용자 반환 — Route Handler에서 반복되는 인증 코드 추출
export async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
export const serverError = (msg: string) => NextResponse.json({ error: msg }, { status: 500 })
export const badRequest = (msg: string) => NextResponse.json({ error: msg }, { status: 400 })
