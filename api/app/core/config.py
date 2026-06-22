from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    port: int = 8000
    app_url: str = "http://localhost:3000"
    api_url: str = "http://localhost:8000"
    database_url: str = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    supabase_url: str = "http://127.0.0.1:54321"
    supabase_service_role_key: str = ""
    app_env: str = "development"
    port: int = 8000
    app_url: str = "http://localhost:3000"
    api_url: str = "http://localhost:8000"
    database_url: str = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    supabase_url: str = "http://127.0.0.1:54321"
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""
    # Comma-separated extra CORS origins (staging/prod frontend URLs)
    cors_origins: str = ""
    # e.g. https://.*\.vercel\.app for Vercel Preview (credentials=true → no wildcard origin)
    cors_origin_regex: str = ""


settings = Settings()
