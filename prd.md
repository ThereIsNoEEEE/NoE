# KMU Pick AI PRD (구현 현황 최신화 — Front/Back 반영)
팀명: NoE | 최초 작성일: 2026-10-03 | 최신화: 2026-10-03

> 이 문서는 팀 저장소(front + backend)의 **실제 구현 상태**에 맞춰 최신화한 PRD다.
> 각 항목은 **구현 완료 / 보강 중 / 계획**을 구분해 표기한다. 미구현 기능을 완료처럼 쓰지 않는다.
> 참고: 아키텍처가 로컬 프로토타입(Vite+React / LocalStorage·Supabase / 로컬 crawler)에서
> 팀 통합본(**Next.js 프론트 + Node 백엔드 + Qdrant DB**)으로 전환되었다. 본 문서는 통합본 기준이다.

---

## 1. 서비스 정의

KMU Pick AI는 국민대학교의 학교·단과대 공지를 실제로 수집하고, 사용자의 학적 정보·소속·관심 분야를 바탕으로 필요한 공지를 개인화 추천하는 공지 AI 비서다. 자연어 검색과 공지 실행 정리까지 제공하는 것을 목표로 한다.

### 핵심 문장
**“국민대 공지를 다 읽지 않아도, AI가 나에게 필요한 기회를 찾아주고 무엇을 해야 하는지까지 정리해준다.”**

---

## 2. 시스템 아키텍처 (실제 구현)

> 상태: **구현 완료** (일부 영역 계획)

```text
[ Next.js Front (front/) ]  ──同 origin /api/* 프록시──▶  [ Node Backend (backend/) ]  ──REST──▶  [ Qdrant 벡터DB ]
     React 19 / Tailwind v4                                 무의존성 Node ≥22, 포트 8001           payload-only 컬렉션
```

- **프론트엔드**: `front/` — Next.js 16 + React 19 + TypeScript + Tailwind v4, App Router. 같은 origin `/api/*`를 백엔드로 프록시.
- **백엔드**: `backend/` — Node.js ≥22, 외부 npm 의존성 없음. HTTP 서버 + 크롤러 + Qdrant 연동. 기본 포트 `http://127.0.0.1:8001`.
- **챗봇(RAG)**: `backend/CHATBOT/` — 공지 벡터 검색 + LLM 답변. 프론트 홈 챗봇 UI(`ChatPanel`/`ChatbotWidget`)와 연결.
- **DB**: Qdrant (payload-only). 공유 서버 `http://14.36.30.189:13000`(버전 1.15.4). 컬렉션 `kmu_academic_profiles_v1`(프로필), `kmu_notices_raw_v1`(공지 원문), `kmu_notice_chunks_v1`(챗봇 검색용 벡터 청크).
- **인증**: 현재 없음 (로컬/데모 전용). UUID는 인증 수단이 아니므로 공개 서버로 그대로 노출 금지.

---

## 3. 백엔드 API (실제 구현)

> 상태: **구현 완료** (OpenAPI 3.1 명세 `backend/openapi.json`)

### 프로필 (Qdrant 저장)
| 메서드 | 엔드포인트 | 용도 |
|---|---|---|
| POST | `/api/db/profiles` | 최초 학적 정보 저장 → `201` + UUID + `Location` 헤더 |
| GET | `/api/db/profiles/{id}` | 저장된 학적 정보 조회 |
| PUT | `/api/db/profiles/{id}` | 학적 정보 전체 교체 |
| GET | `/api/db/health` | Qdrant 연결 확인 (데이터 변경 없음) |
| GET | `/api/health` | 백엔드 실행 상태 |

### 공지 / 크롤러
| 메서드 | 엔드포인트 | 용도 |
|---|---|---|
| GET | `/api/notices` | 실제 수집 공지 조회 (`items, total, mode, sources, fetchedAt`) |
| POST | `/api/crawl` | 공지 목록 재수집 (최소 30초 간격) |
| GET | `/api/images/{id}` | 첨부/본문 이미지 프록시 (16자리 hex id) |

### 에러 규약
`{ error: { code, message, details? } }`
400=JSON/UUID, 403=미허용 Origin, 404=없음, 405=메서드, 413=크기 초과(32KB), 415=형식, 422=검증 실패, 502=전체 수집 실패, 503=DB 장애/인증/구조.

---

## 4. 사용자(학적) 프로필 모델 (실제 구현)

> 상태: **구현 완료** (프론트 입력 모델과 백엔드 스키마 일치)

