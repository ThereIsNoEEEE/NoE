// 수집 데이터 공통 포맷 정규화 (PRD 8장)
// 홈페이지 원문 공지를 아래 공통 구조로 변환한다.
//
// {
//   id, title, content, date, url,
//   sourceType: "website",
//   sourceName: "국민대학교 공식 홈페이지"
// }

export const SOURCE = {
  WEBSITE: {
    type: 'website',
    name: '국민대학교 공식 홈페이지',
    badge: '학교 홈페이지',
  },
}

// 홈페이지 원문 공지 → 공통 포맷
export function normalizeWebsiteNotice(raw) {
  return {
    id: `web-${raw.id}`,
    title: raw.title || '',
    content: raw.content || '',
    date: raw.date || '',
    url: raw.url || '',
    sourceType: SOURCE.WEBSITE.type,
    sourceName: raw.source || SOURCE.WEBSITE.name,
    sourceBadge: SOURCE.WEBSITE.badge,
  }
}

// 정규화된 목록을 하나로 합친다.
export function mergeNotices(...lists) {
  return lists.flat().filter(Boolean)
}

export default normalizeWebsiteNotice
