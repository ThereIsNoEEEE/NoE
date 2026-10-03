# KMU Pick AI PRD (구현 현황 최신화)
팀명: [팀명] | 최초 작성일: 2026-10-03 | 최신화: 2026-10-03

> 이 문서는 실제 구현된 상태에 맞춰 최신화한 PRD다.
> 각 항목은 **구현 완료 / 보강 중 / 계획**을 구분해 표기한다.
> 아직 구현되지 않은 기능은 완료처럼 서술하지 않는다.

---

## 1. 서비스 정의

KMU Pick AI는 국민대학교의 학교·단과대 공지를 실제로 수집하고, 사용자의 학적 정보·소속·관심 분야를 바탕으로 필요한 공지를 개인화 추천하며, 자연어 AI 검색과 실행 정리까지 제공하는 공지 AI 비서다.

### 핵심 문장
**“국민대 공지를 다 읽지 않아도, AI가 나에게 필요한 기회를 찾아주고 무엇을 해야 하는지까지 정리해준다.”**

---

## 2. 실제 공지 데이터 수집 범위

> 상태: **구현 완료** (일부 source 보강 중)

- 국민대학교 단과대학 공지 source map: **총 16개**
- 각 source에 단과대학명(`sourceCollege`)과 소속 학부·학과(`sourceDepartments`) 메타데이터 포함
- 실제 HTML 구조에 따라 source별 parser 분리:
  - 일반 KMU 게시판 (`<tr>` / `<li>` 혼합)
  - `.do` 형태 게시판 (국민대 CMS)
  - 숫자 ID 기반 상대경로 게시판
  - 리스트형 게시판

### 수집 대상 16개 단과대학
글로벌인문·지역대학 / 사회과학대학 / 법과대학 / 경상대학 / 공과대학 / 조형대학 / 과학기술대학 / 예술대학 / 체육대학 / 경영대학 / 소프트웨어융합대학 / 건축대학 / 자동차모빌리티대학 / 미래융합대학 / KMU International Business School(KIBS) / 교양대학

### 보강 이력
- 기존 0건이던 **건축대학 / 자동차모빌리티대학 / KIBS**: 숫자형 상대경로 전용 parser 추가로 보강 완료 (각각 수집됨).
- **보강 중**: 조형대학(design) 상세 제목 parser 정확도, 자동차모빌리티대학(auto) 상세 본문 정확도.

---

## 3. 최근 3개월 수집 정책

> 상태: **구현 완료**

실제 크롤러는 최근 3개월 공지를 대상으로 한다.

- 기준일: **2026-10-03**
- 컷오프: **2026-07-02** (이 날짜 이전 제외)

### 동작
- pagination을 따라가며 최근 3개월 공지를 수집
- source당 최대 **8페이지**
- source당 최대 **60건** 안전장치
- 오래된 공지만 나오는 페이지에 도달하면 pagination 중단 (과도한 요청 방지)
- 2026-07-02 이전 공지는 제외
- 고정글/상단공지라도 날짜가 컷오프 이전이면 제외

### 날짜 확정 순서
- 목록에 날짜가 있으면 사용
- 목록에 날짜가 없으면 상세 페이지에서 작성일 파싱
- 상세에서도 확인 불가 시 `dateUnknown: true`로 표시 후 유지

### 검증 결과 (최근 크롤)
- 가장 오래된 확인 가능 공지 날짜: **2026-07-07**
- 2026-07-02 이전 공지: **0건**
- dateUnknown 공지는 별도 표시

---

## 4. 상세 본문 추출

> 상태: **구현 완료** (일부 사이트 정확도 보강 중)

공지 상세 페이지에서 실제 본문 내용을 수집한다. 국민대 CMS는 본문이 `fr-view` / `b-content-box`에 있으며, LNB 메뉴(`data-cms-content`, `lnb`, `gnb`)는 본문에서 제외한다.

### contentStatus
본문 상태를 다음과 같이 구분한다.

- `text_extracted` — 실제 텍스트 본문 추출 성공
- `image_only` — 본문이 이미지 중심이라 텍스트 추출이 어려운 공지
- `attachment_only` — 텍스트 본문 없이 첨부파일만 있는 공지
- `extraction_failed` — 본문/이미지/첨부 모두 확인 불가

### 최근 검증 기준
- text_extracted: 약 134건
- image_only: 약 91건
- extraction_failed: 소수

이미지형(`image_only`) 공지는 현재 텍스트 기반 분석에서 제한이 있을 수 있음을 명시한다. (Vision AI/OCR은 계획 단계)

