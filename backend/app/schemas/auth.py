from pydantic import BaseModel, EmailStr, field_validator
from app.models.user import UserRole


class RegisterRequest(BaseModel):
    email:    EmailStr
    username: str
    password: str
    role:     UserRole = UserRole.PILOT

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3 or len(v) > 32:
            raise ValueError("Username must be 3–32 characters")
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Username: only letters, digits, _ and -")
        return v.lower()

    @field_validator("password")
    @classmethod
    def password_strong(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    email:    EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"


class UserResponse(BaseModel):
    id:                 str
    email:              str
    username:           str
    role:               UserRole
    full_name:          str | None
    unit:               str | None
    avatar_url:         str | None
    missions_completed: int
    flight_hours:       float
    is_verified:        bool

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    tokens: TokenResponse
    user:   UserResponse
