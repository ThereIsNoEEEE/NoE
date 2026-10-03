# NoE Backend

팀원과 AI 개발 도구를 위한 [공지 데이터와 DB 개발 명세](../docs/notice-data-spec.md)를 참고하세요.

`front`의 학사 정보 입력 모델(`studentType`, `college`, `major`, `grade`, `interests`, `customInterests`, `keywords`)에 맞춘 Node.js 백엔드입니다. Node.js 22 이상, 외부 npm 의존성 없이 실행합니다.

## 구성

```text
backend/
├─ src/
│  ├─ server.mjs             HTTP 서버와 크롤러 API
│  ├─ config.mjs             환경 설정
│  ├─ http.mjs               JSON/오류/요청 크기 제한
│  ├─ crawler.mjs            기존 크롤링 기능 전체를 한 파일로 분리
│  └─ db/
│     ├─ routes.mjs          DB API 엔드포인트
│     ├─ profile-schema.mjs  학사 정보 검증
│     ├─ profiles.mjs        Qdrant 프로필 저장/조회/수정
│     └─ qdrant.mjs          Qdrant REST 연결
├─ examples/                 프런트 연결 및 PowerShell 예제
├─ test/                     파서/HTTP/모의 DB 테스트
├─ scripts/integration.mjs    실제 Qdrant 통합 테스트
├─ openapi.json              OpenAPI 3.1 명세
├─ .env.remote.example       제공된 원격 Qdrant 주소, 키는 비어 있음
├─ .env.example              로컬 Qdrant 설정
└─ compose.yaml              별도 로컬 DB 테스트용 (선택)
```

## 제공된 Qdrant 서버로 실행

저장소 루트에서:

```powershell
cd backend
Copy-Item .env.remote.example .env
# .env의 QDRANT_API_KEY를 실제 서버 키로 설정
node --env-file-if-exists=.env src/server.mjs
```

이미 `.env`가 있으면 덮어쓰지 말고 필요한 항목만 수정하세요. Windows에서는 `start.cmd`도 사용할 수 있습니다. **키를 저장소·브라우저 코드·채팅에 넣지 마세요.** 키는 서버의 기존 `.env`에서 로컬 환경으로 안전하게 설정합니다. 새 백엔드는 `backend/.env` 또는 프로세스 환경 변수만 읽습니다.

- 백엔드 기본 주소: `http://127.0.0.1:8001`
- 사용자 제공 DB: `http://14.36.30.189:13000` (확인된 버전 1.15.4)
- 컬렉션: `kmu_academic_profiles_v1`, 첫 저장 시 생성
- `/api/health`: 백엔드 상태. `/api/db/health`: 실제 DB 연결 상태
- 원격 HTTP는 `QDRANT_ALLOW_INSECURE_HTTP=true`를 명시한 경우에만 허용합니다. HTTP는 키와 데이터를 암호화하지 않습니다. 실제 학사 정보를 보내기 전 HTTPS 또는 SSH 터널을 사용하세요. 기본 로컬 설정은 원격 HTTP를 허용하지 않습니다.

원격 DB를 사용할 때 `backend/compose.yaml`을 실행할 필요는 없습니다. 로컬 DB 테스트가 필요할 때만 해당 폴더에서 `docker compose up -d`를 실행하세요. 로컬 Qdrant는 루프백에만 공개되고 Docker 볼륨으로 저장합니다. 루트 `docker-compose.yml`과 기존 `front`/Qdrant 서비스는 이번 변경에서 건드리지 않았으므로, **루트 Compose만 실행해도 새 backend가 자동 기동되는 것은 아닙니다.**

## DB API

| 메서드 | 엔드포인트 | 용도 |
|---|---|---|
| POST | `/api/db/profiles` | 최초 학사 정보 저장 (201 + UUID) |
| GET | `/api/db/profiles/{id}` | 저장한 학사 정보 조회 |
| PUT | `/api/db/profiles/{id}` | 학사 정보 전체 수정 |
| GET | `/api/db/health` | DB 연결 확인 (데이터 변경 없음) |

POST/PUT 본문 예시 (`Content-Type: application/json`):

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

응답은 `{ id, kind: "academic_profile", schemaVersion: 1, profile, createdAt, updatedAt }`입니다. `id`와 시각은 서버에서 생성합니다. UUID가 Qdrant point ID, 학사 정보가 payload에 저장됩니다. `vectors: {}` 컬렉션과 `vector: {}` point를 사용하며, 아직 임베딩을 생성하거나 벡터 검색을 하지는 않습니다. 추천 벡터는 별도 컬렉션으로 확장할 수 있습니다. `wait=true` 작업 완료 확인 후에만 성공으로 응답합니다.

