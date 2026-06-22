# Publishing reference (snapshot)

`WeSwim_publishing` 스냅샷 — UI 구현 시 참조.

- **SoT (원본):** monorepo `WeSwim/WeSwim_publishing/` 또는 backend 기획 문서
- **design-system:** `design-system.html`
- **screens:** `screens/*.html` ↔ `src/app/` 라우트 (`docs/TECHNICAL_SPECIFICATION.md` §7)
- **이식 체크:** `WeSwim/docs/PUBLISH_CHECKLIST.md` · 매핑 `WeSwim/PUBLISH_RULES_PROJECT.md`

퍼블 수정 시 frontend PR + 필요 시 원본 `WeSwim_publishing` 동기화.

## CSS 동기화 (화면별)

`WeSwim_publishing/screens/*.html` 의 `<style>` 블록을 추출해 `src/styles/`에 반영한다.

| 퍼블 HTML | React CSS |
|-----------|-----------|
| `signup.html` | `weswim-signup.css` (전역 `.shell`, `.field`, `.btn` 등) |
| `search.html` | `weswim-search.css` (`.search-screen` 스코프) |
| `pool-community.html` | `weswim-pool-community.css` (`.venue-hub` 스코프) |

추출 후 GNB/reset 중복 제거, 페이지 래퍼 클래스로 `.page` 충돌 방지.
