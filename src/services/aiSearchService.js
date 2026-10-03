// aiSearchService — AI 공지 탐색 챗봇 (PRD 15장)
// AI 담당: 자연어 질문 의도 분석(검색 조건 구조화) + 검색 결과 요약.
// 코드 담당: 실제 공지 필터링/정렬 (filterNotices).
//
// 실제 LLM 호출을 시도하되, 실패/타임아웃 시 keyword 기반 deterministic 분석으로 fallback. (PRD 15.8)
// AI는 공지를 생성하지 않는다. 결과 요약도 "입력으로 받은 실제 공지"만 사용한다.
import { formatDDay } from '../utils/calculateDDay.js'

const SEARCH_TIMEOUT_MS = 5000

// aiService와 동일한 어휘 체계 (검색 의도 분석용)
const CATEGORY_RULES = [
  { category: '장학금', words: ['장학', '근로장학', '국가장학'] },
  { category: '취업', words: ['취업', '채용', '설명회', '모의면접', '직무'] },
  { category: '인턴', words: ['인턴', '산학협력'] },
  { category: '공모전', words: ['공모전', '해커톤', '경진', '대회'] },
  { category: 'AI/데이터', words: ['ai', '인공지능', '데이터', 'llm', '생성형', '머신러닝', 'rag', 'langchain'] },
  { category: '특강', words: ['특강', '세미나', '강연', '워크숍'] },
  { category: '대학원', words: ['대학원', '원서'] },
  { category: '수강신청', words: ['수강신청', '정정', '수강'] },
  { category: '교환학생', words: ['교환학생', '파견', '해외'] },
  { category: '교내행사', words: ['교내', '캠퍼스', '행사'] },
]

const KEYWORD_POOL = [
  'AI', '데이터', '인턴', '해커톤', '장학금', '취업', '공모전',
  '특강', '대학원', '교환학생', '수강신청', '창업', 'LLM', '머신러닝',
]

// 자연어 → 구조화된 검색 조건 (deterministic). LLM fallback의 핵심.
export function parseQueryToCondition(query) {
  const text = String(query || '')
  const lower = text.toLowerCase()

  const categories = []
  for (const rule of CATEGORY_RULES) {
    if (rule.words.some((w) => lower.includes(w.toLowerCase()))) {
      categories.push(rule.category)
    }
  }

  const keywords = KEYWORD_POOL.filter((k) => lower.includes(k.toLowerCase()))

  // 대상 조건
  let target = null
  if (lower.includes('대학원')) target = '대학원'
  else if (lower.includes('학부') || lower.includes('학부생')) target = '학부'

  // 마감/날짜 조건
  let deadlineFilter = null
  if (
    lower.includes('이번 주') ||
    lower.includes('이번주') ||
    lower.includes('this week')
  ) {
    deadlineFilter = 'this_week'
  } else if (
    lower.includes('마감 안') ||
    lower.includes('마감안') ||
    lower.includes('마감 전') ||
    lower.includes('아직') ||
    lower.includes('안 지난') ||
    lower.includes('안지난') ||
    lower.includes('지나지 않')
  ) {
    deadlineFilter = 'not_expired'
  }

  return {
    categories: Array.from(new Set(categories)),
    keywords: Array.from(new Set(keywords)),
    target,
    deadlineFilter,
  }
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('search timeout')), ms)),
  ])
}

// 실제 LLM 의도 분석 자리. 키 미설정 시 바로 fallback.
async function callRealLLMIntent() {
  throw new Error('LLM API not configured')
}

/**
 * 자연어 질문을 구조화된 검색 조건으로 변환한다.
 * @returns {Promise<{ condition: object, usedFallback: boolean }>}
 */
export async function analyzeQuery(query) {
  try {
    const result = await withTimeout(callRealLLMIntent(query), SEARCH_TIMEOUT_MS)
    if (!result || typeof result !== 'object') throw new Error('empty intent')
    return { condition: result, usedFallback: false }
  } catch (err) {
    console.warn('[aiSearchService] 의도 분석 실패, keyword fallback 사용:', err?.message)
    return { condition: parseQueryToCondition(query), usedFallback: true }
  }
}

// 검색 결과 요약 (실제 결과 공지만 사용, 생성 금지)
function summarizeResultsLocal(results, today) {
  if (!results || results.length === 0) {
    return '현재 조건에 맞는 공지가 없습니다.'
  }
  return results
    .map((n, i) => {
      const dday = formatDDay(n.deadline, today) || '상시/마감 미정'
      const target =
        (n.target && n.target.length ? n.target.join('/') : null) || '대상 확인 필요'
      const core = (n.summary || n.title || '').trim()
      const action = inferAction(n)
      return (
        `${i + 1}. ${n.title}\n` +
        `- 대상: ${target}\n` +
        `- 마감: ${dday}\n` +
        `- 핵심: ${core}\n` +
        `- 해야 할 일: ${action}`
      )
    })
    .join('\n\n')
}

