# KMU Pick AI frontend

`KMU_Pick_AI copy.html`의 화면과 동작을 Next.js App Router로 옮긴 프론트엔드입니다. 원본 디자인의 CSS는 `app/globals.css`의 Tailwind 컴포넌트 레이어에 유지하고, 버튼·입력은 shadcn/ui의 원본 스타일 변형을 사용합니다.

## 실행

```bash
npm install
npm run dev
```

http://localhost:3000에서 확인합니다. `npm run build`, `npm run lint`로 검증합니다.

## 기능별 위치

| 경로 | 역할 |
| --- | --- |
| `app/page.tsx`, `app/layout.tsx` | Next.js 페이지와 공통 설정 |
| `components/kmu/CampusDashboard.jsx` | 상태 관리와 화면 연결 |
| `components/kmu/ProfilePanel.jsx`, `InterestSelector.jsx` | 프로필·관심사 입력 |
| `components/kmu/HomeDashboard.jsx`, `HomeNoticeCard.jsx` | 홈과 추천 카드 |
| `components/kmu/NoticeList.jsx`, `NoticeFeed.jsx`, `TopNoticeCard.jsx` | 공지 목록·필터·저장 목록 |
| `components/kmu/NoticeDetail.jsx` | 상세 정보와 점수 근거 |
| `components/ui/` | shadcn/ui Button, Input |
| `data/` | 예시 공지·학적·관심사 설정 |
| `lib/recommendations.js`, `lib/dates.js` | 점수·정렬·D-Day 계산 |
| `lib/profile.js` | 입력 검증·LocalStorage |
| `services/notices.js` | 공지 요청·정규화·AI 분석·fallback |
| `app/api/notices/route.ts`, `app/api/analyze/route.ts` | 실제 백엔드 연결을 위한 API 자리 |

## 현재 동작 범위

온보딩, 프로필 변경, 개인화 추천, 공지 필터, 저장·해제, 상세 패널, 모바일 메뉴를 제공합니다. 프로필·저장 목록·분석 캐시는 브라우저 LocalStorage에 유지됩니다.

공지 API는 샘플 데이터를 반환하고 분석 API는 로컬 규칙 분석으로 대체하도록 구성되어 있습니다. 실제 크롤러·AI 서버를 연결하려면 API route와 `services/notices.js`를 교체합니다. 챗봇은 원본처럼 준비 중 안내를 표시합니다.

브라우저 저장소를 사용하는 초기화는 `CampusApp.tsx`에서 클라이언트 렌더링으로 처리합니다. UI는 JSX, 페이지·API·shadcn 컴포넌트는 TypeScript입니다.