```json
{
  "studentType": "대학원",
  "college": "소프트웨어융합대학원",
  "major": "AI",
  "grade": 1,
  "interests": ["취업", "인턴", "AI/데이터", "공모전"],
  "customInterests": [],
  "keywords": ["AI", "데이터", "해커톤"]
}
```

### 검증 규칙 (`backend/src/db/profile-schema.mjs`)
- 필수: `studentType`, `college`, `major`, `grade`, `interests`(1개 이상)
- `studentType`: `학부` / `대학원`
- `grade`: 정수. 학부 1~4, 대학원 1~3
- `college` / `major`: 최대 100자
- `interests` / `customInterests` / `keywords`: 각 항목 최대 50자, 배열 최대 20개
- `customInterests` / `keywords`: 생략 시 빈 배열. 앞뒤 공백·중복 정리. 추가 필드/형식 오류는 거부
- 본문 최대 32KB

### 저장 응답 (StoredProfile)
```json
{ "id": "uuid", "kind": "academic_profile", "schemaVersion": 1,
  "profile": { ... }, "createdAt": "...", "updatedAt": "..." }
```
- `id`는 서버가 생성한 UUID = Qdrant point ID, 학적 정보는 payload에 저장
- `vectors: {}` / `vector: {}` point 사용 (임베딩 미생성, 벡터 검색 미수행)
- `wait=true`로 작업 완료 확인 후 성공 응답

> 변경점 note: 기존 프로토타입은 `keywordsText`(문자열) + `grade`(문자열, 예: "석사")였으나,
> 실제 백엔드는 `college`(명칭), `grade`(정수), `interests`/`customInterests`/`keywords`(배열)로 통일되었다.

---

## 5. 공지 데이터 수집 (크롤러)

> 상태: **구현 완료** (일부 source 정확도 보강 중)

`backend/src/crawler.mjs`가 학교·단과대학 공지의 목록·본문·첨부·이미지 수집, 정규화, 캐시를 담당한다.

- 수집 대상: 국민대학교 단과대학 공지 게시판 (source map)
- source별 HTML 구조 대응 parser (`<tr>`/`<li>` 혼합, `.do` CMS, 숫자 ID 상대경로, 리스트형)
- 게시판당 최대 12건, 상세 차수 수집
- 목록 10분 / 본문 1시간 캐시, 강제 갱신(`/api/crawl`) 최소 30초 간격
- 모든 출처 실패 시 HTTP 502, 일부 실패 시 `mode: mixed`
- 백엔드는 샘플 공지로 바꾸지 않으며, DB가 없어도 크롤링은 동작
- 크롤링 결과의 자동 DB 저장, `/api/analyze`, AI 임베딩은 **미구현(계획)**
- 외부 JSON 파일의 DB 저장은 `scripts/import-notices.mjs`로 수행

### 공지 payload (`kmu_notices_raw_v1`)
```json
{
  "kind": "notice",
  "schemaVersion": 1,
  "notice": { "...": "제목/본문/HTML/출처/이미지/첨부/추출 상태" },
  "analysisStatus": "pending",
  "needsOcr": false,
  "needsAttachmentExtraction": false,
  "reviewRequired": false,
  "assetDirectory": "..."
}
```
- 본문은 길이 제한 없이 보존, 이미지·첨부 미처리 상태 명시
- OCR·PDF/HWP·이미지 다운로드는 **다음 단계(계획)**

> 참고: 로컬 프로토타입의 `mobile-android/local-crawler/`(독립 Node 서버, `GET /api/notices`,
> `output/*.json` 저장)는 실험·대용 수집기로 유지되며, 통합 백엔드의 크롤러와 역할이 겹친다.
> 통합본 기준의 공식 크롤러는 `backend/src/crawler.mjs`다.

---

## 6. 최근 3개월 수집 정책

> 상태: **구현 완료** (로컬 크롤러 기준 검증) · 백엔드 반영은 **보강 중**

- 기준일 2026-10-03, 컷오프 **2026-07-02** (이전 제외)
- pagination 추적, 오래된 페이지 도달 시 중단 (과도한 요청 방지)
- 목록에 날짜 없으면 상세 작성일 파싱, 그래도 없으면 `dateUnknown: true`
- 검증(로컬 크롤러): 가장 오래된 공지 2026-07-07, 컷오프 이전 0건

---

## 7. 사용자 프로필 및 관심사 (프론트)

> 상태: **구현 완료**

사용자는 학적 / 단과대학 / 학과·전공 / 학년 / 관심 분야 / 관심 키워드를 설정한다.

### 기본 관심 분야
취업 / 인턴 / 장학금 / 공모전 / AI·데이터 / 특강 / 대학원 / 수강신청 / 교환학생 / 교내행사

