import re

from pydantic import BaseModel, EmailStr, Field, field_validator

_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,32}$")


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=32)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def username_format(cls, v: str) -> str:
        normalized = v.strip().lower()
        if not _USERNAME_RE.match(normalized):
            raise ValueError(
                "Username must be 3–32 characters: letters, numbers, and underscores only."
            )
        return normalized

    @field_validator("password")
    @classmethod
    def password_non_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Password cannot be blank.")
        return v


class LoginRequest(BaseModel):
    login: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=1, max_length=128)

    @field_validator("login")
    @classmethod
    def login_non_blank(cls, v: str) -> str:
        normalized = v.strip().lower()
        if not normalized:
            raise ValueError("Username or email cannot be blank.")
        return normalized


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
