# CHATBOT — 공지 기반 RAG

질문 텍스트 → 질문 임베딩 → Qdrant 벡터 검색 TOP-K(기본 10) → 출처를 붙인 문맥 구성 → LLM 답변의 흐름을 구현합니다. **현재 모델 API는 등록하지 않았으며, 실제 외부 임베딩/LLM 호출·원격 DB 색인을 실행하지 않았습니다.** 미설정 상태에서 가짜 벡터나 답변을 만들지 않습니다.

## 기존 기능과의 구분

- 모든 챗봇 코드는 `backend/CHATBOT/`에 있습니다. `src/server.mjs`에서 라우트만 연결합니다.
- 기존 프로필 저장, 공지 가져오기와 크롤러는 유지합니다. 기존 `front` 코드는 수정하지 않습니다.
- `kmu_academic_profiles_v1`: 개인 학사 정보. 챗봇 검색/LLM 전송 대상이 아닙니다.
- `kmu_notices_raw_v1`: 기존 importer가 저장한 원문. **조회만** 합니다. 원문/이미지/첨부를 덮어쓰지 않습니다.
- `kmu_notice_chunks_v1`: 별도의 공지 검색 벡터 컬렉션. 기존 `noticePointId()` 및 원문 point ID와 연결합니다.
- 원문 컬렉션은 `CHATBOT_RAW_COLLECTION`을 지정하지 않으면 기존 `QDRANT_NOTICES_COLLECTION` 설정을 따릅니다. 둘 다 비우면 `kmu_notices_raw_v1`입니다. 날짜 미상(`dateUnknown`) 공지의 임시 날짜는 검색 출처에 포함하지 않습니다.
- 새 라우트는 기존 Next.js `/api/[...path]` proxy와 호환됩니다. 프런트 챗봇 입력 핸들러의 호출 연결은 별도입니다.

## API

### `POST /api/chatbot`

```json
{ "prompt": "지원 가능한 AI 관련 대회가 있나요?", "topK": 10, "mode": "answer" }
```

- `prompt`: 필수, 1~4000자.
- `topK`: 선택, 기본 10, 1~20 정수. **검색 단위는 공지 텍스트 청크**이므로 같은 공지의 다른 청크가 포함될 수 있습니다.
- `mode`: 기본 `answer`. `prepare`이면 검색 후 LLM에 전달할 messages까지만 반환합니다.
- 브라우저에서 모델 URL·API 키·DB 컬렉션·필터를 지정할 수 없습니다.

답변 결과 예시:

```json
{
  "status": "answered",
  "answer": "공지 원문에서 모집 조건을 확인하세요. [S1]",
  "topK": 10,
  "retrievedCount": 10,
  "contextCount": 10,
  "sources": [
    {
      "reference": "S1", "id": "검색 청크 ID", "noticeId": "cs-123",
      "rawPointId": "원문 DB point UUID", "sourceContentHash": "원문 해시",
      "score": 0.8, "title": "공지 제목", "content": "실제로 모델에 전달한 텍스트",
      "url": "https://cs.kookmin.ac.kr/news/notice/123", "date": "2026-10-03",
      "contentStatus": "text_extracted", "needsOcr": false,
      "needsAttachmentExtraction": false, "reviewRequired": false
    }
  ]
}
```

위 개수·점수·출처는 응답 모양 예시입니다. `prepare`는 `status: prepared`, `answer: null`, `messages: [...]`를 반환합니다. **prepare도 질문 임베딩 API와 실제 검색 벡터 데이터는 필요합니다.** LLM 등록만 나중에 할 수 있다는 뜻입니다.

검색 결과가 없으면 `status: no_results`와 안내 문구만 반환하고 LLM은 호출하지 않습니다. 결과 수가 K보다 적으면 그대로 반환합니다. 문맥은 직렬화한 검색 자료 전체 기준 기본 12,000자로 제한하고, 청크마다 최대 1,600자를 배분합니다. 메타데이터가 아주 길어 예산에 못 들어간 출처는 제외하며 `retrievedCount`와 `contextCount`로 구분합니다. 출처 내용은 모델에 전달된 범위와 같습니다.

### `GET /api/chatbot/status`

임베딩/LLM 설정 유무와 기본 topK를 반환합니다. 키·URL은 반환하지 않으며 DB 연결이나 색인 준비 완료를 보장하는 health check는 아닙니다(`indexReadiness: not_checked`).

