import json
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.v1 import group_lane
from app.core.auth import get_current_user_id
from app.db import get_db_connection
from app.services.badges import evaluate_count_badges
from app.services.notifications import notify_group_members_on_activation

router = APIRouter(prefix="/groups", tags=["groups"])

MAX_MEMBERSHIPS_PER_USER = 10
MAX_WAITING_MEMBERSHIPS_PER_USER = 2


class FindGroupRequest(BaseModel):
    venue_id: UUID
    sport_type: str = Field(default="swimming", max_length=30)
    level: str = Field(max_length=20)
    schedule: dict[str, Any]
    create_if_missing: bool = False
    join: bool = True


class FindGroupResponse(BaseModel):
    group_id: UUID | None = None
    status: str
    message: str
    is_member: bool = False


class GroupDetail(BaseModel):
    group_id: UUID
    venue_id: UUID | None
    venue_name: str | None
    sport_type: str
    level: str
    schedule: dict[str, Any]
    status: str
    member_count: int


class GroupMember(BaseModel):
    user_id: UUID
    nickname: str
    role: str
    joined_at: str


def _normalize_schedule(schedule: dict[str, Any]) -> dict[str, Any]:
    days = schedule.get("days", [])
    time_value = schedule.get("time", "07:00")
    if isinstance(days, list):
        days = sorted(days)
    return {"days": days, "time": time_value}


def _find_existing_group(
    cur: Any,
    *,
    venue_id: UUID,
    sport_type: str,
    level: str,
    schedule_json: str,
) -> dict[str, Any] | None:
    cur.execute(
        """
        SELECT group_id, status FROM groups
        WHERE venue_id = %s
          AND sport_type = %s
          AND level = %s
          AND schedule = %s::jsonb
        """,
        [venue_id, sport_type, level, schedule_json],
    )
    return cur.fetchone()


def _user_is_group_member(cur: Any, *, group_id: UUID, user_id: str) -> bool:
    cur.execute(
        "SELECT 1 FROM group_members WHERE group_id = %s AND user_id = %s",
        [group_id, user_id],
    )
    return cur.fetchone() is not None


def _membership_count(cur: Any, user_id: str) -> int:
    cur.execute(
        "SELECT COUNT(*) AS count FROM group_members WHERE user_id = %s",
        [user_id],
    )
    row = cur.fetchone()
    return int(row["count"]) if row else 0


def _waiting_membership_count(cur: Any, user_id: str) -> int:
    cur.execute(
        """
        SELECT COUNT(*) AS count
        FROM group_members gm
        JOIN groups g ON g.group_id = gm.group_id
        WHERE gm.user_id = %s AND g.status = 'waiting'
        """,
        [user_id],
    )
    row = cur.fetchone()
    return int(row["count"]) if row else 0


def _ensure_can_join_group(
    cur: Any,
    user_id: str,
    *,
    group_status: str,
) -> None:
    if _membership_count(cur, user_id) >= MAX_MEMBERSHIPS_PER_USER:
        raise HTTPException(
            status_code=403,
            detail=f"Maximum group membership reached ({MAX_MEMBERSHIPS_PER_USER})",
        )
    if group_status == "waiting":
        if _waiting_membership_count(cur, user_id) >= MAX_WAITING_MEMBERSHIPS_PER_USER:
            raise HTTPException(
                status_code=403,
                detail=(
                    "Maximum waiting group membership reached "
                    f"({MAX_WAITING_MEMBERSHIPS_PER_USER})"
                ),
            )


def _notify_group_activation(
    cur: Any,
    *,
    group_id: UUID,
    user_id: str,
) -> None:
    cur.execute(
        """
        SELECT v.name FROM groups g
        LEFT JOIN venues v ON v.venue_id = g.venue_id
        WHERE g.group_id = %s
        """,
        [group_id],
    )
    vn = cur.fetchone()
    venue_name = vn["name"] if vn else None
    notify_group_members_on_activation(
        cur,
        group_id=group_id,
        venue_name=venue_name,
        exclude_user_id=user_id,
    )
    evaluate_count_badges(
        cur,
        user_id=user_id,
        condition_type="group_activation",
    )


def _add_user_to_group(
    cur: Any,
    *,
    group_id: UUID,
    user_id: str,
    status_value: str,
) -> tuple[str, bool, bool]:
    """멤버 추가 및 waiting→active 승격. (status_after, activated_now, already_member)."""
    already_member = _user_is_group_member(
        cur, group_id=group_id, user_id=user_id
    )
    if already_member:
        cur.execute(
            "SELECT status FROM groups WHERE group_id = %s",
            [group_id],
        )
        row = cur.fetchone()
        current = row["status"] if row else status_value
        return current, False, True

    _ensure_can_join_group(cur, user_id, group_status=status_value)
    cur.execute(
        """
        INSERT INTO group_members (group_id, user_id, role)
        VALUES (%s, %s, 'member')
        ON CONFLICT (group_id, user_id) DO NOTHING
        """,
        [group_id, user_id],
    )

    cur.execute(
        "SELECT COUNT(*) AS count FROM group_members WHERE group_id = %s",
        [group_id],
    )
    member_count = int(cur.fetchone()["count"])
    status_after = status_value
    activated_now = False
    if status_value == "waiting" and member_count >= 2:
        cur.execute(
            "UPDATE groups SET status = 'active' WHERE group_id = %s",
            [group_id],
        )
        status_after = "active"
        activated_now = True
        _notify_group_activation(cur, group_id=group_id, user_id=user_id)

    return status_after, activated_now, False


