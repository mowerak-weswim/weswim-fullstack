from fastapi import APIRouter

from app.core.config import settings

router = APIRouter()


@router.get("/health")
def api_v1_health() -> dict[str, str]:
    return {"status": "ok", "env": settings.app_env}
