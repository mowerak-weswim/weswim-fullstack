#!/usr/bin/env python3
"""E2E: venue promotion T1 (second requester) and T2 (signup venue)."""

from __future__ import annotations

import sys
from uuid import uuid4

from smoke_e2e import auth_token, env, request_json

VENUE_NAME = "E2ETestPool"
VENUE_ADDR = "Seoul Test-gu Test-ro 1"
VENUE_REGION = "Seoul Test"


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def create_profile(
    api_url: str,
    token: str,
    *,
    nickname: str,
    signup_venue_id: str | None = None,
) -> None:
    body: dict = {"nickname": nickname, "user_type": "member"}
    if signup_venue_id:
        body["signup_venue_id"] = signup_venue_id
    status, payload = request_json(
        f"{api_url}/api/v1/users/profile",
        method="POST",
        headers={**auth_headers(token), "Content-Type": "application/json"},
        body=body,
    )
    if status != 201:
        raise RuntimeError(f"profile failed ({status}): {payload}")


def request_venue(api_url: str, token: str, *, suffix: str) -> dict:
    status, payload = request_json(
        f"{api_url}/api/v1/venues/request",
        method="POST",
        headers={**auth_headers(token), "Content-Type": "application/json"},
        body={
            "name": f"{VENUE_NAME}{suffix}",
            "address": VENUE_ADDR,
            "region": VENUE_REGION,
        },
    )
    if status != 201:
        raise RuntimeError(f"venue request failed ({status}): {payload}")
    if not isinstance(payload, dict):
        raise RuntimeError("venue request invalid payload")
    return payload


def list_notifications(api_url: str, token: str) -> list:
    status, payload = request_json(
        f"{api_url}/api/v1/notifications",
        headers=auth_headers(token),
    )
    if status != 200 or not isinstance(payload, list):
        raise RuntimeError(f"notifications failed ({status}): {payload}")
    return payload


def run() -> None:
    api_url = env("SMOKE_API_URL", "http://localhost:8000").rstrip("/")
    supabase_url = env("SMOKE_SUPABASE_URL", "http://127.0.0.1:54321")
    anon_key = env("SMOKE_SUPABASE_ANON_KEY", "")
    suffix = uuid4().hex[:6]
    email_a = f"e2e-va-{suffix}@example.com"
    email_b = f"e2e-vb-{suffix}@example.com"
    email_c = f"e2e-vc-{suffix}@example.com"
    password = env("SMOKE_PASSWORD", "smokepass123")

    print("[1/6] health")
    status, payload = request_json(f"{api_url}/health")
    if status != 200:
        raise RuntimeError(f"health failed: {payload}")

    print("[2/6] auth user A + profile")
    token_a = auth_token(supabase_url, anon_key, email_a, password)
    create_profile(api_url, token_a, nickname=f"va{suffix}")

    pool_name = f"{VENUE_NAME}{suffix}"

    print("[3/6] user A venue request (pending)")
    status, req_a = request_json(
        f"{api_url}/api/v1/venues/request",
        method="POST",
        headers={**auth_headers(token_a), "Content-Type": "application/json"},
        body={"name": pool_name, "address": VENUE_ADDR, "region": VENUE_REGION},
    )
    if status != 201 or not isinstance(req_a, dict):
        raise RuntimeError(f"venue request A failed ({status}): {req_a}")
    venue_id = str(req_a["venue_id"])
    if req_a.get("status") != "pending":
        raise RuntimeError(f"expected pending, got {req_a}")

    print("[4/6] auth user B + second request (T1, same canonical)")
    token_b = auth_token(supabase_url, anon_key, email_b, password)
    create_profile(api_url, token_b, nickname=f"vb{suffix}")
    status, req_b = request_json(
        f"{api_url}/api/v1/venues/request",
        method="POST",
        headers={**auth_headers(token_b), "Content-Type": "application/json"},
        body={"name": pool_name, "address": VENUE_ADDR, "region": VENUE_REGION},
    )
    if status != 201 or not isinstance(req_b, dict):
        raise RuntimeError(f"venue request B failed ({status}): {req_b}")
    if req_b.get("status") != "active":
        raise RuntimeError(f"T1 expected active, got {req_b}")

    notis_a = list_notifications(api_url, token_a)
    if not any(n.get("type") == "venue_activated" for n in notis_a if isinstance(n, dict)):
        raise RuntimeError("user A missing venue_activated notification")

    print("[5/6] T2: new pending + signup activation")
    token_c = auth_token(supabase_url, anon_key, email_c, password)
    pool_name_c = f"{VENUE_NAME}t2{suffix}"
    status, req_c = request_json(
        f"{api_url}/api/v1/venues/request",
        method="POST",
        headers={**auth_headers(token_a), "Content-Type": "application/json"},
        body={"name": pool_name_c, "address": VENUE_ADDR, "region": VENUE_REGION},
    )
    if status != 201 or not isinstance(req_c, dict):
        raise RuntimeError(f"T2 setup request failed: {req_c}")
    pending_id = str(req_c["venue_id"])
    if req_c.get("status") != "pending":
        raise RuntimeError("T2 setup expected pending venue")

    status, prof = request_json(
        f"{api_url}/api/v1/users/profile",
        method="POST",
        headers={**auth_headers(token_c), "Content-Type": "application/json"},
        body={
            "nickname": f"vc{suffix}",
            "user_type": "member",
            "signup_venue_id": pending_id,
        },
    )
    if status != 201:
        raise RuntimeError(f"T2 profile failed ({status}): {prof}")
    status, venues = request_json(
        f"{api_url}/api/v1/venues?q={pool_name_c}",
        headers=auth_headers(token_c),
    )
    if status != 200:
        raise RuntimeError(f"list venues failed: {venues}")
    active = [
        v
        for v in venues
        if isinstance(v, dict) and str(v.get("venue_id")) == pending_id
    ]
    if not active or active[0].get("status") != "active":
        raise RuntimeError("T2 signup did not activate venue")

    print("[6/6] E2E VENUE PROMOTION PASS")


if __name__ == "__main__":
    try:
        run()
    except Exception as exc:
        print(f"\nE2E VENUE PROMOTION FAIL: {exc}", file=sys.stderr)
        sys.exit(1)
