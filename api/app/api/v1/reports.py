from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.auth import get_current_user_id
from app.db import get_db_connection

router = APIRouter(prefix="/users", tags=["reports"])

REPORT_REASONS = {"spam", "abuse", "fake", "other"}
KST = timezone(timedelta(hours=9))


class CreateUserReportRequest(BaseModel):
    reason_code: str = Field(pattern="^(spam|abuse|fake|other)$")


class UserReportResponse(BaseModel):
    report_id: UUID
    reporter_id: UUID
    target_user_id: UUID
    reason_code: str
    status: str
    created_at: datetime


@router.post(
    "/{target_user_id}/reports",
    response_model=UserReportResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_user_report(
    target_user_id: UUID,
    body: CreateUserReportRequest,
    reporter_id: str = Depends(get_current_user_id),
) -> UserReportResponse:
    target = str(target_user_id)
    if reporter_id == target:
        raise HTTPException(status_code=400, detail="자기 자신은 신고할 수 없습니다.")
    if body.reason_code not in REPORT_REASONS:
        raise HTTPException(status_code=400, detail="Invalid reason code")

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 FROM users WHERE user_id = %s", [target])
                if cur.fetchone() is None:
                    raise HTTPException(status_code=404, detail="User not found")

                since = datetime.now(tz=KST) - timedelta(hours=24)
                cur.execute(
                    """
                    SELECT report_id
                    FROM user_reports
                    WHERE reporter_id = %s
                      AND target_user_id = %s
                      AND reason_code = %s
                      AND created_at >= %s
                    LIMIT 1
                    """,
                    [reporter_id, target, body.reason_code, since],
                )
                if cur.fetchone() is not None:
                    raise HTTPException(
                        status_code=409,
                        detail="동일 사유 신고는 24시간 후 다시 가능합니다.",
                    )

                cur.execute(
                    """
                    INSERT INTO user_reports (
                      reporter_id, target_user_id, reason_code, status
                    )
                    VALUES (%s, %s, %s, 'pending')
                    RETURNING report_id, reporter_id, target_user_id, reason_code, status, created_at
                    """,
                    [reporter_id, target, body.reason_code],
                )
                row = cur.fetchone()
                conn.commit()
                if row is None:
                    raise HTTPException(status_code=500, detail="Failed to create report")
                return UserReportResponse(**row)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
