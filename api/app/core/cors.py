from app.core.config import settings


def get_cors_origins() -> list[str]:
    origins = {
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://weswim-frontend.vercel.app",
        "https://weswim.kr",  # 서비스 메인 도메인
        "https://www.weswim.kr",  # 서비스 메인 도메인
    }

    if settings.app_url:
        origins.add(settings.app_url.rstrip("/"))

    for item in settings.cors_origins.split(","):
        origin = item.strip().rstrip("/")
        if origin:
            origins.add(origin)

    return sorted(origins)


def get_cors_origin_regex() -> str | None:
    pattern = settings.cors_origin_regex.strip()
    return pattern or None