### 사용자 직접 추가 관심 분야 (`customInterests`)
- 추가 즉시 선택 상태 / 중복·빈 값 방지 / 삭제 가능 (기본 분야는 삭제 불가)
- Opportunity Score 즉시 반영
- 백엔드 프로필의 `customInterests` 배열로 저장

---

## 8. Opportunity Score

> 상태: **구현 완료** (deterministic logic)

- 관심사 일치도 40 / 지원 대상 적합성 30 / 마감 긴급도 20 / 관심 키워드 일치 10 = 100
- AI가 점수를 직접 결정하지 않음. 동일 입력 → 동일 결과
- 프로필/관심사 변경 시 즉시 재계산, Top 3 순위 즉시 변경

---

## 9. 프론트 화면 구성

> 상태: **구현 완료**

`front/components/kmu/*` 기준.

- `HomeDashboard` / `CampusDashboard` — 메인 대시보드
- `ProfilePanel` — 학적/관심 설정
- `InterestSelector` — 기본 + 직접 추가 관심 분야
- `SummaryPanel` — KPI 요약
- `NoticeFeed` / `NoticeList` / `NoticeListItem` — 공지 목록
- `TopNoticeCard` / `HomeNoticeCard` — 상위 추천 카드
- `NoticeDetail` — 공지 상세
- `DeadlineBadge`(D-Day) / `SourceBadge`(출처) / `Icon`
- 데이터: `front/data/notices.js`, `front/data/profile.js` / 로직: `front/lib/recommendations.js`, `front/lib/dates.js`, `front/lib/profile.js`

> 참고: 로컬 프로토타입의 Top 3 캐러셀·AI 공지 검색 챗봇·공지 실행 비서는 통합 프론트(`front/`)에
> 아직 1:1로 이식되지 않았다. 통합본 반영은 **계획** 항목으로 둔다. (아래 15장)

---

## 10. D-Day / 마감 처리

> 상태: **구현 완료**

- 마감일 존재 시 남은 일수 계산 (`front/lib/dates.js`, `DeadlineBadge`)
- 마감 임박 강조, 날짜 미상 공지 별도 처리

---

## 10-B. AI 공지 탐색 챗봇 (공지 기반 RAG)

> 상태: **구현 완료** (백엔드 `backend/CHATBOT/` + 프론트 홈 챗봇) · 실제 임베딩/LLM 모델 API는 `.env` 등록 시 활성

사용자가 자연어로 공지를 물으면, 질문을 임베딩해 Qdrant 벡터 검색으로 관련 공지 TOP-K를 찾고, 출처를 붙인 문맥으로 LLM이 답변을 생성하는 **공지 기반 RAG 챗봇**이다. 모든 챗봇 코드는 `backend/CHATBOT/`에 모여 있고 `src/server.mjs`가 라우트만 연결한다. 기존 프로필/크롤러 코드는 수정하지 않는다.

### 처리 흐름
```text
질문 → 질문 임베딩 → Qdrant 벡터 검색(TOP-K, 기본 10)
     → 출처 부착 문맥 구성 → LLM 답변 생성 → answer + sources[]
```

### API
- `POST /api/chatbot` — `{ prompt(1~4000자), topK(1~20, 기본 10), mode: "answer"|"prepare" }`
  - 응답: `{ status, answer, topK, retrievedCount, contextCount, sources[] }`
  - `sources[]`: `reference(S1..)`, `noticeId`, `rawPointId`, `score`, `title`, `content`, `url`, `date`, `contentStatus` 등
  - `mode: "prepare"` → LLM에 전달할 `messages`만 반환 (LLM 미등록 상태에서도 동작)
- `GET /api/chatbot/status` — 임베딩/LLM 설정 유무, 기본 topK 반환 (health check)
- 프론트 홈 챗봇(`ChatPanel.jsx` / `ChatbotWidget.jsx`)이 Next.js `/api/[...path]` 프록시로 연결됨 (커밋 `deacd22`: home chatbot ↔ backend RAG(Gemini))

### 벡터 컬렉션 / 인덱싱
- `kmu_notices_raw_v1` — 원문 (조회만, 수정 안 함)
- `kmu_notice_chunks_v1` — 검색용 벡터 청크 (신규). 원문 point ID와 연결
- 인덱싱은 운영자가 명시적으로 실행: `CHATBOT/index-notices.mjs` (기존 원문 50건씩 / `--file` JSON / `--crawl`)
- 서버 시작·질문 요청이 자동으로 DB를 바꾸지 않는다

