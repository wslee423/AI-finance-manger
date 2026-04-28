import { createClient } from '@supabase/supabase-js'

// Service Role 클라이언트 — RLS 우회. 서버 전용.
// 외부 인증(웹: getAuthUser, 텔레그램: chat_id 허용 목록)에서 이미 접근 제어됨.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
