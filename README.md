# WeSwim Frontend (weswim-frontend)

Next.js 14 · TypeScript · Tailwind · Supabase Auth (client).

## Setup

```bash
copy .env.local.example .env.local
npm install
npm run dev
```

http://localhost:3000

## Docs

> 워크스페이스(WeSwim 루트) `docs/` — FE 전용 `weswim-frontend/docs/`는 2026-06-03에 통합됨.

| 파일 | 역할 |
|------|------|
| `../docs/DEVELOPMENT.md` | env·로컬 (§3.4 Frontend) |
| `../docs/PUBLISH.md` | 퍼블 이식 설명 |
| `../docs/PUBLISH_CHECKLIST.md` | 퍼블 체크 |
| `../docs/DESIGN.md` | UI 요약 |
| `../DESIGN_RULES_PROJECT.md` | 디자인 규칙 상세 |
| `reference/publishing/` | HTML 퍼블 스냅샷 |

**API·DB 명세:** `../docs/TECHNICAL_SPECIFICATION.md` (워크스페이스) · 단독 clone 시 [weswim-backend](https://github.com/{org}/weswim-backend) repo `docs/`

## 환경 변수

`.env.local.example` 참고. **service_role key 사용 금지.**

## GitHub remote

```bash
git remote add origin git@github.com:{org}/weswim-frontend.git
git push -u origin main
```

## 배포

Vercel · Framework: Next.js · Root: `.`

Staging env·smoke test: `../docs/OPERATION.md` §4·§6 · 로컬 운영: §2
