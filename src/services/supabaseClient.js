// Supabase 클라이언트 초기화
// 환경변수는 .env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)에서 읽는다.
// 값이 없으면 client는 null이 되고, 상위 service는 세션 State fallback으로 동작한다.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env?.VITE_SUPABASE_URL
const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY

export const DEMO_USER_ID = import.meta.env?.VITE_DEMO_USER_ID || 'demo-user'

// URL/KEY가 모두 있을 때만 실제 클라이언트를 만든다.
export const supabase =
  url && anonKey ? createClient(url, anonKey) : null

// Supabase 사용 가능 여부
export function isSupabaseEnabled() {
  return Boolean(supabase)
}

export default supabase
