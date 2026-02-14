from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"), env_file_encoding="utf-8"
    )

    database_url: str = (
        "postgresql+asyncpg://nls_user:set_local_password@localhost:5432/"
        "neighborhood_library"
    )
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    sql_echo: bool = False
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_recycle: int = 1800
    enable_seed: bool = True
    api_title: str = "Neighborhood Library Service"
    api_version: str = "0.1.0"
    auto_create_schema: bool = False
    jwt_secret_key: str = "set_in_env_for_dev_only"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expires_minutes: int = 120
    default_user_password: str = "set_in_env_for_dev_only"
    auth_login_rate_limit_per_window: int = 20
    auth_login_rate_limit_window_seconds: int = 60
    audit_log_enabled: bool = True
    circulation_max_active_loans_per_user: int = 5
    circulation_max_loan_days: int = 21
    overdue_fine_per_day: float = 2.0
    api_cache_enabled: bool = True
    api_cache_ttl_seconds: int = 45
    api_cache_redis_url: str | None = None
    api_cache_namespace: str = "nls:api-cache"


def _ensure_async_driver(url: str) -> str:
    if url.startswith("postgresql+asyncpg://"):
        return url
    if url.startswith("postgresql+psycopg2://"):
        return url.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


settings = Settings()
settings.database_url = _ensure_async_driver(settings.database_url)
