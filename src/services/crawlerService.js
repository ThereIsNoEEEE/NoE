// crawlerService
// PRD 8장: 국민대학교 지정 공지 게시판만 대상. 전체 사이트 재귀 크롤링 금지.
//
// 데이터 소스 모드 (VITE_DATA_MODE):
//   live (기본) : 로컬 크롤러 API(mobile-android/local-crawler) 사용 → 실제 국민대 공지
//   demo        : sampleNotices 사용 → Score/D-Day/챗봇/캐러셀 데모가 안정적으로 보이는 데이터
//
// 어느 모드든 실패 시 Local Sample Data로 반드시 fallback 한다. (PRD 18장)
// 반환 데이터는 공통 포맷으로 정규화된 상태다.

import { sampleNotices } from '../data/sampleNotices.js'
import { normalizeWebsiteNotice } from '../utils/normalizeNotice.js'

// 로컬 크롤러 API (node server.mjs --port 8000)
const CRAWLER_API =
  import.meta.env?.VITE_CRAWLER_API || 'http://127.0.0.1:8000/api/notices'

// 데이터 모드: 'live' | 'demo' (기본 live)
export function getDataMode() {
  const raw = String(import.meta.env?.VITE_DATA_MODE || 'live').toLowerCase()
  return raw === 'demo' ? 'demo' : 'live'
}

const TIMEOUT_MS = 9000

function withTimeout(ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

// 크롤러 API 응답(공통 수집 포맷)을 normalizeWebsiteNotice 입력 형태로 매핑.
function toRaw(apiNotice) {
  return {
    id: apiNotice.id,
    title: apiNotice.title,
    date: apiNotice.date,
    url: apiNotice.url,
    content: apiNotice.content || '',
    source: apiNotice.sourceName || apiNotice.sourceCollege || '국민대학교',
  }
}

function sampleResult(mode) {
  return {
    notices: sampleNotices.map(normalizeWebsiteNotice),
    usedFallback: true,
    mode,
  }
}

/**
 * 공지를 수집한다.
 *  - demo 모드: sampleNotices를 "의도된 소스"로 사용 (fallback 아님).
 *  - live 모드: 로컬 크롤러 API → 실패 시 sample data fallback.
 * @returns {Promise<{ notices: object[], usedFallback: boolean, mode: 'live'|'demo' }>}
 */
export async function fetchWebsiteNotices() {
  const mode = getDataMode()

  // DEMO: 안정적인 샘플 데이터를 바로 사용 (usedFallback=false — 정상 데모 소스)
  if (mode === 'demo') {
    return {
      notices: sampleNotices.map(normalizeWebsiteNotice),
      usedFallback: false,
      mode: 'demo',
    }
  }

  // LIVE: 로컬 크롤러 API 사용
  const { signal, clear } = withTimeout(TIMEOUT_MS)
  try {
    const res = await fetch(CRAWLER_API, { signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const list = Array.isArray(data?.notices) ? data.notices : []
    if (!list.length) throw new Error('empty crawler result')
    const notices = list.map((n) => normalizeWebsiteNotice(toRaw(n)))
    return { notices, usedFallback: Boolean(data?.usedFallback), mode: 'live' }
  } catch (err) {
    // 크롤러 미실행/실패 → Local Sample Data 자동 fallback
    console.warn('[crawlerService] 로컬 크롤러 수집 실패, 샘플 데이터로 fallback:', err?.message)
    return sampleResult('live')
  } finally {
    clear()
  }
}

export { CRAWLER_API }
export default fetchWebsiteNotices