---

## 5. 데이터 정규화

> 상태: **구현 완료**

모든 공지는 공통 포맷으로 정규화한다.

```json
{
  "id": "cs-2868",
  "articleId": "2868",
  "title": "2026 AI역량평가 접수 안내",
  "date": "2026-09-11",
  "dateUnknown": false,
  "url": "https://cs.kookmin.ac.kr/news/notice/2868",
  "content": "정제 텍스트 본문 (문단·표 구분 보존, 길이 제한 없음)",
  "contentHtml": "원본 본문 HTML",
  "images": ["https://..."],
  "attachments": [{ "name": "파일명.pdf", "url": "https://..." }],
  "contentStatus": "text_extracted",
  "sourceCollege": "소프트웨어융합대학",
  "sourceDepartments": ["소프트웨어학부", "인공지능학부"],
  "sourceName": "국민대학교 소프트웨어융합대학",
  "sourceType": "website"
}
```

### ID / 중복 제거
- `id`는 게시물 번호 기반 고정 ID (`<source key>-<articleId>`). 예: `design-12465`
- URL에서 목록 이동용 파라미터(`page`, `article.offset`, `articleLimit` 등)는 제거하고, 게시물 식별 파라미터(`articleNo`, `idx`, `seq` 등)는 유지한 canonical URL 사용
- 중복 제거: 게시물 번호(ID) 기준 (보조: canonical URL, title+date). 페이지별 반복 공지는 1건으로 통합

### 정렬
- 최신순 (작성일 내림차순)

---

## 6. 사용자 프로필 및 관심사

> 상태: **구현 완료**

사용자는 다음 정보를 설정할 수 있다.
- 학적 / 단과대학 / 학과·전공 / 학년 / 관심 분야 / 관심 키워드

### 기본 관심 분야
취업 / 인턴 / 장학금 / 공모전 / AI·데이터 / 특강 / 대학원 / 수강신청 / 교환학생 / 교내행사

### 사용자 직접 추가 관심 분야
예: 해커톤, 금융, 창업, 연구, 봉사
- 추가 즉시 선택 상태
- 중복/빈 값 방지 (대소문자·공백 차이 포함)
- Opportunity Score 즉시 반영
- 직접 추가한 항목만 삭제 가능 (기본 분야는 삭제 불가)

---

## 7. Opportunity Score

> 상태: **구현 완료** (deterministic logic 유지)

- 관심사 일치도: 40
- 지원 대상 적합성: 30
- 마감 긴급도: 20
- 관심 키워드 일치: 10
- 총점: 100

AI가 점수를 직접 결정하지 않는다. 동일 입력 → 동일 결과.

프로필이나 관심사 변경 시:
- `useMemo` 기반 점수 재계산
- Top 3 추천 순위 즉시 변경

---

## 8. 개인화 추천 UI (캐러셀)

> 상태: **구현 완료**

기존 Top 3 고정 카드형 UI에서 캐러셀 구조로 변경됐다.

### 추천 캐러셀
- 상위 3개 공지를 슬라이드로 표시
- 첫 슬라이드 = Opportunity Score 1위
- 좌/우 이동 + 하단 pagination indicator
- 프로필 변경으로 Top 3가 바뀌면 첫 슬라이드로 reset

### 슬라이드 구성
대표 이미지 영역 / ranking badge / 제목 / Opportunity Score / D-Day / 카테고리 / AI 요약 / AI 추천 이유(강조 박스) / 원문 보기

---

## 9. 공지 이미지 처리

> 상태: **구조 구현 완료 · 실제 생성 API 미연결**

- `imageService.js` 구현
- 제목/카테고리/요약/키워드 기반 이미지 prompt 생성
- 동일 공지 재생성 방지를 위한 세션 cache
- API 미연결/실패 시 category fallback image(SVG) 사용

명시: **“AI 이미지 생성 구조는 준비되었으나 실제 생성 API는 아직 미연결”**. 향후 실제 이미지 생성 API 연결 가능.

---

## 10. AI 공지 탐색 챗봇

> 상태: **구현 완료**

사용자는 자연어로 원하는 공지를 검색할 수 있다.
- 예: "AI 해커톤 관련 공지 찾아줘", "이번 주 마감 취업 공지 보여줘", "대학원생 지원 가능한 장학금 알려줘"

### AI 역할
질문 의도 분석 / 키워드 추출 / 카테고리·대상·마감 조건 구조화

### 코드 역할
실제 공지 데이터 필터링 / 조건 검증 / 정렬 / Top N 선정