### 주요 오류

| 상태 | 코드 | 의미 |
|---|---|---|
| 422 | `CHATBOT_INPUT_INVALID` | 잘못된 질문/옵션 |
| 503 | `EMBEDDING_NOT_CONFIGURED` | 임베딩 API 미등록 |
| 503 | `LLM_NOT_CONFIGURED` | 답변 모델 미등록 (prepare 사용 가능) |
| 503 | `CHATBOT_INDEX_MISSING` | 벡터 컬렉션 미생성 |
| 503 | `CHATBOT_VECTOR_MISMATCH` | 임베딩 차원·벡터 이름·Cosine 설정 불일치 |
| 503 | `CHATBOT_DB_AUTH_FAILED` / `CHATBOT_DB_UNAVAILABLE` | DB 인증/연결 오류 |
| 502 | `EMBEDDING_API_ERROR` / `LLM_API_ERROR` | 모델 API 오류 |
| 504 | `CHATBOT_TIMEOUT` | 전체 요청 제한 시간 초과 |

현재 프런트 proxy가 20초 제한이라 전체 챗봇 처리는 기본 18초(최대 19초)로 제한합니다. 전체 취소 신호를 임베딩, Qdrant, LLM HTTP 요청에 전달합니다. 시간이 오래 걸리는 모델을 쓰면 프런트 timeout 또는 스트리밍/작업 큐도 함께 설계해야 합니다.

## 나중에 API 등록하기

`backend/.env`에 다음 값을 추가합니다. 실제 값은 Git에 커밋하지 않습니다.

```dotenv
CHATBOT_RAW_COLLECTION=kmu_notices_raw_v1
CHATBOT_COLLECTION=kmu_notice_chunks_v1
CHATBOT_TOP_K=10
CHATBOT_EMBEDDING_URL=
CHATBOT_EMBEDDING_MODEL=
CHATBOT_EMBEDDING_SPACE=
CHATBOT_EMBEDDING_API_KEY=
CHATBOT_LLM_URL=
CHATBOT_LLM_MODEL=
CHATBOT_LLM_API_KEY=
CHATBOT_REQUEST_TIMEOUT_MS=18000
```

`CHATBOT_EMBEDDING_SPACE`는 같은 임베딩 공간을 식별하는 이름(예: `모델명-버전`)입니다. 비워 두면 모델명을 사용합니다. **공지와 질문은 동일 모델·버전·차원·전처리로 임베딩**해야 합니다. 모델을 바꿀 때는 space를 바꾸고, 차원이 다르면 검색 컬렉션도 새로 지정하세요. 기존 학사 정보/원문 컬렉션을 재사용하지 않습니다.

추가 선택 설정: `CHATBOT_VECTOR_NAME`(named vector), `CHATBOT_SCORE_THRESHOLD`(Cosine 최소 점수), `CHATBOT_MAX_CONTEXT_CHARS`, `CHATBOT_MAX_OUTPUT_TOKENS`, `CHATBOT_TIMEOUT_MS`(단계별 제한). 실제 유사도 임계값은 자료·모델에 맞춰 평가해야 하므로 기본값은 없습니다.

### 제공자 어댑터 계약

모델 사업자가 정해지지 않아 `providers.mjs`에 **중립 JSON 계약**을 구현했습니다. 특정 사업자의 URL/키만 넣으면 모든 API와 호환되는 것은 아닙니다. 등록할 API의 형식이 다르면 아래 두 어댑터의 요청/응답 변환만 바꾸면 검색 파이프라인은 유지됩니다.

1. `HttpEmbeddingProvider`: `POST CHATBOT_EMBEDDING_URL`에 `{ "model": "...", "input": "질문 또는 공지 청크" }` → `{ "embedding": [0.1, 0.2, ...] }`.
2. `HttpLlmProvider`: `POST CHATBOT_LLM_URL`에 `{ "model": "...", "messages": [{"role":"system","content":"..."},{"role":"user","content":"..."}], "maxOutputTokens": 800 }` → `{ "answer": "텍스트 답변" }`.

