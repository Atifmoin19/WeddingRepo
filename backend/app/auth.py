import hmac
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from sqlalchemy.orm import Session

from . import config
from .db import Admin, get_db

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


def make_token(admin_id: str) -> tuple[str, int]:
    minutes = config.jwt_expire_minutes()
    exp = datetime.now(UTC) + timedelta(minutes=minutes)
    token = jwt.encode({"sub": admin_id, "exp": exp}, config.jwt_secret(), algorithm="HS256")
    return token, minutes * 60


def require_admin(creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
                  db: Session = Depends(get_db)) -> Admin:
    """The logged-in admin. A deleted or deactivated admin's token stops working at once."""
    if creds is None:
        raise HTTPException(401, "Not authenticated", headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(creds.credentials, config.jwt_secret(), algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid or expired token", headers={"WWW-Authenticate": "Bearer"})
    sub = payload.get("sub")
    admin = db.get(Admin, sub) if isinstance(sub, str) else None
    if admin is None or not admin.active:
        raise HTTPException(401, "Invalid token", headers={"WWW-Authenticate": "Bearer"})
    return admin


def require_owner(me: Admin = Depends(require_admin)) -> Admin:
    if me.role != "owner":
        raise HTTPException(403, "Only the owner can do this")
    return me
