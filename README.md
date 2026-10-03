# NoE

## 접속 정보

| 서비스 | 주소 | 비고 |
| --- | --- | --- |
| Front (Next.js) | http://14.36.30.189:3001/ | |
| PostgreSQL + pgvector | `14.36.30.189:13000` | DB `noe`, 외부 13000 → 서버 3000 → 컨테이너 5432 |
| PostgreSQL (내부망) | `192.168.0.236:3000` | |

`vector` 확장은 DB 최초 생성 시 `db/init/01-pgvector.sql`로 자동 설치됩니다.
접속 계정(`POSTGRES_USER`, `POSTGRES_PASSWORD`)은 서버의 `.env` 파일을 확인하세요 (저장소에는 커밋하지 않음).

```bash
psql "postgresql://noe:<PASSWORD>@14.36.30.189:13000/noe"
```

## 실행

```bash
docker compose up -d --build
```
