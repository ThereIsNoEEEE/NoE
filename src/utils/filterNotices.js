// filterNotices — 코드 담당 (PRD 10장, 15.2장)
// AI가 만든 structured search condition으로 실제 공지 데이터를 필터링/정렬한다.
// AI는 공지를 생성하지 않으며, 여기서는 입력으로 받은 실제 공지만 다룬다.
import { calculateDDay } from './calculateDDay.js'

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[\s/·]+/g, '')
}

// deadlineFilter 해석: this_week / not_expired / null
function matchesDeadline(notice, deadlineFilter, today) {
  if (!deadlineFilter) return true
  const dday = calculateDDay(notice.deadline, today)
  if (deadlineFilter === 'not_expired') {
    // 마감 없음(null)도 "지나지 않음"으로 간주
    return dday === null || dday >= 0
  }
  if (deadlineFilter === 'this_week') {
    // 오늘부터 7일 이내 마감 (이미 지난 것 제외)
    return dday !== null && dday >= 0 && dday <= 7
  }
  return true
}

// 조건별 관련도 점수(검색 전용). Opportunity Score와는 별개의 매칭 점수.
function relevanceScore(notice, condition) {
  const cats = (notice.category || []).map(normalize)
  const kws = (notice.keywords || []).map(normalize)
  const haystack = normalize(`${notice.title} ${notice.content || ''}`)
  let score = 0

  for (const c of condition.categories || []) {
    if (cats.includes(normalize(c))) score += 3
  }
  for (const k of condition.keywords || []) {
    const nk = normalize(k)
    if (kws.includes(nk)) score += 3
    else if (nk && haystack.includes(nk)) score += 2 // 본문/제목 포함
  }
  if (condition.target) {
    if ((notice.target || []).includes(condition.target)) score += 2
  }
  return score
}

// 조건에 "매칭"되는지 (하나 이상 핵심 조건을 만족)
function matchesCondition(notice, condition, today) {
  if (!matchesDeadline(notice, condition.deadlineFilter, today)) return false

  if (condition.target) {
    const targets = notice.target || []
    if (!targets.includes(condition.target)) return false
  }

  const hasCat = (condition.categories || []).length > 0
  const hasKw = (condition.keywords || []).length > 0

  // 카테고리/키워드 조건이 전혀 없으면 (마감/대상 조건만) 통과
  if (!hasCat && !hasKw) return true

  const cats = (notice.category || []).map(normalize)
  const kws = (notice.keywords || []).map(normalize)
  const haystack = normalize(`${notice.title} ${notice.content || ''}`)

  const catHit = (condition.categories || []).some((c) => cats.includes(normalize(c)))
  const kwHit = (condition.keywords || []).some((k) => {
    const nk = normalize(k)
    return nk && (kws.includes(nk) || haystack.includes(nk))
  })

  // 카테고리 또는 키워드 중 하나라도 맞으면 매칭 (OR)
  return catHit || kwHit
}

/**
 * 실제 공지 목록을 검색 조건으로 필터링하고 관련도 순으로 정렬한다.
 * @param {object[]} notices - 분석/점수 포함 공지 (실제 데이터만)
 * @param {object} condition - { categories, keywords, target, deadlineFilter }
 * @param {string|Date} today
 * @param {number} limit - 최대 결과 수 (기본 5)
 * @returns {object[]} 필터링+정렬된 공지 (relevance 필드 포함)
 */
export function filterNotices(notices, condition = {}, today = new Date(), limit = 5) {
  const matched = (notices || [])
    .filter((n) => matchesCondition(n, condition, today))
    .map((n) => ({ ...n, relevance: relevanceScore(n, condition) }))

  matched.sort((a, b) => {
    // 1차 관련도, 2차 Opportunity Score(있으면), 3차 마감 임박
    if (b.relevance !== a.relevance) return b.relevance - a.relevance
    const sa = a.score ?? 0
    const sb = b.score ?? 0
    if (sb !== sa) return sb - sa
    const da = calculateDDay(a.deadline, today)
    const db = calculateDDay(b.deadline, today)
    const va = da === null ? Infinity : da < 0 ? Infinity : da
    const vb = db === null ? Infinity : db < 0 ? Infinity : db
    return va - vb
  })

  return matched.slice(0, limit)
}

export { matchesCondition, relevanceScore }
export default filterNotices