### 모델 제공자 (중립 HTTP 계약)
- `providers.mjs`가 특정 사업자에 종속되지 않는 JSON 계약 구현
  - 임베딩: `POST CHATBOT_EMBEDDING_URL` ← `{ model, input }` → `{ embedding: [...] }`
  - LLM: `POST CHATBOT_LLM_URL` ← `{ model, messages, maxOutputTokens }` → `{ answer }`
- `.env`의 `CHATBOT_*`로 등록. **현재 모델 API는 미등록 상태** → 미설정 시 벡터 검색이 임베딩을 못 만듦(503). 등록 시 활성
- LLM에는 질문 + 공지 텍스트만 전송 (API 키·학적 프로필·원문 HTML·로컬 이미지 경로 미전송)

### Hallucination 방지
- 검색된 실제 공지 문맥만 사용. 결과 없으면 `status: no_results`로 LLM 미호출 + 안내 문구
- system 메시지 + JSON 문맥 분리로 프롬프트 주입 억제, 출처 밖 사실 생성 억제
- `dateUnknown` 공지는 임시 날짜로 검색/출처에 포함하지 않음

### 타임아웃 / 성능
- 프론트 proxy 20초 제한에 맞춰 전체 챗봇 처리 기본 18초 / 최대 19초 제한
- 변경 없는 공지는 재임베딩 스킵, 기본 topK 적용 (커밋 `e38e1cf`), 챗봇에 오늘 날짜 제공 + 폭넓은 검색 (커밋 `4c9314d`)

### 주요 에러 코드
`CHATBOT_INPUT_INVALID`(422), `EMBEDDING_NOT_CONFIGURED`/`LLM_NOT_CONFIGURED`/`CHATBOT_INDEX_MISSING`/`CHATBOT_VECTOR_MISMATCH`/`CHATBOT_DB_*`(503), `EMBEDDING_API_ERROR`/`LLM_API_ERROR`(502), `CHATBOT_TIMEOUT`(504)

---

## 11. 프론트–백엔드 연결

> 상태: **구현 완료** (프로필 · 홈 챗봇) · **계획** (공지 목록 조회 연결)

- 프론트의 같은 origin `/api/*` → 백엔드 프록시 (Next.js route/rewrite 또는 dev proxy)
- 프로필 흐름: 최초 `POST /api/db/profiles` → 반환 `id` 보관 → 설정 변경 `PUT`, 복원 `GET`
- 실패 시 입력 화면 유지 + 에러 표시 (서비스 중단 없음)
- `backend/examples/profile-client.mjs`로 프론트 핸들러에 연결
- 홈 챗봇 → `POST /api/chatbot` (프록시 경유) 연결 완료
- 공지 목록 조회를 `/api/notices`로 연결하는 작업은 **계획** (현재 화면은 로컬 데이터로 시연 가능)

---

## 12. DB / 저장소

> 상태: **구현 완료**

- Qdrant payload-only 컬렉션에 프로필 저장 (`kmu_academic_profiles_v1`)
- 공지 원문은 `kmu_notices_raw_v1`
- `.env`는 git 제외, API로 노출 금지
- 프로필 데이터는 서버 로그에 남기지 않음
- 기존 컬렉션 구조가 다르면 503으로 거부(삭제/덮어쓰기 안 함)

> 변경점 note: 기존 PRD의 "LocalStorage → Supabase" 방향은 폐기되었고, 실제 저장소는 **Qdrant**다.

---

## 13. Fallback 구조

> 상태: **구현 완료**

- 크롤링: 일부 source 실패 → 나머지 반환(`mode: mixed`), 전체 실패 → 502
- DB: Qdrant 연결/저장 실패 → 503, 프론트는 입력 유지 + 에러 표시 (화면 중단 없음)
- 프로필 저장 실패 시 재시도 안내 (중복 ID 가능 → 저장 중 버튼 비활성화 권장)

---

## 14. 검증 상태

### 검증 완료
- 백엔드 단위/HTTP/모의 DB 테스트 (`node --test test/*.test.mjs`)
- 실제 Qdrant 통합 테스트 (`scripts/integration.mjs` — `kmu_test_<UUID>` 임시 컬렉션 생성 후 정리)
- 프로필 CRUD / 검증 규칙 / 에러 코드
- 크롤러 목록·본문·이미지 수집, 캐시, 502/mixed 처리
- 프론트 대시보드 / 관심사 설정 / Opportunity Score / D-Day

### 남은 보완 / 미완
- 공유 원격 서버 실제 DB 저장 검증 (인증 미설정으로 미완 — 자체 설정 환경에서 재검증 필요)
- 특정 단과대(design 제목, auto 본문) 상세 추출 정확도
- 프론트 ↔ `/api/notices` 공지 조회 연결

