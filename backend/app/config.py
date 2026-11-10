"""Settings are read from the environment on each call so tests can change them."""
import os
import secrets

_generated_secret = secrets.token_urlsafe(48)


def database_url() -> str:
    url = os.environ.get("DATABASE_URL") or "sqlite:///./wedding.db"
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


def admin_password_hash() -> str:
    return os.environ.get("ADMIN_PASSWORD_HASH", "").strip()


def admin_password() -> str:
    return os.environ.get("ADMIN_PASSWORD", "")


def jwt_secret() -> str:
    return os.environ.get("JWT_SECRET") or _generated_secret


def jwt_expire_minutes() -> int:
    try:
        return int(os.environ.get("JWT_EXPIRE_MINUTES", "43200"))
    except ValueError:
        return 43200


def allowed_origins() -> list[str]:
    return [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()]
