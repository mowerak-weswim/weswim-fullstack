from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import sys
import os

# Vercel 환경에서 루트 폴더(app이 있는 경로)를 인식할 수 있도록 경로 최상단에 추가
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from app.api.router import api_router
from app.core.config import settings
from app.core.cors import get_cors_origin_regex, get_cors_origins

app = FastAPI(
    title="WeSwim API",
    version="0.1.0",
    description="WeSwim swimming community platform API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_origin_regex=get_cors_origin_regex(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "env": settings.app_env}
