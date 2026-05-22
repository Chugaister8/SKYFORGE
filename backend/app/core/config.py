from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # App
    app_name: str = "SKYFORGE"
    app_version: str = "0.1.0"
    environment: str = "development"
    debug: bool = True

    # Database
    database_url: str = "postgresql+asyncpg://skyforge:skyforge@postgres:5432/skyforge"

    # Redis
    redis_url: str = "redis://redis:6379"

    # Security
    secret_key: str = "dev-secret-change-in-production"
    access_token_expire_minutes: int = 60
    algorithm: str = "HS256"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
