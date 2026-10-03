// imageService — 공지 대표 이미지 (PRD 2~6장)
// AI 담당: 공지 제목/카테고리/요약/키워드로 이미지 생성 prompt 구성 + 이미지 생성 요청.
// 코드 담당: 캐시 재사용, category fallback, 실패 안전 처리.
//
// 중요:
//  - 이미지 생성 실패해도 서비스/추천은 영향 없음. (PRD 6장, 12장)
//  - 이미지 안에 텍스트를 생성하지 않는다. (PRD 3장)
//  - 동일 공지는 재생성하지 않고 캐시를 재사용한다. (PRD 4장)
//  - AI 이미지는 보조 비주얼이며 공지 정보의 출처가 아니다. (PRD 12장)

// 카테고리별 fallback 이미지 (abstract/gradient 느낌의 SVG data URI — 외부 네트워크 불필요)
// 텍스트 없음, 공지 주제를 암시하는 색/아이콘 분위기만 사용.
function makeGradientSvg(c1, c2, glyph) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='480' viewBox='0 0 640 480'>
  <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
  <stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/>
  </linearGradient></defs>
  <rect width='640' height='480' fill='url(#g)'/>
  <text x='50%' y='54%' font-size='140' text-anchor='middle' fill='rgba(255,255,255,0.9)' font-family='Segoe UI Emoji, Apple Color Emoji, sans-serif'>${glyph}</text>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

// 카테고리 → fallback 이미지 + prompt 테마
const CATEGORY_IMAGE = {
  '취업': { img: makeGradientSvg('#1f4fd8', '#11204a', '💼'), theme: '커리어, 면접, 오피스, 성장' },
  '인턴': { img: makeGradientSvg('#1f4fd8', '#11204a', '🧑‍💼'), theme: '인턴, 실무, 산학협력, 오피스' },
  '장학금': { img: makeGradientSvg('#0f766e', '#134e4a', '🎓'), theme: '교육, 학업 지원, 장학 프로그램' },
  '공모전': { img: makeGradientSvg('#7c3aed', '#4c1d95', '🏆'), theme: '아이디어 경진, 팀 협업, 트로피' },
  'AI/데이터': { img: makeGradientSvg('#2563eb', '#1e3a8a', '🤖'), theme: '인공지능, 데이터, 노트북, 현대적 기술' },
  '특강': { img: makeGradientSvg('#b45309', '#7c2d12', '🎤'), theme: '강의, 발표, 세미나' },
  '대학원': { img: makeGradientSvg('#334155', '#0f172a', '📚'), theme: '연구, 대학원, 학문' },
  '수강신청': { img: makeGradientSvg('#0891b2', '#164e63', '🗓️'), theme: '학사 일정, 수강, 캘린더' },
  '교환학생': { img: makeGradientSvg('#0ea5e9', '#0c4a6e', '🌍'), theme: '글로벌 캠퍼스, 국제 교류, 여행' },
  '교내행사': { img: makeGradientSvg('#be123c', '#7f1d1d', '🎪'), theme: '캠퍼스, 행사, 커뮤니티' },
}

const DEFAULT_IMAGE = makeGradientSvg('#1f4fd8', '#11204a', '📌')

// 세션 캐시 (noticeId → { imageUrl, imagePrompt, generatedAt })
const imageCache = new Map()

function primaryCategory(notice) {
  const cats = notice.category || []
  for (const c of cats) {
    if (CATEGORY_IMAGE[c]) return c
  }
  return null
}

// 공지 → 이미지 생성 prompt (AI 담당 영역). 텍스트 미포함을 명시.
export function buildImagePrompt(notice) {
  const cat = primaryCategory(notice)
  const theme = cat ? CATEGORY_IMAGE[cat].theme : '대학교 캠퍼스, 공지, 정보'
  const kws = (notice.keywords || []).slice(0, 4).join(', ')
  return (
    `대학교 공지 주제를 설명하는 대표 비주얼. 주제: ${theme}. ` +
    `${kws ? `키워드: ${kws}. ` : ''}` +
    `현대적이고 깔끔한 editorial illustration, 국민대학교 캠퍼스 분위기, ` +
    `네이비/블루 톤, 텍스트 없음, 로고 없음.`
  )
}

// 카테고리 fallback 이미지 URL
export function getCategoryFallbackImage(notice) {
  const cat = primaryCategory(notice)
  return cat ? CATEGORY_IMAGE[cat].img : DEFAULT_IMAGE
}

// 실제 이미지 생성 API 자리. 키/엔드포인트 미설정 시 throw → fallback 사용.
async function callRealImageAPI() {
  throw new Error('image generation API not configured')
}

/**
 * 공지 대표 이미지를 가져온다. 캐시 → (실제 생성 시도) → category fallback.
 * 실패해도 throw하지 않고 항상 사용 가능한 imageUrl을 반환한다.
 * @param {object} notice - 분석된 공지 (id, title, category, summary, keywords)
 * @returns {Promise<{ noticeId, imageUrl, imagePrompt, generatedAt, usedFallback }>}
 */
export async function getNoticeImage(notice) {
  const noticeId = notice.id
  if (imageCache.has(noticeId)) {
    return imageCache.get(noticeId)
  }

  const imagePrompt = buildImagePrompt(notice)
  let result

  try {
    const url = await callRealImageAPI(imagePrompt)
    if (!url || typeof url !== 'string') throw new Error('empty image url')
    result = {
      noticeId,
      imageUrl: url,
      imagePrompt,
      generatedAt: new Date().toISOString(),
      usedFallback: false,
    }
  } catch (err) {
    // 생성 실패 → category fallback (서비스/추천에 영향 없음)
    result = {
      noticeId,
      imageUrl: getCategoryFallbackImage(notice),
      imagePrompt,
      generatedAt: null,
      usedFallback: true,
    }
  }

  imageCache.set(noticeId, result)
  return result
}

export { imageCache }
