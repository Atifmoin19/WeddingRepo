"""6-digit email login codes. Only an HMAC of the code is stored."""
import hashlib
import hmac
import secrets
from datetime import timedelta

from sqlalchemy import delete, update
from sqlalchemy.exc import InvalidRequestError
from sqlalchemy.orm import Session

from . import config
from .db import OtpCode, utcnow

TTL = timedelta(minutes=10)
MAX_ATTEMPTS = 5


def _hash(email: str, code: str) -> str:
    return hmac.new(config.jwt_secret().encode(), f"{email}:{code}".encode(), hashlib.sha256).hexdigest()


def clear(db: Session, email: str) -> None:
    db.execute(delete(OtpCode).where(OtpCode.email == email))


def issue(db: Session, email: str) -> str:
    """Replaces any earlier code for this email and returns the new one (to be emailed, never stored)."""
    code = f"{secrets.randbelow(1_000_000):06d}"
    clear(db, email)
    db.add(OtpCode(email=email, code_hash=_hash(email, code), attempts=0, expires_at=utcnow() + TTL))
    db.commit()
    return code


def verify(db: Session, email: str, code: str) -> bool:
    """True once for the right code. Every try is counted before it is compared, so parallel
    guesses cannot get more than MAX_ATTEMPTS tries at one code."""
    row = db.get(OtpCode, email)
    if row is None:
        return False
    if row.expires_at <= utcnow():
        clear(db, email)
        db.commit()
        return False
    counted = db.execute(update(OtpCode).where(OtpCode.email == email, OtpCode.attempts < MAX_ATTEMPTS)
                         .values(attempts=OtpCode.attempts + 1)).rowcount
    db.commit()
    if counted != 1:
        clear(db, email)
        db.commit()
        return False
    try:
        db.refresh(row)
    except InvalidRequestError:  # removed by a parallel request
        return False
    if not hmac.compare_digest(row.code_hash, _hash(email, code)):
        if row.attempts >= MAX_ATTEMPTS:  # locked out: this code is gone
            clear(db, email)
            db.commit()
        return False
    used = db.execute(delete(OtpCode).where(OtpCode.email == email, OtpCode.code_hash == row.code_hash)).rowcount
    db.commit()
    return used == 1
