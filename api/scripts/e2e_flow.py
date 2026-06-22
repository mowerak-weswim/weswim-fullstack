#!/usr/bin/env python3
"""WeSwim flow E2E: auth → group find → record(group) → kickpani → notifications.

Usage (local, Supabase + API running):
  cd weswim-backend
  npx supabase db reset   # apply migrations
  uvicorn main:app --reload   # separate terminal
  .venv\\Scripts\\python scripts/e2e_flow.py

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

VENUE_ID = "a0000001-0000-4000-8000-000000000001"
FIND_BODY = {
    "venue_id": VENUE_ID,
    "sport_type": "swimming",
    "level": "beginner_2",
    "schedule": {"days": ["mon", "wed"], "time": "07:00"},
    "create_if_missing": True,
    "join": True,
}


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def run_flow() -> None:
    api_url = env("SMOKE_API_URL", "http://localhost:8000").rstrip("/")
    supabase_url = env("SMOKE_SUPABASE_URL", DEFAULT_SUPABASE_URL)
    anon_key = env("SMOKE_SUPABASE_ANON_KEY", DEFAULT_ANON_KEY)
    suffix = uuid4().hex[:8]
    email_a = env("SMOKE_EMAIL", f"e2e-a-{suffix}@example.com")
    email_b = env("SMOKE_EMAIL_B", f"e2e-b-{suffix}@example.com")
    password = env("SMOKE_PASSWORD", "smokepass123")

    step = 0

    def step_ok(label: str) -> None:
        nonlocal step
        step += 1
        print(f"[{step}/9] {label} OK")

    print(f"[{step + 1}/9] health {api_url}/health")
    status, payload = request_json(f"{api_url}/health")
    if status != 200 or payload.get("status") != "ok":
        raise RuntimeError(f"health failed ({status}): {payload}")
    step_ok("health")

    print(f"[{step + 1}/9] auth user A {email_a}")
    token_a = auth_token(supabase_url, anon_key, email_a, password)
    upsert_profile(supabase_url, anon_key, token_a, email_a)
    step_ok("auth A + profile")

    print(f"[{step + 1}/9] POST /groups/find (user A)")
    status, found = request_json(
        f"{api_url}/api/v1/groups/find",
        method="POST",
        headers=auth_headers(token_a),
        body=FIND_BODY,
    )
    if status != 200 or not isinstance(found, dict) or not found.get("group_id"):
        raise RuntimeError(f"find group A failed ({status}): {found}")
    group_id = found["group_id"]
    step_ok(f"group find A group_id={group_id}")

    print(f"[{step + 1}/9] auth user B {email_b}")
    token_b = auth_token(supabase_url, anon_key, email_b, password)
    upsert_profile(supabase_url, anon_key, token_b, email_b)
    status, joined_b = request_json(
        f"{api_url}/api/v1/groups/{group_id}/join",
        method="POST",
        headers=auth_headers(token_b),
    )
    if status != 200 or not isinstance(joined_b, dict) or not joined_b.get("is_member"):
        raise RuntimeError(f"join group B failed ({status}): {joined_b}")
    step_ok("auth B + POST /groups/:id/join")

    print(f"[{step + 1}/9] POST /records is_public=group (user A)")
    status, record = request_json(
        f"{api_url}/api/v1/records",
        method="POST",
        headers=auth_headers(token_a),
        body={
            "sport_type": "swimming",
            "is_public": "group",
            "record_data": {"distance": 1500, "strokes": ["freestyle"]},
        },
    )
    if status != 201 or not isinstance(record, dict):
        raise RuntimeError(f"create record failed ({status}): {record}")
    record_id = record.get("record_id")
    step_ok(f"record record_id={record_id}")

    print(f"[{step + 1}/9] GET group posts tab=chat (kickpani record_share)")
    status, posts = request_json(
        f"{api_url}/api/v1/groups/{group_id}/posts?tab=chat&limit=20",
        headers=auth_headers(token_a),
    )
    if status != 200 or not isinstance(posts, list):
        raise RuntimeError(f"group posts failed ({status}): {posts}")
    kick = [
        p
        for p in posts
        if isinstance(p, dict) and p.get("category") == "record_share"
    ]
    if not kick:
        raise RuntimeError("no record_share post in group chat tab")
    step_ok(f"kickpani posts count={len(kick)}")

    print(f"[{step + 1}/9] GET /notifications (user B)")
    status, notis = request_json(
        f"{api_url}/api/v1/notifications",
        headers=auth_headers(token_b),
    )
    if status != 200 or not isinstance(notis, list):
        raise RuntimeError(f"notifications failed ({status}): {notis}")
    record_notis = [
        n
        for n in notis
        if isinstance(n, dict) and n.get("type") == "record_share"
    ]
    if not record_notis:
        raise RuntimeError("user B has no record_share notification")
    step_ok(f"notifications record_share count={len(record_notis)}")

    print(f"[{step + 1}/9] schedule comment API")
    status, schedules = request_json(
        f"{api_url}/api/v1/groups/{group_id}/schedules",
        headers=auth_headers(token_a),
    )
    if status != 200 or not isinstance(schedules, list):
        raise RuntimeError(f"list schedules failed ({status}): {schedules}")
    if not schedules:
        status, sched = request_json(
            f"{api_url}/api/v1/groups/{group_id}/schedules",
            method="POST",
            headers=auth_headers(token_a),
            body={
                "type": "rsvp",
                "title": "E2E 일정",
                "scheduled_at": "2026-06-15T07:00:00+09:00",
            },
        )
        if status != 201 or not isinstance(sched, dict):
            raise RuntimeError(f"create schedule failed ({status}): {sched}")
        schedule_id = sched["schedule_id"]
    else:
        schedule_id = schedules[0]["schedule_id"]

    marker = f"e2e-cmt-{uuid4().hex[:6]}"
    status, created_cmt = request_json(
        f"{api_url}/api/v1/groups/{group_id}/schedules/{schedule_id}/comments",
        method="POST",
        headers=auth_headers(token_a),
        body={"content": marker},
    )
    if status != 201:
        raise RuntimeError(f"create schedule comment failed ({status}): {created_cmt}")

    status, comments = request_json(
        f"{api_url}/api/v1/groups/{group_id}/schedules/{schedule_id}/comments",
        headers=auth_headers(token_b),
    )
    if status != 200 or not isinstance(comments, list):
        raise RuntimeError(f"list schedule comments failed ({status}): {comments}")
    if not any(
        isinstance(c, dict) and c.get("content") == marker for c in comments
    ):
        raise RuntimeError("schedule comment not found in list")
    step_ok("schedule comments")

    print("\nE2E FLOW PASS: group → record(kickpani) → notification → schedule comment")


if __name__ == "__main__":
    try:
        run_flow()
    except Exception as exc:
        print(f"\nE2E FLOW FAIL: {exc}", file=sys.stderr)
        sys.exit(1)
