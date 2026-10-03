# NoE

## 접속 정보

| 서비스 | 주소 | 비고 |
| --- | --- | --- |
| Front (Next.js) | http://14.36.30.189:3001/ | |
| Qdrant REST API | http://14.36.30.189:6333 | 대시보드: http://14.36.30.189:6333/dashboard |
| Qdrant gRPC | 14.36.30.189:6334 | |

Qdrant 요청 시 `api-key` 헤더에 API 키가 필요합니다. 키는 서버의 `.env` 파일 `QDRANT_API_KEY` 값을 사용하세요 (저장소에는 커밋하지 않음).

```bash
curl -H "api-key: $QDRANT_API_KEY" http://14.36.30.189:6333/collections
```

## 실행

```bash
docker compose up -d --build
```
