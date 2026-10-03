// KMU Pick AI — Local Crawler Server
// 국민대학교 단과대학 공지 페이지를 수집해 프론트엔드가 쓸 JSON API로 제공한다.
//
// 실행: node server.mjs --port 8000
// API:  GET /api/notices  ->  { success, count, notices: [...] }
//
// 원칙 (PRD 8/18장):
//  - 지정한 공지 게시판만 요청. 전체 사이트 재귀 크롤링/로그인/인증 페이지 접근 금지.
//  - source별 parser 분리. 한 사이트 실패가 전체 API 실패로 이어지지 않음.
//  - timeout 적용, 과도한 요청 금지.
//  - 상대 URL → 절대 URL 변환, URL/title+date 기준 중복 제거, 최신순 정렬.
//  - 전체 실패 또는 0건이면 local sample notices로 fallback.
//  - Instagram/SNS 크롤링하지 않음.

import http from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ---------- 설정 ----------
const LIST_TIMEOUT_MS = 8000
const DETAIL_TIMEOUT_MS = 7000
const DETAIL_LIMIT_PER_SOURCE = 5 // 상세 본문은 상위 N개만 (과도한 요청 방지)
// 기준일/컷오프: 기준 2026-10-03, 최근 약 93일 → 2026-07-02 이전 제외
const BASE_DATE = '2026-10-03'
const CUTOFF_DATE = '2026-07-02' // 이 날짜 이전(미포함)은 제외
const MAX_PAGES_PER_SOURCE = 8 // pagination 최대 페이지 (과도한 요청 방지)
const MAX_ITEMS_PER_SOURCE = 60 // source당 상한 (안전장치)
const DETAIL_DELAY_MS = 120 // 상세 요청 간 간격 (과도한 요청 방지)
const USER_AGENT =
  'KMUPickAI-LocalCrawler/1.0 (hackathon demo; respects public pages)'

function parseYmd(s) {
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}
const CUTOFF = parseYmd(CUTOFF_DATE)