검증:

- 필수: 학적, 소속, 전공, 학년, 관심 분야 1개 이상.
- 학적은 `학부`/`대학원`, 학부 1~4학년·대학원 1~3학년(프런트 모델과 동일).
- 소속·전공 최대 100자, 관심 항목/키워드 최대 50자, 배열 최대 20개, 본문 최대 32KB.
- `customInterests`/`keywords` 생략 시 빈 배열. PUT은 부분 수정이 아니므로 생략한 배열은 비워집니다.
- 앞뒤 공백과 중복 배열 항목 정리, 추가 필드/잘못된 타입 거부.
- 기존 컬렉션이 다른 벡터 구조라면 503으로 거부하고 삭제/덮어쓰기하지 않습니다.

오류는 `{ error: { code, message, details? } }` 형식입니다. 400=JSON/UUID 오류, 403=미허용 Origin, 404=프로필 없음, 405=메서드 오류, 413=크기 초과, 415=형식 오류, 422=입력 검증, 503=DB 장애/인증/구조 오류입니다. DB 키 오류는 `DB_AUTH_FAILED`로 구분합니다.

첫 POST가 타임아웃되더라도 직전에 DB 저장이 끝났을 수 있어 재시도는 중복 ID를 만들 수 있습니다. 화면은 저장 중 버튼을 비활성화하세요. PUT 동시 수정은 마지막 완료 요청이 우선하며, 이 버전에는 사용자 인증·소유자 확인·중복 요청 방지 키가 없습니다.

## 프런트 연결

이번 변경은 백엔드/API 구현이며 기존 `front` 코드는 수정하지 않았습니다. 현재 화면의 ‘시작하기’는 기존 localStorage 저장 흐름입니다. `examples/profile-client.mjs`의 함수를 폼 저장 핸들러에 연결하세요.

1. 최초 제출 `await createProfile(profile)` 후 반환된 `id` 보관.
2. DB 응답 성공 후에만 온보딩 완료 및 홈 이동.
3. 설정 변경 `await updateProfile(id, profile)`, 복원 `await getProfile(id)`.
4. 실패 시 입력 화면을 유지하고 오류 표시.

프런트의 같은 origin `/api/*`를 backend로 전달하는 Next.js route/rewrite 또는 개발 proxy가 필요합니다. 예제 클라이언트는 같은 origin 호출을 가정합니다. 개발 CORS는 `.env`에 명시한 로컬 origin만 허용하고, `file://`와 임의 외부 웹사이트의 직접 호출은 거부합니다. 현재 backend는 로컬 전용이므로 외부 프런트 주소에서 직접 접속할 수 없습니다. 원격 배포 시 인증/소유권 검증, HTTPS 및 reverse proxy를 먼저 추가해야 합니다.

PowerShell 예제는 실제 DB에 예제 프로필 한 건을 생성합니다:

```powershell
.\examples\save-profile.ps1
```

## 크롤러

`src/crawler.mjs`에 학교/소프트웨어융합대학의 목록·본문·첫 이미지 수집, 정규화, 캐시를 집약했습니다. `GET /api/notices`, `POST /api/crawl`, `GET /api/images/{id}`로 제공합니다. 게시판당 최대 12건, 상세 순차 수집, 목록 10분/본문 1시간 캐시, 강제 갱신 최소 30초 간격입니다. 모든 출처 실패 시 HTTP 502, 일부 실패는 `mode: mixed`입니다. 백엔드는 샘플 공지로 바꾸지 않으며 DB가 없어도 크롤링은 동작합니다. 첫 상세 수집이 프런트의 12초 제한을 넘으면 재시도가 필요할 수 있습니다. 크롤링 결과의 자동 DB 저장, `/api/analyze`, AI 임베딩은 미구현입니다. 외부 JSON 파일의 DB 저장은 아래 가져오기 스크립트로 제공합니다.

## 테스트

```powershell
node --test test/*.test.mjs
node --env-file-if-exists=.env scripts/integration.mjs
```

첫 명령은 크롤러 파싱/검증/HTTP API/Qdrant REST 요청 형식을 모의 DB로 검증합니다. 두 번째는 **실제 Qdrant**에 `kmu_test_<UUID>` 테스트 컬렉션을 만들어 저장/조회/수정/새 클라이언트 조회 후, 그 테스트 컬렉션만 제거합니다. 기존 사용자 컬렉션은 건드리지 않습니다. 키가 없거나 연결에 실패하면 성공으로 처리하지 않습니다.

