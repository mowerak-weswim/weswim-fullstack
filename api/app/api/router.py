from fastapi import APIRouter

from app.api.v1 import badges as v1_badges
from app.api.v1 import venues as v1_venues
from app.api.v1 import groups as v1_groups
from app.api.v1 import health as v1_health
from app.api.v1 import notifications as v1_notifications
from app.api.v1 import posts as v1_posts
from app.api.v1 import records as v1_records
from app.api.v1 import reports as v1_reports
from app.api.v1 import search as v1_search
from app.api.v1 import users as v1_users

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(v1_health.router, tags=["health"])
api_router.include_router(v1_posts.router, tags=["posts"])
api_router.include_router(v1_users.router)
api_router.include_router(v1_reports.router)
api_router.include_router(v1_records.router)
api_router.include_router(v1_notifications.router)
api_router.include_router(v1_search.router)
api_router.include_router(v1_badges.router)
api_router.include_router(v1_groups.router)
api_router.include_router(v1_venues.router)
