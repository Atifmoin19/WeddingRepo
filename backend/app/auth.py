import hmac
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from . import config

_bearer = HTTPBearer(auto_error=False)


def check_password(password: str) -> bool:
    """Fails closed: no configured password means nobody can log in."""
    pw_hash = config.admin_password_hash()
    plain = config.admin_password()
    if pw_hash:
        try:
            return bcrypt.checkpw(password.encode()[:72], pw_hash.encode())
        except ValueError:
            return False
    if plain:
        return hmac.compare_digest(password.encode(), plain.encode())
    return False


def make_token() -> tuple[str, int]:
    minutes = config.jwt_expire_minutes()
    exp = datetime.now(UTC) + timedelta(minutes=minutes)
    token = jwt.encode({"sub": "admin", "exp": exp}, config.jwt_secret(), algorithm="HS256")
    return token, minutes * 60


def require_admin(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> None:
    if creds is None:
        raise HTTPException(401, "Not authenticated", headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(creds.credentials, config.jwt_secret(), algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid or expired token", headers={"WWW-Authenticate": "Bearer"})
    if payload.get("sub") != "admin":
        raise HTTPException(401, "Invalid token", headers={"WWW-Authenticate": "Bearer"})