키가 있으면 `Authorization: Bearer ...`로 전송합니다. 다른 인증 헤더가 필요한 사업자는 어댑터에서 변경하세요. 모델 URL은 HTTPS 또는 로컬 HTTP만 허용하고 리디렉션을 따르지 않습니다. LLM에는 질문, 허용한 공지 필드, 요청에 담긴 나의 정보(`profile`: 학적·소속·전공·학년·관심 분야·키워드)만 전송합니다. API 키, 저장된 학사 프로필 컬렉션, 원문 HTML, 로컬 이미지 경로는 전달하지 않습니다. 실제 서비스 연결은 외부 제공자에게 질문/공지 텍스트를 전송하므로 해당 제공자의 데이터 처리 정책을 먼저 확인하세요.

## 검색용 벡터 만들기

Qdrant 키와 임베딩 API를 설정한 뒤 **운영자가 명시적으로 실행**합니다. 서버 시작/질문 요청이 자동으로 DB를 변경하지는 않습니다.

```powershell
cd backend
# 기본: 기존 kmu_notices_raw_v1을 50개씩 읽어 별도 벡터 컬렉션에 저장
node --env-file-if-exists=.env CHATBOT/index-notices.mjs
# 선택: 배열 또는 {notices:[...]} / {items:[...]} JSON에서 읽기 (최대 100건/5MB)
node --env-file-if-exists=.env CHATBOT/index-notices.mjs --file notices.json
# 선택: 기존 크롤러에서 신규 목록 읽기
node --env-file-if-exists=.env CHATBOT/index-notices.mjs --crawl
```

이 명령은 임베딩 API 비용과 검색 DB 쓰기를 발생시킵니다. DB 원문 조회는 최대 5,000건으로 제한하며 더 큰 데이터는 범위를 나누어야 합니다. 텍스트는 약 1,400자, 200자 겹침으로 분할합니다. 검증된 `textStatus: extracted` 에셋 텍스트만 추가하며, OCR/첨부 추출 자체는 구현하지 않습니다. 미처리/사용 불가 에셋은 읽거나 다운로드하지 않습니다. 추출 실패·이미지 중심 공지는 제한 사항과 함께 제목/확보한 텍스트만 검색합니다.

같은 원문 point ID·임베딩 공간·청크 번호는 같은 검색 point를 갱신합니다. 성공적으로 저장된 공지가 짧아졌으면 **그 공지·공간의 남은 구형 청크만 제거**합니다. 다른 공지, 다른 모델 공간, 원문/프로필 컬렉션은 건드리지 않습니다. 원문에서 사라진 문서를 전체 동기화 삭제하지는 않습니다. 배치 트랜잭션은 없으므로 실패 시 앞선 문서는 저장됐을 수 있습니다. 여러 색인 작업을 동시에 실행하지 마세요.

## Docker와 충돌 검증

`backend/Dockerfile`에 `COPY CHATBOT ./CHATBOT`을 추가했습니다. 루트 Compose의 기존 환경 변수는 그대로 유지했습니다. Compose는 `backend/.env`를 자동으로 컨테이너에 전달하지 않으므로, 모델 등록 시 필요한 `CHATBOT_*` 값을 backend 서비스의 `environment`/`env_file`로 전달해야 합니다. 키가 포함된 `.env`를 이미지에 복사하지 마세요.

```powershell
node --test test/*.test.mjs
```

테스트는 외부 DB를 바꾸지 않는 모의 제공자/DB 기반입니다. 검색·TOP-K·문맥 구성·LLM 어댑터·빈 결과·타임아웃·원문 DB 계약·기존 API 회귀를 확인합니다. 실제 모델 품질, 실제 임베딩 검색 품질, Docker 빌드와 배포는 별도 검증이 필요합니다.

검색 자료에 포함된 지시를 따르지 않도록 system 메시지와 JSON 문맥을 분리했지만 모델의 프롬프트 주입 내성을 보장하지 않습니다. 답변은 프런트에서 일반 텍스트로 표시하세요. 현재 서비스는 사용자 인증·대화 저장·요청량 제한·스트리밍이 없으므로 외부 공개 전에 인증과 비용 제한을 추가해야 합니다. 기존 proxy가 공개된 배포에서는 모델 설정 전에 특히 확인하세요.

공식 검색 계약: [Qdrant Query points](https://api.qdrant.tech/api-reference/search/query-points). 기존 데이터 계약: [공지 데이터와 DB 명세](../../docs/notice-data-spec.md).