def _join_message(status_value: str, *, already_member: bool) -> str:
    if already_member:
        return "이미 이 반에 소속되어 있어요."
    if status_value == "active":
        return "레인방에 입장했습니다!"
    return "오리발 대기방에 입장했습니다. 멤버가 모이면 활성화됩니다."


@router.post("/find", response_model=FindGroupResponse)
def find_group(
    body: FindGroupRequest,
    user_id: str = Depends(get_current_user_id),
) -> FindGroupResponse:
    normalized = _normalize_schedule(body.schedule)
    schedule_json = json.dumps(normalized)

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                existing = _find_existing_group(
                    cur,
                    venue_id=body.venue_id,
                    sport_type=body.sport_type,
                    level=body.level,
                    schedule_json=schedule_json,
                )

                if existing:
                    group_id = existing["group_id"]
                    status_value = existing["status"]
                    already_member = _user_is_group_member(
                        cur, group_id=group_id, user_id=user_id
                    )
                else:
                    group_id = None
                    status_value = "not_found"
                    already_member = False

                if existing and already_member and not body.join:
                    return FindGroupResponse(
                        group_id=group_id,
                        status=status_value,
                        message="이미 이 조건의 반에 소속되어 있어요.",
                        is_member=True,
                    )

                if not existing:
                    if not body.create_if_missing:
                        return FindGroupResponse(
                            group_id=None,
                            status="not_found",
                            message="이 시간대에 맞는 반이 없어요. 대기방을 만들 수 있어요.",
                            is_member=False,
                        )
                    if not body.join:
                        return FindGroupResponse(
                            group_id=None,
                            status="not_found",
                            message="이 시간대에 맞는 반이 없어요. 대기방을 만들 수 있어요.",
                            is_member=False,
                        )
                    _ensure_can_join_group(cur, user_id, group_status="waiting")
                    cur.execute(
                        """
                        INSERT INTO groups (venue_id, sport_type, level, schedule, status)
                        VALUES (%s, %s, %s, %s::jsonb, 'waiting')
                        RETURNING group_id, status
                        """,
                        [
                            body.venue_id,
                            body.sport_type,
                            body.level,
                            schedule_json,
                        ],
                    )
                    created = cur.fetchone()
                    group_id = created["group_id"]
                    status_value = created["status"]
                    already_member = False

                joined_already = False
                if body.join and group_id is not None:
                    status_value, _, joined_already = _add_user_to_group(
                        cur,
                        group_id=group_id,
                        user_id=user_id,
                        status_value=status_value,
                    )

                conn.commit()

                if not body.join:
                    if status_value == "active":
                        message = "활동 중인 레인방을 찾았어요."
                    elif status_value == "waiting":
                        message = "오리발 대기방이 있어요. 대기방 만들기로 입장할 수 있어요."
                    else:
                        message = "이 시간대에 맞는 반이 없어요. 대기방을 만들 수 있어요."
                    return FindGroupResponse(
                        group_id=group_id,
                        status=status_value,
                        message=message,
                        is_member=already_member,
                    )

                return FindGroupResponse(
                    group_id=group_id,
                    status=status_value,
                    message=_join_message(status_value, already_member=joined_already),
                    is_member=True,
                )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/{group_id}/join", response_model=FindGroupResponse)
def join_group(
    group_id: UUID,
    user_id: str = Depends(get_current_user_id),
) -> FindGroupResponse:
    """기존 group_id로 입장 (친구 초대·딥링크용)."""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT group_id, status FROM groups WHERE group_id = %s",
                    [group_id],
                )
                row = cur.fetchone()
                if row is None:
                    raise HTTPException(status_code=404, detail="Group not found")

                status_value = row["status"]
                if status_value == "inactive":
                    raise HTTPException(
                        status_code=403,
                        detail="This group is not open for new members",
                    )

                status_after, _, already_member = _add_user_to_group(
                    cur,
                    group_id=group_id,
                    user_id=user_id,
                    status_value=status_value,
                )
                conn.commit()

                return FindGroupResponse(
                    group_id=group_id,
                    status=status_after,
                    message=_join_message(status_after, already_member=already_member),
                    is_member=True,
                )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/{group_id}", response_model=GroupDetail)
def get_group(group_id: UUID) -> GroupDetail:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                        g.group_id,
                        g.venue_id,
                        v.name AS venue_name,
                        g.sport_type,
                        g.level,
                        g.schedule,
                        g.status,
                        (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.group_id) AS member_count
                    FROM groups g
                    LEFT JOIN venues v ON v.venue_id = g.venue_id
                    WHERE g.group_id = %s
                    """,
                    [group_id],
                )
                row = cur.fetchone()
                if row is None:
                    raise HTTPException(status_code=404, detail="Group not found")
                return GroupDetail(**row)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/{group_id}/members", response_model=list[GroupMember])
def get_group_members(
    group_id: UUID,
    user_id: str = Depends(get_current_user_id),
) -> list[GroupMember]:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT 1 FROM group_members WHERE group_id = %s AND user_id = %s",
                    [group_id, user_id],
                )
                if cur.fetchone() is None:
                    raise HTTPException(status_code=403, detail="Not a group member")

                cur.execute(
                    """
                    SELECT u.user_id, u.nickname, gm.role, gm.joined_at::text
                    FROM group_members gm
                    JOIN users u ON u.user_id = gm.user_id
                    WHERE gm.group_id = %s
                    ORDER BY gm.joined_at ASC
                    """,
                    [group_id],
                )
                return [GroupMember(**row) for row in cur.fetchall()]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.delete("/{group_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave_group(
    group_id: UUID,
    user_id: str = Depends(get_current_user_id),
) -> None:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM group_members WHERE group_id = %s AND user_id = %s",
                    [group_id, user_id],
                )
                conn.commit()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


group_lane.register(router)