- 존재하지 않는 공지를 생성하지 않는다.
- AI 실패 시 deterministic keyword search fallback.

---

## 11. 공지 실행 비서

> 상태: **구현 완료**

기존 `AI로 정리하기`를 실행 중심으로 확장했다. 검색된 실제 공지들을 대상으로 아래 항목을 구조화해 보여준다.

- 공지명
- 지원/참여 대상
- 마감일 / D-Day
- 핵심 내용
- 준비해야 할 것
- 해야 할 일 체크리스트
- 원문 링크

### Hallucination 방지
준비물은 공지 본문에 실제 근거가 있는 경우에만 추출한다. (예: 포트폴리오, 이력서, 팀 구성, 원서, 어학성적)
근거가 없으면 `공지 원문 확인 필요`로 표시한다.

체크리스트 예: 신청 → 준비물 준비 → 마감 전 최종 제출. (마감일이 있는 경우에만 마감 전 제출 항목 포함)

---

## 12. DB 구조 (Supabase)

> 상태: **연동 구조 구현 완료 · 실제 production 연결은 계획**

LocalStorage 대신 Supabase 사용 방향을 유지한다.

- Supabase 연동 코드 구조 존재
- 환경변수 미설정 시 session state fallback
- 환경변수: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- 미설정 또는 실패 시: 세션 state로 계속 동작, 서비스 중단 없음

저장 대상: 사용자 프로필, 사용자 추가 관심 분야
회원가입/OAuth는 이번 범위에서 제외.

---

## 13. 크롤러 서버

> 상태: **구현 완료**

위치: `mobile-android/local-crawler/server.mjs`
API: `GET /api/notices`

```json
{
  "success": true,
  "count": 226,
  "usedFallback": false,
  "sourceStatus": [
    { "source": "cs", "requestOk": true, "listParsed": 60, "detailOk": 30, "count": 19, "status": "ok" }
  ],
  "notices": [ ... ]
}
```

### 동작
source별 parser / timeout / `Promise.allSettled` / source별 실패 격리 / pagination / 상세 본문 / 상세 날짜 / 중복 제거 / 3개월 필터 / JSON 결과 저장

### sourceStatus (요청 vs 파싱 구분)
- `requestOk` — 목록 페이지 HTTP 요청 성공 여부
- `listParsed` — 목록에서 파싱된 링크 수
- `detailOk` — 상세 본문 추출 성공 수
- `count` — 최종 수집 수
- `status` — `ok` / `empty_after_filter` / `list_parse_failed` / `request_failed`

→ 0건이어도 "요청 성공 + 목록 파싱 실패"인지 "요청 자체 실패"인지 구분 가능.

---

## 14. 크롤 결과 파일 저장

> 상태: **구현 완료**

- 크롤링 결과를 `output/` 폴더에 JSON으로 자동 저장 (`saveResult()`)
- `notices-latest.json` (최신) + 타임스탬프 사본
- 저장 실패해도 API 응답에는 영향을 주지 않음
- `output/`은 매번 변경되는 산출물이므로 `.gitignore` 처리
- 전달용 JSON은 별도 복사 가능 (예: 루트/바탕화면의 `kmu-notices.json`)

---

## 15. Fallback 구조

> 상태: **구현 완료**

### 크롤링
- 일부 source 실패 → 나머지 source 결과 정상 반환
- 전체 실패/0건 → server sample JSON
- crawler server 미실행 → frontend `sampleNotices` fallback

### AI
- AI 분석 실패 → Local Mock
- 챗봇 의도 분석 실패 → keyword deterministic fallback

### 이미지
- AI 이미지 생성 실패 → category fallback

### DB
- Supabase 실패/미설정 → session state

어떤 외부 기능이 실패해도 핵심 Dashboard는 중단되지 않는다.

---

## 16. UI / UX

> 상태: **구현 완료**

premium dashboard UI 적용 완료.

디자인 방향: 국민대 공식 서비스 느낌 + 현대적 AI SaaS / 네이비·블루 / 밝은 배경 / 넉넉한 여백 / subtle shadow / premium card.

구성: 얇은 top header + status pill / 왼쪽 profile panel / KPI 4 cards / Top 3 carousel / AI notice search / 전체 공지 list / 실행 비서 card.

### 데이터 소스 모드
- `VITE_DATA_MODE=live` → 로컬 크롤러 API (국민대 실제 공지), 헤더 `LIVE · 국민대 실제 공지` pill
- `VITE_DATA_MODE=demo` → sampleNotices (안정 데모), 헤더 `DEMO · Sample Data` pill

---

