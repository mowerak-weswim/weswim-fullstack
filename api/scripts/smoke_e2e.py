#!/usr/bin/env python3
"""WeSwim staging/local smoke test: login → write post → feed.

Usage (local):
  cd weswim-backend
  .venv\\Scripts\\python scripts/smoke_e2e.py

Usage (staging):
  set SMOKE_API_URL=https://your-api.railway.app
  set SMOKE_SUPABASE_URL=https://xxxx.supabase.co
  set SMOKE_SUPABASE_ANON_KEY=eyJ...
  set SMOKE_EMAIL=smoke@example.com
  set SMOKE_PASSWORD=smokepass123
  python scripts/smoke_e2e.py
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from uuid import uuid4

DEFAULT_SUPABASE_URL = "http://127.0.0.1:54321"
DEFAULT_ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9."
    "CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
)


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def request_json(
    url: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    body: dict | None = None,
) -> tuple[int, dict | list]:
    data = None
    req_headers = dict(headers or {})
    if body is not None:
        data = json.dumps(body).encode()
        req_headers.setdefault("Content-Type", "application/json")

    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            raw = response.read()
            status = response.status
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        status = exc.code

    if not raw:
        return status, {}

    parsed = json.loads(raw)
    return status, parsed


def auth_token(supabase_url: str, anon_key: str, email: str, password: str) -> str:
    base = supabase_url.rstrip("/")
    headers = {"apikey": anon_key, "Content-Type": "application/json"}

    status, payload = request_json(
        f"{base}/auth/v1/token?grant_type=password",
        method="POST",
        headers=headers,
        body={"email": email, "password": password},
    )
    if status == 200 and isinstance(payload, dict) and payload.get("access_token"):
        return str(payload["access_token"])

    status, payload = request_json(
        f"{base}/auth/v1/signup",
        method="POST",
        headers=headers,
        body={"email": email, "password": password},
    )
    if status not in (200, 201):
        raise RuntimeError(f"auth failed ({status}): {payload}")

    token = payload.get("access_token") if isinstance(payload, dict) else None
    if not token and isinstance(payload, dict):
        session = payload.get("session") or {}
        token = session.get("access_token")
    if not token:
        raise RuntimeError(f"auth succeeded but no access_token: {payload}")
    return str(token)


def upsert_profile(supabase_url: str, anon_key: str, token: str, email: str) -> None:
    base = supabase_url.rstrip("/")
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    user_status, user_payload = request_json(
        f"{base}/auth/v1/user",
        headers={"apikey": anon_key, "Authorization": f"Bearer {token}"},
    )
    if user_status != 200 or not isinstance(user_payload, dict):
        raise RuntimeError(f"fetch user failed ({user_status}): {user_payload}")

    user_id = user_payload.get("id")
    if not user_id:
        raise RuntimeError("auth user id missing")

    nickname = email.split("@")[0]
    status, payload = request_json(
        f"{base}/rest/v1/users?on_conflict=user_id",
        method="POST",
        headers=headers,
        body={"user_id": user_id, "email": email, "nickname": nickname},
    )
    if status not in (200, 201, 204):
        raise RuntimeError(f"profile upsert failed ({status}): {payload}")


def run_smoke() -> None:
    api_url = env("SMOKE_API_URL", "http://localhost:8000").rstrip("/")
    supabase_url = env("SMOKE_SUPABASE_URL", DEFAULT_SUPABASE_URL)
    anon_key = env("SMOKE_SUPABASE_ANON_KEY", DEFAULT_ANON_KEY)
    # email = env("SMOKE_EMAIL", f"smoke-{uuid4().hex[:8]}@example.com")
    email = env("SMOKE_EMAIL", f"smoke-{uuid4().hex[:8]}@gmail.com")
    password = env("SMOKE_PASSWORD", "smokepass123")

    print(f"[1/5] health {api_url}/health")
    status, payload = request_json(f"{api_url}/health")
    if status != 200 or payload.get("status") != "ok":
        raise RuntimeError(f"health failed ({status}): {payload}")
    print("  OK")

    print(f"[2/5] auth {email}")
    token = auth_token(supabase_url, anon_key, email, password)
    print("  OK")

    print("[3/5] profile upsert")
    upsert_profile(supabase_url, anon_key, token, email)
    print("  OK")

    marker = f"smoke-{uuid4().hex[:8]}"
    print("[4/5] POST /api/v1/posts")
    status, created = request_json(
        f"{api_url}/api/v1/posts",
        method="POST",
        headers={"Authorization": f"Bearer {token}"},
        body={"category": "free", "title": marker, "content": f"smoke test {marker}"},
    )
    if status != 201 or not isinstance(created, dict):
        raise RuntimeError(f"create post failed ({status}): {created}")
    post_id = created.get("post_id")
    print(f"  OK post_id={post_id}")

    print("[5/5] GET /api/v1/posts")
    status, posts = request_json(f"{api_url}/api/v1/posts?limit=20")
    if status != 200 or not isinstance(posts, list):
        raise RuntimeError(f"feed failed ({status}): {posts}")

    found = any(item.get("post_id") == post_id for item in posts if isinstance(item, dict))
    if not found:
        raise RuntimeError(f"created post not found in feed (post_id={post_id})")
    print("  OK feed contains new post")

    print("\nSMOKE PASS: login → write → feed")


if __name__ == "__main__":
    try:
        run_smoke()
    except Exception as exc:
        print(f"\nSMOKE FAIL: {exc}", file=sys.stderr)
        sys.exit(1)
