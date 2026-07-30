import re
from typing import Literal

from email_validator import EmailNotValidError, validate_email
from pydantic import BaseModel, Field, field_validator, model_validator

_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,32}$")
_PASSWORD_UPPER_RE = re.compile(r"[A-Z]")
_PASSWORD_LOWER_RE = re.compile(r"[a-z]")
_PASSWORD_DIGIT_RE = re.compile(r"[0-9]")
_PASSWORD_SYMBOL_RE = re.compile(r"[^A-Za-z0-9]")
_NAME_MAX_LEN = 50


def normalize_username(value: str) -> str:
    normalized = value.strip().lower()
    if not _USERNAME_RE.match(normalized):
        raise ValueError(
            "Username must be 3–32 characters: letters, numbers, and underscores only."
        )
    return normalized


def normalize_optional_name(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    if not stripped:
        return None
    if len(stripped) > _NAME_MAX_LEN:
        raise ValueError(f"Name must be at most {_NAME_MAX_LEN} characters.")
    return stripped


def validate_password_strength(password: str) -> str:
    if not password or not password.strip():
        raise ValueError("Password cannot be blank.")
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters.")
    if len(password) > 128:
        raise ValueError("Password must be at most 128 characters.")
    if not _PASSWORD_UPPER_RE.search(password):
        raise ValueError("Password must include an uppercase letter.")
    if not _PASSWORD_LOWER_RE.search(password):
        raise ValueError("Password must include a lowercase letter.")
    if not _PASSWORD_DIGIT_RE.search(password):
        raise ValueError("Password must include a number.")
    if not _PASSWORD_SYMBOL_RE.search(password):
        raise ValueError("Password must include a symbol.")
    return password


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=32)
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def username_format(cls, v: str) -> str:
        return normalize_username(v)

    @field_validator("email")
    @classmethod
    def email_format(cls, v: str) -> str:
        try:
            result = validate_email(v.strip(), check_deliverability=False)
        except EmailNotValidError as exc:
            raise ValueError("Enter a valid email address.") from exc
        return result.normalized.lower()

    @field_validator("password")
    @classmethod
    def password_rules(cls, v: str) -> str:
        return validate_password_strength(v)

    @model_validator(mode="after")
    def passwords_match(self) -> "RegisterRequest":
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        return self


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


class UserPreferences(BaseModel):
    theme: Literal["light", "dark"] = "light"


class MeResponse(BaseModel):
    username: str
    email: str
    first_name: str | None = None
    last_name: str | None = None
    preferences: UserPreferences


class UpdateMeRequest(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=32)
    first_name: str | None = Field(default=None, max_length=_NAME_MAX_LEN)
    last_name: str | None = Field(default=None, max_length=_NAME_MAX_LEN)
    preferences: UserPreferences | None = None

    @field_validator("username")
    @classmethod
    def username_format(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return normalize_username(v)

    @field_validator("first_name", "last_name", mode="before")
    @classmethod
    def name_optional(cls, v: object) -> str | None:
        if v is None:
            return None
        if not isinstance(v, str):
            raise ValueError("Name must be a string.")
        return normalize_optional_name(v)


class UpdateMeResponse(MeResponse):
    access_token: str
    token_type: str = "bearer"


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_rules(cls, v: str) -> str:
        return validate_password_strength(v)

    @model_validator(mode="after")
    def passwords_match(self) -> "ChangePasswordRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        if self.current_password == self.new_password:
            raise ValueError("New password must be different from the current password.")
        return self

