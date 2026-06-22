# WeSwim Backend (weswim-backend)

FastAPI + Supabase. API·DB 코드 SoT 레포.

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env
```

### Supabase (로컬)

```bash
npx supabase start              # Docker 필요
npx supabase db reset           # migrations 적용
```

`.env`에 CLI 출력 URL·`service_role` key 반영.

## Run API

> **Windows:** PATH에 Python 3.14·Anaconda `uvicorn`이 있으면 `ModuleNotFoundError: jose`가 납니다. **반드시 `.venv`의 Python**을 사용하세요.

```powershell
# 권장 (weswim-backend/)
.\scripts\run-api.ps1

# 또는 직접
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

```bash
# WSL / venv 활성화 후
uvicorn main:app --reload --port 8000
```

| URL | 설명 |
|-----|------|
| http://localhost:8000/docs | Swagger |
| http://localhost:8000/health | Health |
| http://localhost:8000/openapi.json | OpenAPI SoT |

## Docs

> 워크스페이스(WeSwim 루트) `docs/` — `weswim-backend/docs/`는 2026-06-03에 통합됨.

| 파일 | 역할 |
|------|------|
| `../docs/TECHNICAL_SPECIFICATION.md` | API·DB·비즈니스 명세 |
| `../docs/DEVELOPMENT.md` §3.6 | 2-repo·SoT |
| `../docs/DEVELOPMENT.md` | 로컬 실행·env (§7 Backend) |
| `../docs/OPERATION.md` | 배포·staging smoke test |
| `../docs/HANDOFF.md` | 세션 인수인계 |
| `supabase/migrations/` | DB SoT |

## Frontend

UI 레포: **weswim-frontend** — `NEXT_PUBLIC_API_URL`로 이 API에 연결.

## GitHub remote

```bash
git remote add origin git@github.com:{org}/weswim-backend.git
git push -u origin main
```
