#!/usr/bin/env python3
"""WeSwim users E2E: bio PATCH, user report, account delete (auth.users).

Usage (local, Supabase + API running):
  cd weswim-backend
  npx supabase db reset
  uvicorn main:app --reload   # separate terminal
  .venv\\Scripts\\python scripts/e2e_users_bio.py

Env: same as smoke_e2e.py (SMOKE_API_URL, SMOKE_SUPABASE_*, optional SMOKE_EMAIL).
"""

from __future__ import annotations

import sys
from uuid import uuid4

from smoke_e2e import (
    DEFAULT_ANON_KEY,
    DEFAULT_SUPABASE_URL,
    auth_token,
    env,
    request_json,
    upsert_profile,
)


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def run_users_e2e() -> None:
    api_url = env("SMOKE_API_URL", "http://localhost:8000").rstrip("/")
    supabase_url = env("SMOKE_SUPABASE_URL", DEFAULT_SUPABASE_URL)
    anon_key = env("SMOKE_SUPABASE_ANON_KEY", DEFAULT_ANON_KEY)
    suffix = uuid4().hex[:8]
    email_a = env("SMOKE_EMAIL", f"e2e-bio-a-{suffix}@example.com")
    email_b = env("SMOKE_EMAIL_B", f"e2e-bio-b-{suffix}@example.com")
    email_del = f"e2e-del-{suffix}@example.com"
    password = env("SMOKE_PASSWORD", "smokepass123")

    step = 0

    def step_ok(label: str) -> None:
        nonlocal step
        step += 1
        print(f"[{step}/7] {label} OK")

    print(f"[{step + 1}/7] health {api_url}/health")
    status, payload = request_json(f"{api_url}/health")
    if status != 200 or payload.get("status") != "ok":
        raise RuntimeError(f"health failed ({status}): {payload}")
    step_ok("health")

    print(f"[{step + 1}/7] auth users A/B + delete candidate")
    token_a = auth_token(supabase_url, anon_key, email_a, password)
    upsert_profile(supabase_url, anon_key, token_a, email_a)
    token_b = auth_token(supabase_url, anon_key, email_b, password)
    upsert_profile(supabase_url, anon_key, token_b, email_b)
    token_del = auth_token(supabase_url, anon_key, email_del, password)
    upsert_profile(supabase_url, anon_key, token_del, email_del)

    status, me_a = request_json(
        f"{api_url}/api/v1/users/me",
        headers=auth_headers(token_a),
    )
    if status != 200 or not isinstance(me_a, dict):
        raise RuntimeError(f"GET /users/me failed ({status}): {me_a}")
    user_a_id = me_a.get("user_id")
    status, me_b = request_json(
        f"{api_url}/api/v1/users/me",
        headers=auth_headers(token_b),
    )
    if status != 200 or not isinstance(me_b, dict):
        raise RuntimeError(f"GET /users/me B failed ({status}): {me_b}")
    user_b_id = me_b.get("user_id")
    step_ok("auth + profile")

    bio_text = f"E2E bio {suffix}"
    print(f"[{step + 1}/7] PATCH /users/me bio")
    status, patched = request_json(
        f"{api_url}/api/v1/users/me",
        method="PATCH",
        headers=auth_headers(token_a),
        body={"bio": bio_text},
    )
    if status != 200 or patched.get("bio") != bio_text:
        raise RuntimeError(f"bio patch failed ({status}): {patched}")

    status, cleared = request_json(
        f"{api_url}/api/v1/users/me",
        method="PATCH",
        headers=auth_headers(token_a),
        body={"bio": "   "},
    )
    if status != 200 or cleared.get("bio") is not None:
        raise RuntimeError(f"bio clear failed ({status}): {cleared}")
    step_ok("bio save + whitespace→null")

    print(f"[{step + 1}/7] POST /users/{{id}}/reports")
    status, report = request_json(
        f"{api_url}/api/v1/users/{user_b_id}/reports",
        method="POST",
        headers=auth_headers(token_a),
        body={"reason_code": "spam"},
    )
    if status != 201 or not isinstance(report, dict):
        raise RuntimeError(f"report failed ({status}): {report}")
    if str(report.get("target_user_id")) != str(user_b_id):
        raise RuntimeError(f"report target mismatch: {report}")
    step_ok(f"report report_id={report.get('report_id')}")

    print(f"[{step + 1}/7] DELETE /users/me (auth.users)")
    status, _ = request_json(
        f"{api_url}/api/v1/users/me",
        method="DELETE",
        headers=auth_headers(token_del),
    )
    if status != 204:
        raise RuntimeError(f"delete me failed ({status})")

    status, after_del = request_json(
        f"{api_url}/api/v1/users/me",
        headers=auth_headers(token_del),
    )
    if status not in (401, 403, 404):
        raise RuntimeError(f"expected auth error after delete, got ({status}): {after_del}")
    step_ok("delete account + auth.users")

    print(
        "\nE2E USERS PASS: bio → report → delete (auth.users)"
    )


if __name__ == "__main__":
    try:
        run_users_e2e()
    except Exception as exc:
        print(f"\nE2E USERS FAIL: {exc}", file=sys.stderr)
        sys.exit(1)