// 날짜가 컷오프(2026-07-02) 이상인가? (오래된 공지 판별)
function isWithinRange(dateStr) {
  const d = parseYmd(dateStr)
  if (!d) return null // 판별 불가
  return d >= CUTOFF
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 수집 대상 (국민대학교 16개 단과대학 공지 페이지)
// .do URL은 parseKmuBoardDo, 그 외는 parseKmuListGeneric(<tr>/<li> 모두 지원).
const SOURCES = [
  {
    key: 'humanities',
    sourceCollege: '글로벌인문·지역대학',
    sourceDepartments: ['한국어문학부', '영어영문학부', '중어중문학과', '한국역사학과'],
    sourceName: '국민대학교 글로벌인문·지역대학',
    listUrl: 'https://humanities.kookmin.ac.kr/humanities/notice/notice_college.do',
    parser: parseKmuBoardDo,
  },
  {
    key: 'social',
    sourceCollege: '사회과학대학',
    sourceDepartments: [
      '행정학과', '정치외교학과', '사회학과', '미디어·광고학부', '교육학과',
      '러시아·유라시아학과', '동아시아국제학부', '글로벌기후환경융합학부', '글로벌공생융합학부',
    ],
    sourceName: '국민대학교 사회과학대학',
    listUrl: 'https://social.kookmin.ac.kr/social/menu/social_notice.do',
    parser: parseKmuBoardDo,
  },
  {
    key: 'law',
    sourceCollege: '법과대학',
    sourceDepartments: ['법학부', '기업융합법학과'],
    sourceName: '국민대학교 법과대학',
    listUrl: 'https://law.kookmin.ac.kr/law/etc-board/notice01.do',
    parser: parseKmuBoardDo,
  },
  {
    key: 'kyungsang',
    sourceCollege: '경상대학',
    sourceDepartments: ['경제학과', '국제통상학과'],
    sourceName: '국민대학교 경상대학',
    listUrl: 'https://kyungsang.kookmin.ac.kr/community/board/notice/',
    parser: parseKmuListGeneric,
  },
  {
    key: 'eng',
    sourceCollege: '공과대학',
    sourceDepartments: ['신소재공학부', '기계공학부', '건설시스템공학부', '전자공학부', '양자보안차세대통신학부'],
    sourceName: '국민대학교 공과대학',
    listUrl: 'https://engineering.kookmin.ac.kr/engineering/etc-board/eng-notice.do',
    parser: parseKmuBoardDo,
  },
  {
    key: 'design',
    sourceCollege: '조형대학',
    sourceDepartments: [
      '공업디자인학과', '시각디자인학과', '금속공예학과', '도자공예학과', '의상디자인학과',
      '공간디자인학과', '영상디자인학과', '자동차·운송디자인학과', 'AI디자인학과',
    ],
    sourceName: '국민대학교 조형대학',
    listUrl: 'https://design.kookmin.ac.kr/community/notice/',
    parser: parseKmuListGeneric,
  },
  {
    key: 'cst',
    sourceCollege: '과학기술대학',
    sourceDepartments: [
      '산림환경시스템학과', '임산생명공학과', '나노전자물리학과', '응용화학부',
      '식품영양학과', '정보보안암호수학과', '융합바이오공학과',
    ],
    sourceName: '국민대학교 과학기술대학',
    listUrl: 'https://cst.kookmin.ac.kr/community/notice/',
    parser: parseKmuListGeneric,
  },
  {
    key: 'art',
    sourceCollege: '예술대학',
    sourceDepartments: ['음악학부', '미술학부', '공연예술학부'],
    sourceName: '국민대학교 예술대학',
    listUrl: 'https://art.kookmin.ac.kr/community/notice/',
    parser: parseKmuListGeneric,
  },
  {
    key: 'sport',
    sourceCollege: '체육대학',
    sourceDepartments: ['스포츠교육학과', '스포츠산업레저학과', '스포츠건강재활학과'],
    sourceName: '국민대학교 체육대학',
    listUrl: 'https://sport.kookmin.ac.kr/sports/notice/notice01.do',
    parser: parseKmuBoardDo,
  },
  {
    key: 'biz',
    sourceCollege: '경영대학',
    sourceDepartments: ['경영학부', '경영정보학부', 'AI빅데이터융합경영학과', '기업경영학부', '회계세무학과'],
    sourceName: '국민대학교 경영대학',
    listUrl: 'https://biz.kookmin.ac.kr/community/notice/',
    parser: parseKmuListGeneric,
  },
  {
    key: 'cs',
    sourceCollege: '소프트웨어융합대학',
    sourceDepartments: ['소프트웨어학부', '인공지능학부'],
    sourceName: '국민대학교 소프트웨어융합대학',
    listUrl: 'https://cs.kookmin.ac.kr/news/notice/',
    parser: parseKmuListGeneric,
  },
  {
    key: 'archi',
    sourceCollege: '건축대학',
    sourceDepartments: ['건축학부'],
    sourceName: '국민대학교 건축대학',
    listUrl: 'https://archi.kookmin.ac.kr/life/notice/',
    parser: parseKmuNumericList,
  },
  {
    key: 'auto',
    sourceCollege: '자동차모빌리티대학',
    sourceDepartments: ['자동차공학과', '자동차IT융합학과', '미래자동차학부', '미래모빌리티학과', '전공자율선택'],
    sourceName: '국민대학교 자동차모빌리티대학',
    listUrl: 'https://auto.kookmin.ac.kr/board/notice/',
    parser: parseKmuNumericList,
  },
  {
    key: 'cts',
    sourceCollege: '미래융합대학',
    sourceDepartments: ['인문기술융합학부'],
    sourceName: '국민대학교 미래융합대학',
    listUrl: 'https://kmu-cts.kookmin.ac.kr/kmu-cts/etc/sitemap016.do',
    parser: parseKmuBoardDo,
  },
  {
    key: 'kibs',
    sourceCollege: 'KMU International Business School',
    sourceDepartments: ['KMU International Business School', 'International Business'],
    sourceName: '국민대학교 KIBS',
    listUrl: 'https://kibs.kookmin.ac.kr/notice/',
    parser: parseKmuNumericList,
  },
  {
    key: 'culture',
    sourceCollege: '교양대학',
    sourceDepartments: ['기초교양', '핵심교양', '자유교양'],
    sourceName: '국민대학교 교양대학',
    listUrl: 'https://culture.kookmin.ac.kr/community/notice/',
    parser: parseKmuListGeneric,
  },
]

// ---------- 유틸 ----------
function withTimeout(ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

async function fetchText(url, timeoutMs) {
  const { signal, clear } = withTimeout(timeoutMs)
  try {
    const res = await fetch(url, {
      signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' },
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clear()
  }
}

function toAbsolute(href, base) {
  try {
    return new URL(href, base).href
  } catch {
    return href
  }
}

// 목록 이동용 파라미터 제거, 게시물 식별 파라미터는 유지한 canonical URL.
// 제거: page, pageIndex, pn, article.offset, articleLimit, offset, limit, startPage ...
// 유지: articleNo, idx, seq, no, bno, nttId, boardSeq 등
const LIST_NAV_PARAMS = new Set([
  'page', 'pageindex', 'pageno', 'pn', 'cpage', 'curpage', 'startpage',
  'article.offset', 'articleoffset', 'articlelimit', 'offset', 'limit',
  'rows', 'perpage', 'listscale', 'pagesize',
])

function canonicalizeUrl(rawUrl) {
  try {
    const u = new URL(rawUrl)
    const keep = []
    for (const [k, v] of u.searchParams.entries()) {
      if (LIST_NAV_PARAMS.has(k.toLowerCase())) continue
      keep.push([k, v])
    }
    u.search = ''
    for (const [k, v] of keep) u.searchParams.append(k, v)
    return u.href
  } catch {
    return rawUrl
  }
}

// URL에서 게시물 번호(ID)를 추출한다. 예:
//  .../notice/12465           -> 12465
//  ...?articleNo=5940720&...  -> 5940720
//  ...?idx=123, seq=, no=, nttId= 등
function extractArticleId(rawUrl) {
  try {
    const u = new URL(rawUrl)
    const q = u.searchParams
    const paramKeys = ['articleNo', 'idx', 'seq', 'no', 'bno', 'nttId', 'boardSeq', 'bbsSeq']
    for (const k of paramKeys) {
      const found = [...q.keys()].find((x) => x.toLowerCase() === k.toLowerCase())
      if (found && /^\d+$/.test(q.get(found))) return q.get(found)
    }
    // path 끝의 숫자 (/notice/12465)
    const m = u.pathname.match(/(\d{2,})\/?$/)
    if (m) return m[1]
  } catch {
    /* ignore */
  }
  return ''
}

// HTML 엔티티 디코드 (명명 + 숫자 + &rarr;, &middot; 등 폭넓게)
const NAMED_ENTITIES = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  rarr: '→', larr: '←', uarr: '↑', darr: '↓', harr: '↔',
  middot: '·', bull: '•', hellip: '…', ndash: '–', mdash: '—',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', copy: '©',
  reg: '®', trade: '™', deg: '°', times: '×', divide: '÷',
  laquo: '«', raquo: '»', sim: '~', prime: '′', Prime: '″',
}

function decodeEntitiesRaw(s) {
  return String(s || '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, name) =>
      Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name)
        ? NAMED_ENTITIES[name]
        : m
    )
}

// 공백 1줄 정규화 텍스트 (제목/짧은 텍스트용)
function stripTags(html) {
  return decodeEntitiesRaw(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeEntities(s) {
  return decodeEntitiesRaw(s).replace(/\s+/g, ' ').trim()
}

// 본문용: 문단/표 구분을 보존하며 텍스트화 (길이 제한 없음)
function htmlToStructuredText(html) {
  if (!html) return ''
  let s = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
  // 줄바꿈/문단/표 구분을 개행으로 치환
  s = s
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(p|div|li|tr|h[1-6])\s*>/gi, '\n')
    .replace(/<\/\s*td\s*>/gi, '\t')
    .replace(/<\s*li[^>]*>/gi, '• ')
  s = s.replace(/<[^>]+>/g, '')
  s = decodeEntitiesRaw(s)
  // 과한 공백 정리하되 개행/탭은 보존
  return s
    .replace(/[ \u00a0]{2,}/g, ' ')
    .replace(/\t{2,}/g, '\t')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// 문자열에서 YYYY-MM-DD / YYYY.MM.DD / YYYY. MM. DD 형태 날짜 추출 → YYYY-MM-DD
function extractDate(text) {
  if (!text) return ''
  const m = text.match(/(\d{4})[.\-/\s]+(\d{1,2})[.\-/\s]+(\d{1,2})/)
  if (!m) return ''
  const [, y, mo, d] = m
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const NAV_TITLES = /^(이전|다음|목록|처음|마지막|더보기|prev|next|list|more)$/i

// 상세 글 링크로 보이는 href만 통과 (카테고리/네비 링크 제외)
function looksLikeArticleHref(href) {
  if (!href || href === '#' || /^javascript:/i.test(href)) return false
  if (/^(mailto:|tel:)/i.test(href)) return false
  // 숫자 id(/5663, ?articleNo=, view 등) 또는 상세 패턴
  return (
    /\/\d{2,}(?:[/?#]|$)/.test(href) ||
    /articleno=/i.test(href) ||
    /mode=view/i.test(href) ||
    /(?:idx|seq|no|bno|nttid)=\d+/i.test(href)
  )
}

// <a ...>…</a> 블록을 행(row) 단위로 훑는 범용 파서.
// 1차: 테이블 <tr>, 2차: 리스트 <li> 구조를 모두 지원한다.
function parseKmuListGeneric(html, base) {
  const items = []

  const pushFromBlock = (block) => {
    const linkMatch = block.match(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)
    if (!linkMatch) return
    const href = decodeEntities(linkMatch[1])
    const title = decodeEntities(stripTags(linkMatch[2]))
    if (!title || title.length < 2) return
    if (NAV_TITLES.test(title)) return
    if (!looksLikeArticleHref(href)) return
    const date = extractDate(stripTags(block))
    items.push({ title, url: toAbsolute(href, base), date })
  }

  // 1차: 테이블 행
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) || []
  for (const row of rows) pushFromBlock(row)

  // 2차: 리스트 항목 (table이 비었을 때)
  if (items.length === 0) {
    const lis = html.match(/<li[\s\S]*?<\/li>/gi) || []
    for (const li of lis) pushFromBlock(li)
  }

  return items
}

// 국민대 .do 게시판(목록 테이블 구조)용 파서. 범용 파서와 유사하되
// b-title / td.title 등 흔한 클래스도 함께 시도한다.
function parseKmuBoardDo(html, base) {
  const items = parseKmuListGeneric(html, base)
  if (items.length) return items
  // fallback: 제목 링크 클래스 기반
  const out = []
  const re =
    /<a[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*(?:b-title|title)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = re.exec(html))) {
    const title = decodeEntities(stripTags(m[2]))
    if (!title) continue
    out.push({ title, url: toAbsolute(m[1], base), date: '' })
  }
  return out
}

// 숫자 ID 상대경로 게시판 전용 파서 (건축대학/자동차모빌리티/KIBS).
// 목록 링크가 <a href="87">제목...</a> 처럼 순수 숫자 상대경로이고,
// 제목 앞/안에 2026.10.02 형태 날짜가 섞여 있는 경우를 처리한다.
function parseKmuNumericList(html, base) {
  const items = []
  const seen = new Set()
  // <li> 또는 <tr> 블록 단위로 훑고, 숫자 href 링크를 찾는다.
  const blocks =
    (html.match(/<li[\s\S]*?<\/li>/gi) || []).concat(
      html.match(/<tr[\s\S]*?<\/tr>/gi) || []
    )
  const scanBlock = (block) => {
    const linkMatch = block.match(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)
    if (!linkMatch) return
    const hrefRaw = decodeEntities(linkMatch[1]).trim()
    // 순수 숫자 또는 ./숫자, 숫자?… 형태만 상세글로 인정
    if (!/^\.?\/?\d{1,}(?:[/?#].*)?$/.test(hrefRaw)) return
    let title = decodeEntities(stripTags(linkMatch[2]))
    if (!title || title.length < 3) return
    if (NAV_TITLES.test(title)) return
    // 블록 전체(또는 제목)에서 날짜 추출
    const date = extractDate(stripTags(block)) || extractDate(title)
    // 제목 앞 공지/날짜 토큰 정리: "공지 ...", "2026.10.02 ..." 제거
    title = title
      .replace(/^공지\s*/, '')
      .replace(/\b\d{4}[.\-/]\s?\d{1,2}[.\-/]\s?\d{1,2}\b/g, '')
      .replace(/No\.\s*\d+/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!title) return
    const url = toAbsolute(hrefRaw, base)
    if (seen.has(url)) return
    seen.add(url)
    items.push({ title, url, date })
  }
  for (const b of blocks) scanBlock(b)
  return items
}

// 특정 class/id의 요소 블록을 여는 태그~닫는 태그까지 균형 맞춰 추출.
// 중첩 div를 고려해 depth 카운팅. 못 찾으면 null.
function extractElementByAttr(html, attrRegexSrc) {
  const openRe = new RegExp(
    `<(div|section|article|td)\\b[^>]*(?:${attrRegexSrc})[^>]*>`,
    'i'
  )
  const m = openRe.exec(html)
  if (!m) return null
  const tag = m[1]
  const start = m.index
  const afterOpen = openRe.lastIndex || start + m[0].length
  // depth 균형 맞추기
  const tagRe = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi')
  tagRe.lastIndex = afterOpen
  let depth = 1
  let tm
  while ((tm = tagRe.exec(html))) {
    if (tm[1] === '/') depth -= 1
    else depth += 1
    if (depth === 0) {
      return html.slice(afterOpen, tm.index)
    }
  }
  return html.slice(afterOpen) // 닫는 태그 못 찾으면 끝까지
}

// 사이트별 실제 상세 본문 영역 선택자 (메뉴/네비가 아닌 본문).
// 국민대 CMS 실제 본문은 fr-view / b-content-box 안에 있다. (LNB가 b-content를 쓰므로 우선순위 중요)
const BODY_ATTR_CANDIDATES = [
  'class=["\'][^"\']*fr-view[^"\']*["\']',
  'class=["\'][^"\']*b-content-box[^"\']*["\']',
  'class=["\'][^"\']*(?:se-contents|xe_content|board_view|view-content|content-view|view-con|view_cont)[^"\']*["\']',
  'class=["\'][^"\']*(?:board-view|bbs-view|detail-view|notice-view|post-content|article-content)[^"\']*["\']',
  'id=["\'][^"\']*(?:bo_v_con|articleContent|view_content|boardContents)[^"\']*["\']',
]

// 특정 요소를 찾되, 메뉴/LNB/네비 컨테이너(data-cms-content, lnb, gnb, snb)는 건너뛴다.
function extractBodyHtml(html) {
  for (const attr of BODY_ATTR_CANDIDATES) {
    // 같은 패턴이 여러 번 등장할 수 있으므로 순차 탐색하며 LNB를 skip
    let searchFrom = 0
    for (let guard = 0; guard < 6; guard += 1) {
      const sliceHtml = html.slice(searchFrom)
      const block = extractElementByAttr(sliceHtml, attr)
      if (block === null) break
      // 매칭된 여는 태그의 끝 위치를 추정해 다음 탐색 시작점 이동
      const openIdx = sliceHtml.search(
        new RegExp(`<(div|section|article|td)\\b[^>]*(?:${attr})[^>]*>`, 'i')
      )
      const nextFrom = searchFrom + (openIdx >= 0 ? openIdx + 1 : sliceHtml.length)

      // LNB/메뉴 컨테이너 여부: 여는 태그 부분을 확인
      const openTagMatch = sliceHtml
        .slice(openIdx)
        .match(/<(?:div|section|article|td)\b[^>]*>/i)
      const openTag = openTagMatch ? openTagMatch[0] : ''
      const isNav = /(?:lnb|gnb|snb|data-cms-content|menu|nav)/i.test(openTag)

      if (!isNav) {
        const text = stripTags(block)
        const linkCount = (block.match(/<a\b/gi) || []).length
        if (text && text.length >= 10 && !(linkCount > 8 && text.length < 120)) {
          return block
        }
      }
      searchFrom = nextFrom
    }
  }
  return ''
}

// 이미지 URL 추출
function extractImages(bodyHtml, base) {
  const imgs = []
  const re = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi
  let m
  while ((m = re.exec(bodyHtml))) {
    const src = m[1]
    if (/^data:/i.test(src)) continue
    if (/(blank|spacer|icon_|btn_|bullet)/i.test(src)) continue // 장식 이미지 제외
    imgs.push(toAbsolute(src, base))
  }
  return Array.from(new Set(imgs))
}

// 첨부파일 링크/파일명 추출 (다운로드 링크 또는 파일 확장자)
function extractAttachments(html, base) {
  const atts = []
  const seen = new Set()
  const re = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = re.exec(html))) {
    const href = m[1]
    const label = stripTags(m[2])
    const isDownload =
      /download|file|atch|attach|fileDown|cfs|\.hwp|\.pdf|\.docx?|\.pptx?|\.xlsx?|\.zip|\.jpg|\.png/i.test(
        href
      ) || /\.(hwp|pdf|docx?|pptx?|xlsx?|zip)/i.test(label)
    if (!isDownload) continue
    const url = toAbsolute(href, base)
    if (seen.has(url)) continue
    seen.add(url)
    // 파일명: label에서 확장자 포함 토큰 우선, 없으면 href의 끝
    let name = label
    const fnameMatch = label.match(/[^\s/\\]+\.(?:hwp|pdf|docx?|pptx?|xlsx?|zip|jpg|png)/i)
    if (fnameMatch) name = fnameMatch[0]
    else {
      try {
        name = decodeURIComponent(new URL(url).pathname.split('/').pop() || label)
      } catch {
        /* keep label */
      }
    }
    atts.push({ name: name || '(파일명 미상)', url })
  }
  return atts
}

// 상세 페이지의 전체 제목 추출 (목록 noise 제거)
function extractDetailTitle(html) {
  const candidates = [
    // 국민대 CMS: <span class="b-title">제목</span>
    /<span[^>]*class=["'][^"']*b-title[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
    /<h[1-4][^>]*class=["'][^"']*(?:view|title|subject|board|tit)[^"']*["'][^>]*>([\s\S]*?)<\/h[1-4]>/i,
    /<(?:p|div|span|td)[^>]*class=["'][^"']*(?:view-title|board-title|bo_v_tit|subject|tit)[^"']*["'][^>]*>([\s\S]*?)<\/(?:p|div|span|td)>/i,
    /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i,
  ]
  for (const re of candidates) {
    const m = html.match(re)
    if (m) {
      let t = stripTags(m[1])
      // "국민대학교 | ..." 같은 사이트명 꼬리 제거
      t = t.replace(/\s*[|<>-].*?(국민대|KOOKMIN|KMU).*$/i, '').trim() || t
      if (t && t.length >= 3) return cleanTitle(t)
    }
  }
  return ''
}

// 제목에서 목록 noise(No., 날짜, 공지 배지) 제거
function cleanTitle(raw) {
  return decodeEntities(raw)
    .replace(/^공지\s*/, '')
    .replace(/No\.\s*\d+/gi, '')
    .replace(/\b\d{4}[.\-/]\s?\d{1,2}[.\-/]\s?\d{1,2}\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// 카테고리/메뉴 라벨처럼 보이는 제목 (실제 공지 제목이 아님)
const CATEGORY_LABELS = /^(학사공지|공지사항|공지|학사일정|진로안내|취업\/?공모전( 공지)?|일반공지|게시판|학사|채용공지|세미나&?특강|장학|행사|소식|notice|news)$/i

// 상세 페이지 종합 파싱: 제목/본문(raw+text)/이미지/첨부/상태
function parseDetail(html, base, listTitle) {
  const bodyHtml = extractBodyHtml(html)
  const contentText = htmlToStructuredText(bodyHtml)
  const images = extractImages(bodyHtml || html, base)
  const attachments = extractAttachments(html, base)
  const detailTitleRaw = extractDetailTitle(html)
  const cleanedList = cleanTitle(listTitle || '')

  // 제목 선택: 상세 제목이 유효(카테고리 라벨/너무 짧음 아님)하면 사용,
  // 아니면 목록 제목으로 fallback.
  let title
  const detailOk =
    detailTitleRaw &&
    detailTitleRaw.length >= 4 &&
    !CATEGORY_LABELS.test(detailTitleRaw.trim())
  if (detailOk) title = detailTitleRaw
  else title = cleanedList || detailTitleRaw || ''

  // contentStatus 판정
  let contentStatus
  if (contentText && contentText.length >= 20) {
    contentStatus = 'text_extracted'
  } else if (images.length > 0) {
    contentStatus = 'image_only' // 본문 텍스트 없이 이미지 본문
  } else if (attachments.length > 0) {
    contentStatus = 'attachment_only'
  } else {
    contentStatus = 'extraction_failed'
  }

  return {
    title,
    contentText,
    contentHtml: bodyHtml || '',
    images,
    attachments,
    contentStatus,
  }
}

// 상세 페이지에서 작성일/등록일/게시일을 파싱한다.
// '작성일 26.09.28' 같은 2자리 연도도 처리하고, 없으면 ''을 반환.
function extractDetailDate(html) {
  const text = stripTags(html)
  // 1) '작성일/등록일/게시일/일자' 라벨 뒤의 날짜
  const labeled = text.match(
    /(?:작성일|등록일|게시일|작성일자|등록일자|일자|date)\s*[:：]?\s*(\d{2,4})[.\-/]\s?(\d{1,2})[.\-/]\s?(\d{1,2})/i
  )
  const m = labeled || text.match(/(\d{4})[.\-/]\s?(\d{1,2})[.\-/]\s?(\d{1,2})/)
  if (!m) return ''
  let [, y, mo, d] = m
  if (y.length === 2) y = `20${y}` // 26 → 2026
  const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return parseYmd(iso) ? iso : ''
}

// 게시판 유형별 pagination URL 생성. page는 1부터.
function buildPageUrl(src, page) {
  if (page <= 1) return src.listUrl
  const u = new URL(src.listUrl)
  if (/\.do(?:$|\?)/.test(u.pathname + u.search) || u.pathname.endsWith('.do')) {
    // .do 게시판: article.offset = (page-1)*limit, articleLimit=10
    const limit = 10
    u.searchParams.set('article.offset', String((page - 1) * limit))
    u.searchParams.set('articleLimit', String(limit))
    return u.href
  }
  // 일반 목록 게시판: 흔한 page 파라미터 사용
  u.searchParams.set('page', String(page))
  return u.href
}

// ---------- source 크롤링 (pagination + 상세 작성일 기준 3개월 필터) ----------
// 반환: { notices, stat }  — stat으로 요청/목록/본문 성공을 구분한다.
async function crawlSource(src) {
  const byArticle = new Map() // articleId(또는 canonicalUrl) → notice (중복 제거)
  const seenCanonical = new Set()
  const stat = {
    source: src.key,
    requestOk: false, // 목록 페이지 HTTP 성공 여부
    listParsed: 0, // 목록에서 파싱된 링크 수(중복 전)
    detailOk: 0, // 상세 본문 추출 성공 수
    count: 0, // 최종 수집 수
    pages: 0,
  }

  for (let page = 1; page <= MAX_PAGES_PER_SOURCE; page += 1) {
    if (byArticle.size >= MAX_ITEMS_PER_SOURCE) break

    const pageUrl = buildPageUrl(src, page)
    let listHtml
    try {
      listHtml = await fetchText(pageUrl, LIST_TIMEOUT_MS)
      stat.requestOk = true
      stat.pages = page
    } catch {
      break // 페이지 로드 실패 → 이 source 종료
    }

    const parsed = src.parser(listHtml, pageUrl)
    stat.listParsed += parsed.length

    // canonical URL 기준 신규 항목만
    const rawItems = parsed.filter((it) => {
      if (!it.url) return false
      const canon = canonicalizeUrl(it.url)
      if (seenCanonical.has(canon)) return false
      seenCanonical.add(canon)
      it.canon = canon
      it.articleId = extractArticleId(canon)
      return true
    })

    if (rawItems.length === 0) break // 더 이상 신규 글 없음 → 종료

    let newInRange = 0
    let hadKnownDate = false

    for (const it of rawItems) {
      if (byArticle.size >= MAX_ITEMS_PER_SOURCE) break

      let date = it.date || ''
      let detail = {
        title: cleanTitle(it.title || ''),
        contentText: '',
        contentHtml: '',
        images: [],
        attachments: [],
        contentStatus: 'extraction_failed',
      }

      if (it.canon) {
        try {
          const detailHtml = await fetchText(it.canon, DETAIL_TIMEOUT_MS)
          detail = parseDetail(detailHtml, it.canon, it.title)
          if (detail.contentStatus === 'text_extracted') stat.detailOk += 1
          if (!date) date = extractDetailDate(detailHtml)
          await sleep(DETAIL_DELAY_MS)
        } catch {
          // 상세 실패 → 목록 정보만 사용
        }
      }

      const within = isWithinRange(date) // true/false/null
      if (within === false) {
        hadKnownDate = true
        continue // 컷오프 이전 → 제외 (고정글이라도)
      }
      if (within === true) hadKnownDate = true
      const dateUnknown = within === null

      const articleId = it.articleId || ''
      const id = articleId ? `${src.key}-${articleId}` : `${src.key}-${canonHash(it.canon)}`
      if (byArticle.has(id)) continue // 게시물 번호 기준 중복 제거

      byArticle.set(id, {
        id,
        articleId,
        title: detail.title || cleanTitle(it.title || ''),
        date: date || '',
        dateUnknown,
        url: it.canon,
        content: detail.contentText,
        contentHtml: detail.contentHtml,
        images: detail.images,
        attachments: detail.attachments,
        contentStatus: detail.contentStatus,
        sourceCollege: src.sourceCollege,
        sourceDepartments: src.sourceDepartments || [],
        sourceName: src.sourceName,
        sourceType: 'website',
      })
      if (within === true) newInRange += 1
    }

    if (hadKnownDate && newInRange === 0) break
  }

  const notices = [...byArticle.values()]
  stat.count = notices.length
  return { notices, stat }
}

// canonical URL 간단 해시 (articleId 없을 때 ID 보조용)
function canonHash(url) {
  let h = 0
  const s = String(url || '')
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(36)
}

// 게시물 ID(= key-articleId) 기준 중복 제거. ID 없으면 canonical URL 보조.
function dedupe(notices) {
  const seen = new Set()
  const out = []
  for (const n of notices) {
    const key = n.id || (n.url && n.url.trim()) || `${n.title}__${n.date}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(n)
  }
  return out
}

// 최신순 정렬 (날짜 내림차순, 날짜 없으면 뒤로)
function sortByRecent(notices) {
  return notices.slice().sort((a, b) => {
    const da = a.date || ''
    const db = b.date || ''
    if (da && db) return db.localeCompare(da)
    if (da) return -1
    if (db) return 1
    return 0
  })
}

// local sample fallback
async function loadSampleFallback() {
  try {
    const raw = await readFile(join(__dirname, 'sampleNotices.json'), 'utf-8')
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

// 수집 결과를 파일로 저장한다. (output/notices-latest.json + 타임스탬프 사본)
// 저장 실패는 API 응답에 영향을 주지 않는다.
async function saveResult(payload) {
  try {
    const outDir = join(__dirname, 'output')
    await mkdir(outDir, { recursive: true })
    const json = JSON.stringify(payload, null, 2)
    await writeFile(join(outDir, 'notices-latest.json'), json, 'utf-8')
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    await writeFile(join(outDir, `notices-${stamp}.json`), json, 'utf-8')
    console.log(`[crawler] 결과 저장: output/notices-latest.json (${payload.count}건)`)
  } catch (err) {
    console.warn('[crawler] 결과 저장 실패:', err?.message)
  }
}

async function collectNotices() {
  const results = await Promise.allSettled(SOURCES.map((s) => crawlSource(s)))
  let notices = []
  const sourceStatus = []
  results.forEach((r, i) => {
    const key = SOURCES[i].key
    if (r.status === 'fulfilled' && r.value && Array.isArray(r.value.notices)) {
      const { notices: ns, stat } = r.value
      notices.push(...ns)
      // 요청 성공 / 목록 추출 / 본문 추출을 구분해 상태 산출
      let status
      if (!stat.requestOk) status = 'request_failed'
      else if (stat.listParsed === 0) status = 'list_parse_failed'
      else if (stat.count === 0) status = 'empty_after_filter'
      else status = 'ok'
      sourceStatus.push({
        source: key,
        requestOk: stat.requestOk,
        listParsed: stat.listParsed,
        detailOk: stat.detailOk,
        count: stat.count,
        status,
      })
    } else {
      const reason = r.status === 'rejected' ? r.reason?.message : 'unknown'
      console.warn(`[crawler] source '${key}' 실패:`, reason)
      sourceStatus.push({
        source: key,
        requestOk: false,
        listParsed: 0,
        detailOk: 0,
        count: 0,
        status: 'request_failed',
      })
    }
  })

  // 작성일 기준 3개월 필터는 crawlSource에서 이미 엄격 적용됨.
  // 혹시 모를 범위 밖 공지를 한 번 더 안전하게 제거 (dateUnknown은 유지).
  notices = notices.filter((n) => {
    if (n.dateUnknown) return true
    return isWithinRange(n.date) !== false
  })
  notices = sortByRecent(dedupe(notices))

  let result
  if (notices.length === 0) {
    const sample = await loadSampleFallback()
    result = { notices: sample, usedFallback: true, sourceStatus }
  } else {
    result = { notices, usedFallback: false, sourceStatus }
  }

  // 수집 결과를 파일로 저장 (크롤 성공/ fallback 모두 기록)
  await saveResult({
    collectedAt: new Date().toISOString(),
    count: result.notices.length,
    usedFallback: result.usedFallback,
    sourceStatus: result.sourceStatus,
    notices: result.notices,
  })

  return result
}

// ---------- HTTP 서버 ----------
function parsePortArg() {
  const idx = process.argv.indexOf('--port')
  if (idx !== -1 && process.argv[idx + 1]) {
    const p = Number(process.argv[idx + 1])
    if (!Number.isNaN(p)) return p
  }
  return 8000
}

const PORT = parsePortArg()

const server = http.createServer(async (req, res) => {
  // 간단한 CORS 허용 (로컬 프론트엔드 개발용)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url, `http://127.0.0.1:${PORT}`)

  if (url.pathname === '/api/notices' && req.method === 'GET') {
    try {
      const { notices, usedFallback, sourceStatus } = await collectNotices()
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(
        JSON.stringify({
          success: true,
          count: notices.length,
          usedFallback,
          sourceStatus,
          notices,
        })
      )
    } catch (err) {
      // 전체 실패여도 sample fallback으로 success 반환 시도
      const sample = await loadSampleFallback()
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(
        JSON.stringify({
          success: true,
          count: sample.length,
          usedFallback: true,
          error: err?.message || 'crawl_failed',
          notices: sample,
        })
      )
    }
    return
  }

  if (url.pathname === '/' || url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ status: 'ok', endpoint: '/api/notices' }))
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify({ success: false, error: 'not_found' }))
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[local-crawler] listening on http://127.0.0.1:${PORT}`)
  console.log(`[local-crawler] GET http://127.0.0.1:${PORT}/api/notices`)
})