## 17. 현재 검증 상태

### 검증 완료
- npm build 성공 / 콘솔 에러 없음
- 관심 분야 추가/삭제
- Opportunity Score 재계산 / Top 3 변경 / D-Day
- crawler fallback / AI fallback
- 챗봇 검색 / 실행 비서 / carousel / JSON 저장
- 실제 16개 단과대 source map / 최근 3개월 필터 / 상세 본문 추출

### 남은 보완
- 조형대(design) 상세 제목 parser 정확도
- 자동차모빌리티대(auto) 상세 본문 정확도
- image_only 공지에 대한 실제 Vision AI/OCR 분석
- 실제 Supabase 환경변수(production) 연결
- 실제 AI image generation API 연결

---

## 18. 차별화 포인트

단순 공지 추천이 아니다.

1. 국민대학교 단과대학별 실제 공지를 직접 수집
2. 소속/전공/관심 기반 개인화
3. 자연어로 원하는 공지를 탐색
4. 결과를 실제 공지 기준으로 요약
5. 공지를 읽는 데서 끝나지 않고 준비물/체크리스트까지 실행 계획으로 변환

### 핵심 메시지
**“추천에서 끝나는 공지 AI가 아니라, 실제 행동까지 연결하는 대학생활 공지 비서.”**

---

## 19. 구현 완료 / 계획 구분

### 구현 완료
- 실제 국민대 공지 크롤링 (16개 source map)
- 최근 3개월 필터 / pagination
- 상세 본문·상세 날짜 추출 / contentStatus
- 게시물 번호 기반 고정 ID + 중복 제거
- images / attachments 수집
- Opportunity Score / D-Day
- 관심사 추가·삭제
- Top 3 캐러셀
- 자연어 공지 검색 (챗봇)
- 공지 실행 비서
- Supabase 연동 구조 + DB fallback
- AI 이미지 fallback 구조
- 크롤 결과 JSON 저장
- 데이터 소스 모드 (live/demo)

### 추가 보완 예정 (계획)
- 조형대(design) title parser 정확도 개선
- 자동차모빌리티대(auto) 본문 추출 정확도 개선
- image_only 공지 Vision AI / OCR 분석
- PDF/HWP 첨부 내용 추출
- 실제 Supabase production 연결
- 실제 AI image generation API 연결

---

## 부록. 기술 구성 / 프로젝트 구조

### 기술 구성
- 개발 도구: Kiro
- Frontend: React + Vite (JavaScript)
- State: React State / Storage: Supabase (미설정 시 session state fallback)
- AI: aiService(공지 분석/요약) · aiSearchService(자연어 의도 분석/검색 정리)
- 이미지: imageService (prompt 생성 + category fallback)
- 크롤러: Node 로컬 서버 (`mobile-android/local-crawler/server.mjs`)
- Fallback: Local Sample Data / Local Mock Response / keyword deterministic search / category fallback image

### 프로젝트 구조 (요약)
```text
src/
  components/  ProfilePanel, InterestSelector, SummaryPanel,
               NoticeCard, NoticeList, NoticeCarousel, NoticeSearchChat
  data/        sampleNotices.js
  services/    crawlerService, aiService, aiSearchService,
               imageService, supabaseClient, supabaseService
  utils/       normalizeNotice, calculateOpportunityScore,
               calculateDDay, filterNotices, validation
  App.jsx / main.jsx

mobile-android/local-crawler/
  server.mjs            # 크롤러 서버 (GET /api/notices)
  sampleNotices.json    # 전체 실패/0건 시 fallback
  output/               # 크롤 결과 JSON (gitignore)
  run-crawler.bat / README.md
start-kmu-way.bat        # 크롤러 실행 + 브라우저 오픈 런처
```

---

## Kiro 구현 지침 (유지)

1. 이 문서를 프로젝트 루트의 `prd.md`로 유지한다.
2. 실제 구현된 기능과 계획 중인 기능을 항상 구분해 기술한다.
3. 홈페이지 크롤링은 국민대학교 지정 단과대학 공지 게시판으로 제한한다. (로그인/인증 페이지 미접근)
4. Opportunity Score와 D-Day는 deterministic logic으로 유지한다.
5. AI 챗봇은 "공지 생성"이 아니라 "공지 탐색·필터링·요약" 역할만 한다.
6. 모든 외부 기능(크롤링/AI/이미지/DB)에 fallback을 유지한다.
7. 핵심 데모는 "프로필에 따라 같은 공지의 추천 순위가 달라지는 것" + "실행 비서로 행동까지 연결"이다.
