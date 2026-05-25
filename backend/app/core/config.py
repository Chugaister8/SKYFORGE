import sys
import structlog
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

logger = structlog.get_logger()

INSECURE_SECRETS = {
    "dev-secret-change-in-production",
    "secret",
    "changeme",
    "password",
    "dev",
    "",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name:    str  = "SKYFORGE"
    app_version: str  = "0.2.0"
    environment: str  = "development"
    debug:       bool = True

    # Database
    database_url: str = "postgresql+asyncpg://skyforge:skyforge@postgres:5432/skyforge"

    # Redis
    redis_url: str = "redis://redis:6379"

    # Security
    secret_key:                  str = "dev-secret-change-in-production"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days:   int = 7
    algorithm:                   str = "HS256"

    # Rate limiting
    rate_limit_login:        str = "10/minute"
    rate_limit_register:     str = "5/minute"
    rate_limit_api_default:  str = "200/minute"

    # CORS — comma-separated list
    allowed_origins: str = "http://localhost:3000"

    # WS
    ws_heartbeat_s: int = 30
    ws_max_rooms:   int = 100

    # Login security
    max_login_attempts: int = 5
    lockout_minutes:    int = 15

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        if self.is_production:
            if self.secret_key in INSECURE_SECRETS:
                # Hard fail — insecure secret in production is a blocker
                logger.critical(
                    "INSECURE SECRET_KEY IN PRODUCTION — REFUSING TO START",
                    hint="Set SECRET_KEY env variable to a random 64-char string",
                )
                sys.exit(1)
            if self.debug:
                logger.warning("DEBUG=True in production — disabling")
                object.__setattr__(self, "debug", False)
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
