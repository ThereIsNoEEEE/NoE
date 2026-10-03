// aiService
// PRD 10장: AI는 요약 / 카테고리 분류 / 대상 조건 해석 / 키워드 추출 / 추천 이유 생성만 담당.
// Opportunity Score와 D-Day는 코드(utils)가 담당한다.
//
// 실제 LLM API 호출을 시도하되, 실패/타임아웃 시 Local Mock Response로 반드시 fallback. (PRD 18장)
// 입력은 공통 포맷으로 정규화된 공지(normalizeNotice 결과)다.

const AI_TIMEOUT_MS = 5000

// 카테고리 추론 규칙 (텍스트 → 관심 분야 매핑)
const CATEGORY_RULES = [
  { category: '장학금', words: ['장학', '근로장학', '국가장학'] },
  { category: '취업', words: ['취업', '채용', '설명회', '모의면접', '직무'] },
  { category: '인턴', words: ['인턴', '산학협력'] },
  { category: '공모전', words: ['공모전', '해커톤', '경진'] },
  { category: 'AI/데이터', words: ['ai', '인공지능', '데이터', 'llm', '생성형', '머신러닝', 'rag', 'langchain'] },
  { category: '특강', words: ['특강', '세미나', '강연', '워크숍'] },
  { category: '대학원', words: ['대학원', '신입생 모집', '원서'] },
  { category: '수강신청', words: ['수강신청', '정정', '수강'] },
  { category: '교환학생', words: ['교환학생', '파견', '해외'] },
  { category: '교내행사', words: ['교내', '캠퍼스', '행사'] },
]

const KEYWORD_POOL = [
  'AI', '데이터', '인턴', '해커톤', '장학금', '취업', '공모전',
  '특강', '대학원', '교환학생', '수강신청', '창업', 'LLM', '머신러닝',
]

function detectCategories(text) {
  const lower = text.toLowerCase()
  const found = []
  for (const rule of CATEGORY_RULES) {
    if (rule.words.some((w) => lower.includes(w.toLowerCase()))) {
      found.push(rule.category)
    }
  }
  return found.length ? Array.from(new Set(found)) : ['교내행사']
}

function detectTarget(text) {
  const lower = text.toLowerCase()
  const target = []
  if (lower.includes('학부') || lower.includes('재학생') || lower.includes('고학년')) {
    target.push('학부')
  }
  if (lower.includes('대학원')) target.push('대학원')
  // 대상 표현이 없으면 모두 대상으로 간주
  return target.length ? Array.from(new Set(target)) : ['학부', '대학원']
}

function detectKeywords(text) {
  const lower = text.toLowerCase()
  const found = KEYWORD_POOL.filter((k) => lower.includes(k.toLowerCase()))
  return Array.from(new Set(found))
}

// 본문/제목에서 "YYYY-MM-DD" 형태의 가장 늦은(마감) 날짜를 추출
function detectDeadline(text) {
  const matches = text.match(/\d{4}-\d{2}-\d{2}/g)
  if (!matches || matches.length === 0) return null
  const sorted = [...matches].sort()
  return sorted[sorted.length - 1]
}

function summarize(notice) {
  const base = (notice.content || notice.title || '').trim()
  // 해시태그 제거 후 첫 문장 사용
  const cleaned = base.replace(/#\S+/g, '').replace(/\s+/g, ' ').trim()
  const firstSentence = cleaned.split(/[.。\n]/)[0]?.trim() || notice.title
  return firstSentence.length > 90 ? `${firstSentence.slice(0, 90)}…` : firstSentence
}

// 규칙 기반 분석 (Local Mock Response). 공통 포맷을 보존하며 분석 필드를 추가한다.
function mockAnalyze(notice) {
  const text = `${notice.title} ${notice.content || ''}`
  return {
    ...notice, // id, title, content, date, url, sourceType, sourceName, sourceBadge 유지
    category: detectCategories(text),
    target: detectTarget(text),
    keywords: detectKeywords(text),
    deadline: detectDeadline(text),
    summary: summarize(notice),
  }
}

function normalizeForMatch(value) {
  return String(value || '').toLowerCase().replace(/[\s/·]+/g, '')
}

// 사용자 프로필 대비 추천 이유 생성 (AI 담당 영역의 mock)
export function buildRecommendationReason(profile, analyzed) {
  const reasons = []
  const interestSet = (profile.interests || []).map(normalizeForMatch)
  const matchedInterests = (analyzed.category || []).filter((c) =>
    interestSet.includes(normalizeForMatch(c))
  )
  if (matchedInterests.length) {
    reasons.push(`관심 분야 '${matchedInterests.join(', ')}'와 일치`)
  }
  const studentType = profile.studentType
  if (studentType && (analyzed.target || []).includes(studentType)) {
    reasons.push(`${studentType} 대상 공지`)
  }
  const keywordSet = (profile.keywords || []).map((k) => k.toLowerCase())
  const matchedKeywords = (analyzed.keywords || []).filter((k) =>
    keywordSet.includes(k.toLowerCase())
  )
  if (matchedKeywords.length) {
    reasons.push(`키워드 '${matchedKeywords.join(', ')}' 포함`)
  }
  if (analyzed.deadline) {
    reasons.push('마감일이 지정되어 있어 놓치기 쉬움')
  }
  return reasons.length ? reasons.join(' · ') : '프로필과 부분적으로 관련된 공지'
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('ai timeout')), ms)),
  ])
}

// 실제 LLM API 호출 자리. 키가 없으면 바로 mock으로 fallback.
async function callRealLLM() {
  throw new Error('LLM API not configured')
}

/**
 * 공지 목록을 분석한다. 실제 AI 실패/타임아웃 시 mock 분석으로 fallback.
 * @param {object[]} notices - 공통 포맷 공지 배열
 * @returns {Promise<{ analyzed: object[], usedMock: boolean }>}
 */
export async function analyzeNotices(notices) {
  try {
    const result = await withTimeout(callRealLLM(notices), AI_TIMEOUT_MS)
    if (!Array.isArray(result) || result.length === 0) {
      throw new Error('empty ai result')
    }
    return { analyzed: result, usedMock: false }
  } catch (err) {
    console.warn('[aiService] AI 호출 실패, Mock Response로 fallback:', err?.message)
    return { analyzed: notices.map(mockAnalyze), usedMock: true }
  }
}

export { mockAnalyze }
export default analyzeNotices