현재 제공된 원격 서버의 루트 응답은 확인했지만 인증 키가 없어 실제 DB 저장 검증은 완료하지 않았습니다. 키를 설정한 환경에서 두 번째 명령으로 검증하세요.

## 보안 및 공식 참고

`.env`는 git에서 제외하며 API로 노출하지 않습니다. 프로필/키를 로그에 남기지 않습니다. UUID는 인증 수단이 아니므로 공용 서버로 이 백엔드를 그대로 공개하거나 포트 포워딩하지 마세요.

- [Qdrant collection 생성](https://api.qdrant.tech/api-reference/collections/create-collection)
- [Qdrant point 저장](https://api.qdrant.tech/api-reference/points/upsert-points)
- [Qdrant point 조회](https://api.qdrant.tech/api-reference/points/get-point)

## 외부 크롤링 JSON 가져오기

```sh
cd backend
npm run import:notices -- /Users/bong/Downloads/kookmin-notices --dry-run
# backend/.env에 DB 주소·키 설정 후 실제 저장
npm run import:notices -- /Users/bong/Downloads/kookmin-notices --write
```

폴더 또는 JSON 파일 경로를 받으며 배열과 `{ notices: [...] }`, `{ items: [...] }` 형식을 지원합니다. 기본은 dry-run으로 DB 접속·저장·파일 복사를 하지 않습니다. 원문 JSON과 에셋 파일 경로를 검증하고 같은 게시물의 중복을 제거합니다. 검증 오류가 있으면 실제 저장을 시작하지 않습니다.

공지 원문은 프로필과 별도인 `kmu_notices_raw_v1` payload-only 컬렉션에 저장합니다. `--collection`으로 이름을 변경할 수 있지만 프로필 컬렉션은 허용하지 않습니다. 게시판과 게시물 식별자에서 고정 UUID를 생성하므로 같은 파일을 다시 실행하면 동일 point를 갱신합니다. 기존 벡터 컬렉션의 구조를 바꾸거나 삭제하지 않습니다.

payload는 `{ kind: "notice", schemaVersion: 1, notice, analysisStatus: "pending", needsOcr, needsAttachmentExtraction, reviewRequired, assetDirectory }`입니다. 본문·HTML·출처·이미지·첨부·추출 상태를 보존하며 텍스트 길이를 제한하지 않습니다. 작성자 PC의 `file://` 이미지 링크는 `originalUrl`로 보존하고 사용 불가 상태로 표시합니다. 이미지·첨부의 미처리 상태를 명시하며 텍스트 공지라도 이미지에 핵심 정보가 남아 있을 수 있습니다. 지원 대상·마감·요약·임베딩은 이 단계에서 생성하지 않습니다.

데이터 폴더에 포함된 로컬 에셋은 실제 저장 시 `backend/storage/imports/<데이터 해시>/`에 복사합니다. DB에는 경로 참조만 저장하므로 다른 서버로 이동할 때 이 저장 폴더도 함께 배포해야 합니다. `--storage-dir`로 저장 위치를 바꿀 수 있습니다. 원격 이미지·첨부는 자동 다운로드하지 않습니다.

실제 저장 중 오류가 나면 완료 확인된 건수와 실패를 출력하고 종료 코드 1을 반환합니다. 실패한 요청은 DB에서 완료됐을 수 있으므로 같은 파일로 재실행해 갱신하세요. 최신 main의 `/api/db/notices` 목록 조회와 프런트 연결을 반영했습니다. 전체 본문 상세 조회 및 챗봇 연결은 후속 작업입니다.

## 다른 형식의 추가 JSON으로 공지 갱신

```sh
npm run update:notices -- /path/to/kmu-notices.json
npm run update:notices -- /path/to/kmu-notices.json --write
```

첫 명령은 DB 조회 후 업데이트 계획만 출력합니다. 두 번째는 고정 ID를 유지하며 저장하고, 반영한 모든 payload를 다시 조회해 검증합니다. `articleId`와 URL 문자열 이미지 배열을 지원합니다. 기존 로컬 에셋 경로를 보존하고, 추출 실패 및 복원할 수 없는 메뉴 제목 공지는 건너뜁니다. 기존 정상 제목·본문이 새 수집 데이터로 손상되지 않도록 보수적으로 병합합니다. 자세한 규칙은 공지 개발 명세를 참고하세요.

갱신 전 DB 데이터·입력 JSON·검증 보고서는 `storage/updates/`에 남깁니다. 이번 업데이트는 기존 143건 갱신·72건 추가·11건 제외이며 최종 289건입니다. 이 CLI는 신규 로컬 에셋 복사를 지원하지 않으므로 신규 로컬 파일이 있는 패키지는 기본 importer를 먼저 사용합니다.
