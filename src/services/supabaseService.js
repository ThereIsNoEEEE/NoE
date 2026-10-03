// supabaseService
// 사용자 프로필 + 사용자 관심 분야를 Supabase DB에 저장/조회한다.
// 모든 함수는 실패해도 throw하지 않고 { ok, data?, error? } 형태로 결과를 반환하여
// Dashboard와 추천 기능이 중단되지 않도록 한다. (PRD 18장: DB 실패 fallback)
//
// 테이블:
//   user_profiles(id, student_type, school, major, grade, keywords, created_at, updated_at)
//   user_interests(id, user_id, interest_name, is_custom, created_at)
import { supabase, isSupabaseEnabled, DEMO_USER_ID } from './supabaseClient.js'

const DISABLED = { ok: false, disabled: true, error: 'supabase_disabled' }

// --- 프로필 ---

// DB row(snake_case) → 앱 프로필(camelCase)
function rowToProfile(row) {
  if (!row) return null
  return {
    studentType: row.student_type || '',
    school: row.school || '',
    major: row.major || '',
    grade: row.grade || '',
    keywordsText: Array.isArray(row.keywords)
      ? row.keywords.join(', ')
      : row.keywords || '',
  }
}

// 앱 프로필 → DB row
function profileToRow(profile) {
  return {
    id: DEMO_USER_ID,
    student_type: profile.studentType || '',
    school: profile.school || '',
    major: profile.major || '',
    grade: profile.grade || '',
    keywords: (profile.keywordsText || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    updated_at: new Date().toISOString(),
  }
}

export async function fetchProfile() {
  if (!isSupabaseEnabled()) return DISABLED
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', DEMO_USER_ID)
      .maybeSingle()
    if (error) throw error
    return { ok: true, data: rowToProfile(data) }
  } catch (error) {
    console.warn('[supabaseService] fetchProfile 실패:', error?.message)
    return { ok: false, error: error?.message || 'fetch_profile_failed' }
  }
}

export async function saveProfile(profile) {
  if (!isSupabaseEnabled()) return DISABLED
  try {
    const row = profileToRow(profile)
    const { error } = await supabase
      .from('user_profiles')
      .upsert(row, { onConflict: 'id' })
    if (error) throw error
    return { ok: true }
  } catch (error) {
    console.warn('[supabaseService] saveProfile 실패:', error?.message)
    return { ok: false, error: error?.message || 'save_profile_failed' }
  }
}

// --- 관심 분야 ---

export async function fetchInterests() {
  if (!isSupabaseEnabled()) return DISABLED
  try {
    const { data, error } = await supabase
      .from('user_interests')
      .select('interest_name, is_custom')
      .eq('user_id', DEMO_USER_ID)
      .order('created_at', { ascending: true })
    if (error) throw error
    const custom = (data || [])
      .filter((r) => r.is_custom)
      .map((r) => r.interest_name)
    const selected = (data || []).map((r) => r.interest_name)
    return { ok: true, data: { custom, selected } }
  } catch (error) {
    console.warn('[supabaseService] fetchInterests 실패:', error?.message)
    return { ok: false, error: error?.message || 'fetch_interests_failed' }
  }
}

export async function addInterest(name, isCustom = true) {
  if (!isSupabaseEnabled()) return DISABLED
  try {
    const { error } = await supabase.from('user_interests').insert({
      user_id: DEMO_USER_ID,
      interest_name: name,
      is_custom: isCustom,
    })
    if (error) throw error
    return { ok: true }
  } catch (error) {
    console.warn('[supabaseService] addInterest 실패:', error?.message)
    return { ok: false, error: error?.message || 'add_interest_failed' }
  }
}

export async function removeInterest(name) {
  if (!isSupabaseEnabled()) return DISABLED
  try {
    const { error } = await supabase
      .from('user_interests')
      .delete()
      .eq('user_id', DEMO_USER_ID)
      .eq('interest_name', name)
    if (error) throw error
    return { ok: true }
  } catch (error) {
    console.warn('[supabaseService] removeInterest 실패:', error?.message)
    return { ok: false, error: error?.message || 'remove_interest_failed' }
  }
}

export { DEMO_USER_ID }