---

## 15. 구현 완료 / 계획 구분

### 구현 완료
- Next.js 프론트 대시보드 (`front/`)
- Node 백엔드 + Qdrant 프로필 CRUD API (`backend/`)
- 공지 크롤러 (목록·본문·첨부·이미지, 캐시, 502/mixed)
- OpenAPI 3.1 명세
- 학적 프로필 모델/검증 (studentType·college·major·grade·interests·customInterests·keywords)
- Opportunity Score / D-Day (deterministic)
- 관심사 추가·삭제
- 공지 원문 import 스크립트 (`import-notices.mjs`)
- Fallback (크롤 mixed/502, DB 503)
- **AI 공지 탐색 챗봇 (RAG)** — `backend/CHATBOT/`, `POST /api/chatbot`, 벡터 청크 컬렉션(`kmu_notice_chunks_v1`), 홈 챗봇 UI 연결, Hallucination 방지
- 벡터 인덱싱 스크립트 (`CHATBOT/index-notices.mjs`), 변경 없는 공지 재임베딩 스킵

### 계획 (미구현 / 설정 필요)
- 챗봇 임베딩·LLM 모델 API 실제 등록 (`.env` `CHATBOT_*`) 및 운영 인덱싱 (현재 모델 미등록)
- 공지 실행 비서 (준비물/체크리스트, 통합 프론트 이식)
- Top 3 캐러셀 통합 프론트 이식
- image_only 공지 Vision AI / OCR, PDF·HWP 첨부 추출
- 실제 AI 이미지 생성 API 연결
- 프론트 ↔ `/api/notices` 연결, 원격 DB production 인증·배포(HTTPS/reverse proxy)
- 사용자 인증/회원가입

---

## 16. 차별화 포인트

1. 국민대학교 단과대학별 실제 공지를 직접 수집 (`backend/src/crawler.mjs`)
2. 소속/전공/관심 기반 개인화 (Qdrant 프로필 + deterministic Score)
3. 자연어로 원하는 공지를 탐색 — 공지 기반 RAG 챗봇 (`backend/CHATBOT/`, `POST /api/chatbot`)
4. 검색된 실제 공지만 출처(`sources[]`)와 함께 근거로 사용 (Hallucination 방지)
5. (계획) 공지를 읽는 데서 끝나지 않고 준비물/체크리스트까지 실행 계획으로 변환

### 핵심 메시지
**“추천에서 끝나는 공지 AI가 아니라, 실제 행동까지 연결하는 대학생활 공지 비서.”**

---

## 17. 저장소 / 실행

### 저장소 구조 (팀 통합본)
```text
front/      Next.js 16 + React 19 + Tailwind v4 (App Router, components/kmu/*)
backend/    Node ≥22 무의존성 서버 + 크롤러 + Qdrant 연동 (src/, CHATBOT/, openapi.json)
docs/       notice-data-spec.md, screenshots/
docker-compose.yml / backend/compose.yaml   (로컬 Qdrant 선택 실행)
mobile-android/local-crawler/   로컬 실험용 크롤러 (output/*.json, 선택)
prd.md
```

### 실행
- 백엔드: `cd backend` → `.env` 설정 → `node --env-file-if-exists=.env src/server.mjs` (Windows `start.cmd`)
- 프론트: `cd front` → `npm run dev` (Next.js)
- 백엔드 기본 주소 `http://127.0.0.1:8001`, 상태 `/api/health`, DB 상태 `/api/db/health`
- 원격 HTTP DB는 `QDRANT_ALLOW_INSECURE_HTTP=true` 명시 시에만 허용(민감 데이터는 HTTPS/SSH 터널 사용)

---

## Kiro 구현 지침 (유지)

1. 실제 구현된 기능과 계획 중인 기능을 항상 구분해 기술한다.
2. Opportunity Score와 D-Day는 deterministic logic으로 유지한다.
3. AI 챗봇/실행 비서는 "공지 생성"이 아니라 "탐색·필터링·요약" 역할만 한다. (이식 시 유지)
4. 크롤링은 국민대학교 지정 단과대학 공지로 제한한다. (로그인/인증 페이지 미접근)
5. 모든 외부 기능(크롤링/DB/이미지/AI)에 fallback을 유지한다.
6. `.env`·자격증명은 커밋 금지, API 노출 금지.
7. 핵심 데모는 "프로필에 따라 추천 순위가 달라지는 것" + "실제 행동까지 연결".
