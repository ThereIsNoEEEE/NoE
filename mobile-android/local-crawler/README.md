# KMU Pick AI — Local Crawler

국민대학교 단과대학 공지 페이지를 수집해 프론트엔드용 JSON API로 제공하는 로컬 서버.

## 실행

```bash
node server.mjs --port 8000
```

또는 `run-crawler.bat` 더블클릭 (이 폴더 기준 실행).

서버: http://127.0.0.1:8000

## API

- `GET /api/notices` → `{ success, count, usedFallback, sourceStatus, notices: [...] }`
- `GET /health` → 상태 확인

## 수집 대상 (MVP 3개 단과대학)

| key | 단과대학 | 목록 URL |
|-----|---------|----------|
| cs  | 소프트웨어융합대학 | https://cs.kookmin.ac.kr/news/notice/ |
| biz | 경영대학 | https://biz.kookmin.ac.kr/community/notice/ |
| eng | 공과대학 | https://engineering.kookmin.ac.kr/engineering/etc-board/eng-notice.do |

## 수집 필드

`id, title, date, url, content, sourceCollege, sourceName, sourceType("website")`

## 동작 원칙

- source별 parser 분리, 한 source 실패가 전체 실패로 이어지지 않음 (실패 source만 skip)
- 목록에서 제목/날짜/상세 URL 수집 → 상위 일부만 상세 본문 수집 (과도한 요청 방지)
- 상대 URL → 절대 URL 변환
- URL 또는 title+date 기준 중복 제거, 최신순 정렬
- 요청 timeout 적용
- 로그인/인증 페이지는 수집하지 않음, 공개 접근 범위만 사용
- 전체 실패 또는 0건이면 `sampleNotices.json` 으로 fallback
- Instagram/SNS는 수집하지 않음
