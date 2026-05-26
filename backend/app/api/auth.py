import structlog
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr, field_validator
import re

from app.core.database import get_db
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token,
)
from app.core.login_limiter import (
    check_login_allowed, record_failed_login, clear_login_failures,
)
from app.core.rate_limiter import limiter
from app.core.config import get_settings
from app.models.user import User, UserRole, UserStatus

logger   = structlog.get_logger()
bearer   = HTTPBearer()
router   = APIRouter()
settings = get_settings()

# ── Schemas ───────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str
    email:    EmailStr
    password: str
    role:     UserRole = UserRole.PILOT

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3 or len(v) > 32:
            raise ValueError("Username must be 3–32 characters")
        if not re.match(r"^[a-zA-Z0-9_\-\.]+$", v):
            raise ValueError("Username may only contain letters, digits, _, -, .")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 128:
            raise ValueError("Password too long")
        return v


class LoginRequest(BaseModel):
    username: str   # accepts username or email
    password: str


class TokenResponse(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"
    expires_in:    int


class UserResponse(BaseModel):
    id:       str
    username: str
    email:    str
    role:     str
    status:   str
    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    tokens: TokenResponse
    user:   UserResponse


class RefreshRequest(BaseModel):
    refresh_token: str


# ── Dependency ────────────────────────────────────────────────────

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "access":
            raise ValueError("Wrong token type")
        user_id: str = payload["sub"]
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")

    result = await db.execute(select(User).where(User.id == user_id))
    user   = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    if user.status != UserStatus.ACTIVE:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account inactive or banned")

    return user


# ── Endpoints ─────────────────────────────────────────────────────

@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.rate_limit_register)
async def register(
    request: Request,
    payload: RegisterRequest,
    db:      AsyncSession = Depends(get_db),
) -> AuthResponse:
    existing = await db.execute(
        select(User).where(
            (User.email == payload.email) | (User.username == payload.username)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "Email or username already registered")

    user = User(
        username        = payload.username,
        email           = str(payload.email),
        hashed_password = hash_password(payload.password),
        role            = payload.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    access  = create_access_token(user.id, username=user.username)
    refresh = create_refresh_token(user.id)

    logger.info("auth.register", user_id=user.id, username=user.username)
    return AuthResponse(
        tokens=TokenResponse(
            access_token=access, refresh_token=refresh,
            expires_in=settings.access_token_expire_minutes * 60,
        ),
        user=UserResponse(
            id=user.id, username=user.username,
            email=user.email, role=user.role, status=user.status,
        ),
    )


@router.post("/login")
@limiter.limit(settings.rate_limit_login)
async def login(
    request: Request,
    payload: LoginRequest,
    db:      AsyncSession = Depends(get_db),
) -> AuthResponse:
    ip = request.client.host if request.client else "unknown"

    # Brute-force check
    allowed, wait_s = await check_login_allowed(ip, payload.username)
    if not allowed:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Too many failed attempts. Try again in {wait_s // 60 + 1} minutes.",
            headers={"Retry-After": str(wait_s)},
        )

    # Find user by username or email
    result = await db.execute(
        select(User).where(
            (User.username == payload.username) | (User.email == payload.username)
        )
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        attempts = await record_failed_login(ip, payload.username)
        remaining = max(0, settings.max_login_attempts - attempts)
        logger.warning("auth.login.failed", username=payload.username, ip=ip, attempts=attempts)
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            f"Invalid credentials. {remaining} attempts remaining.",
        )

    if user.status != UserStatus.ACTIVE:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account inactive or banned")

    # Success — clear failures, update last_login
    await clear_login_failures(ip, payload.username)
    user.last_login = datetime.now(timezone.utc)
    await db.commit()

    access  = create_access_token(user.id, username=user.username)
    refresh = create_refresh_token(user.id)

    logger.info("auth.login", user_id=user.id, username=user.username, ip=ip)
    return AuthResponse(
        tokens=TokenResponse(
            access_token=access, refresh_token=refresh,
            expires_in=settings.access_token_expire_minutes * 60,
        ),
        user=UserResponse(
            id=user.id, username=user.username,
            email=user.email, role=user.role, status=user.status,
        ),
    )


@router.post("/refresh")
async def refresh_token(
    payload: RefreshRequest,
    db:      AsyncSession = Depends(get_db),
) -> TokenResponse:
    try:
        data = decode_token(payload.refresh_token)
        if data.get("type") != "refresh":
            raise ValueError("Not a refresh token")
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")

    result = await db.execute(select(User).where(User.id == data["sub"]))
    user   = result.scalar_one_or_none()
    if not user or user.status != UserStatus.ACTIVE:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")

    access  = create_access_token(user.id, username=user.username)
    refresh = create_refresh_token(user.id)
    return TokenResponse(
        access_token=access, refresh_token=refresh,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(
        id=current_user.id, username=current_user.username,
        email=current_user.email, role=current_user.role, status=current_user.status,
    )


# ── Profile update ────────────────────────────────────────────────

class ProfileUpdate(BaseModel):
    username:     str | None = None
    full_name:    str | None = None
    current_password: str | None = None
    new_password:     str | None = None

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str | None) -> str | None:
        if v is None: return v
        v = v.strip()
        if len(v) < 3 or len(v) > 32:
            raise ValueError("Username must be 3–32 characters")
        import re
        if not re.match(r"^[a-zA-Z0-9_\-\.]+$", v):
            raise ValueError("Invalid characters in username")
        return v

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str | None) -> str | None:
        if v is None: return v
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


@router.patch("/profile")
async def update_profile(
    payload:      ProfileUpdate,
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """Update username, full name, or password."""
    # Password change
    if payload.new_password:
        if not payload.current_password:
            raise HTTPException(400, "Current password required to set new password")
        if not verify_password(payload.current_password, current_user.hashed_password):
            raise HTTPException(400, "Current password incorrect")
        current_user.hashed_password = hash_password(payload.new_password)

    # Username change — check uniqueness
    if payload.username and payload.username != current_user.username:
        existing = await db.execute(
            select(User).where(User.username == payload.username, User.id != current_user.id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(409, "Username already taken")
        current_user.username = payload.username

    if payload.full_name is not None:
        current_user.full_name = payload.full_name

    await db.commit()
    await db.refresh(current_user)
    logger.info("auth.profile_updated", user_id=current_user.id)
    return UserResponse(
        id       = current_user.id,
        username = current_user.username,
        email    = current_user.email,
        role     = current_user.role,
        status   = current_user.status,
    )