// 공지 카테고리 기반으로 "해야 할 일"을 실제 데이터 범위에서만 추정 (생성 아님)
function inferAction(notice) {
  const cats = notice.category || []
  if (cats.includes('공모전')) return '참가 신청서 제출'
  if (cats.includes('인턴') || cats.includes('취업')) return '이력서 및 지원서 제출'
  if (cats.includes('장학금')) return '장학금 신청서 제출'
  if (cats.includes('특강')) return '사전 신청'
  if (cats.includes('교환학생')) return '서류 접수'
  if (cats.includes('대학원')) return '원서 접수'
  if (cats.includes('수강신청')) return '수강신청 기간 확인'
  return '공지 원문에서 신청 방법 확인'
}

// ---------- 공지 실행 비서 (Action Assistant) ----------
// 공지 본문/카테고리/키워드에 "실제로 등장하는 단서"만으로 준비물/체크리스트를 구성한다.
// 근거가 없으면 생성하지 않고 '공지 원문 확인 필요'로 표시한다.

// 본문에서 단서가 되는 표현 → 준비물
const PREP_RULES = [
  { label: '포트폴리오', words: ['포트폴리오'] },
  { label: '이력서', words: ['이력서'] },
  { label: '지원서', words: ['지원서', '지원 서류', '신청서'] },
  { label: '자기소개서', words: ['자기소개서', '자소서'] },
  { label: '어학성적', words: ['어학', '토익', 'toeic', 'ielts', '토플'] },
  { label: '학점/성적 증빙', words: ['학점', '성적'] },
  { label: '팀 구성(2인 이상)', words: ['팀', '팀원', '팀 단위', '2~4명', '2-4명'] },
  { label: '아이디어/기획안', words: ['아이디어', '기획', '제안서'] },
  { label: '원서', words: ['원서'] },
]

// 공지 본문/제목에서 실제로 언급된 준비물만 추출 (생성 금지)
function extractPreparations(notice) {
  const text = `${notice.title || ''} ${notice.content || ''}`.toLowerCase()
  const found = []
  for (const rule of PREP_RULES) {
    if (rule.words.some((w) => text.includes(w.toLowerCase()))) {
      found.push(rule.label)
    }
  }
  return Array.from(new Set(found))
}

// 체크리스트: 공지에 근거가 있을 때만 항목을 넣는다. 근거 없으면 안내 항목만.
function buildChecklist(notice) {
  const cats = notice.category || []
  const preps = extractPreparations(notice)
  const items = []

  // 1) 신청/참가 액션 (카테고리에 근거)
  if (cats.includes('공모전')) items.push('참가 신청서 작성')
  else if (cats.includes('인턴') || cats.includes('취업')) items.push('지원서 작성')
  else if (cats.includes('장학금')) items.push('장학금 신청서 작성')
  else if (cats.includes('특강')) items.push('특강 사전 신청')
  else if (cats.includes('교환학생')) items.push('파견 지원 서류 작성')
  else if (cats.includes('대학원')) items.push('입학 원서 작성')
  else if (cats.includes('수강신청')) items.push('수강신청 일정 확인')

  // 2) 준비물 기반 액션 (본문에 실제 언급된 것만)
  for (const p of preps) {
    items.push(`${p} 준비`)
  }

  // 3) 마감 전 제출 (마감일이 있을 때만)
  if (notice.deadline) items.push('마감 전 최종 제출')

  // 근거가 전혀 없으면 임의 생성 대신 원문 확인 안내
  if (items.length === 0) {
    return ['공지 원문 확인 필요']
  }
  return items
}

/**
 * 공지 실행 비서 데이터 생성. 실제 공지 데이터에 근거한 항목만 사용한다.
 * @returns {Array} 공지별 실행 정리 객체 배열
 */
export function buildActionPlan(results, today = new Date()) {
  if (!results || results.length === 0) return []
  return results.map((n) => {
    const preps = extractPreparations(n)
    return {
      id: n.id,
      title: n.title,
      // 대상이 불명확하면 '공지 원문 확인 필요'
      target: n.target && n.target.length ? n.target.join(' / ') : '공지 원문 확인 필요',
      deadline: n.deadline || null,
      dday: formatDDay(n.deadline, today),
      core: (n.summary || n.title || '').trim(),
      // 준비물이 본문에 없으면 임의 생성하지 않고 안내
      preparations: preps.length ? preps : ['공지 원문 확인 필요'],
      checklist: buildChecklist(n),
      url: n.url || null,
    }
  })
}

async function callRealLLMSummary() {
  throw new Error('LLM API not configured')
}

/**
 * 검색 결과를 정리/요약한다. 실패 시 로컬 요약으로 fallback.
 * @returns {Promise<{ summary: string, usedFallback: boolean }>}
 */
export async function summarizeResults(results, today = new Date()) {
  try {
    const result = await withTimeout(callRealLLMSummary(results), SEARCH_TIMEOUT_MS)
    if (!result || typeof result !== 'string') throw new Error('empty summary')
    return { summary: result, usedFallback: false }
  } catch (err) {
    console.warn('[aiSearchService] 결과 요약 실패, 로컬 요약 사용:', err?.message)
    return { summary: summarizeResultsLocal(results, today), usedFallback: true }
  }
}

export { summarizeResultsLocal, inferAction }
