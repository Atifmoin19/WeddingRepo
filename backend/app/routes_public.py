from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import Guest, Rsvp, Setting, get_db, utcnow
from .ratelimit import public_limiter
from .schemas import RsvpIn, rsvp_out

router = APIRouter(prefix="/public", dependencies=[Depends(public_limiter)])


def _guest_by_code(db: Session, code: str) -> Guest:
    guest = db.scalar(select(Guest).where(Guest.code == code.lower()))
    if guest is None:
        raise HTTPException(404, "Invitation not found")
    return guest


@router.get("/invite/{code}")
def get_invite(code: str, db: Session = Depends(get_db)):
    guest = _guest_by_code(db, code)
    if guest.opened_at is None:
        guest.opened_at = utcnow()
        db.commit()
    settings = dict(db.get(Setting, 1).data)
    settings["events"] = [e for e in settings["events"]
                          if e.get("enabled") and e.get("group") in guest.invited]
    return {"guest": {"name": guest.name, "party": guest.party, "invited": guest.invited},
            "settings": settings, "rsvp": rsvp_out(guest.rsvp)}


@router.post("/invite/{code}/rsvp")
def post_rsvp(code: str, body: RsvpIn, db: Session = Depends(get_db)):
    guest = _guest_by_code(db, code)
    extra = [g for g in body.attending if g not in guest.invited]
    if extra:
        raise HTTPException(422, f"Not invited to: {', '.join(extra)}")
    rsvp = guest.rsvp or Rsvp(guest=guest)
    rsvp.attending = dict(body.attending)
    rsvp.headcount = body.headcount
    rsvp.message = body.message
    rsvp.updated_at = utcnow()
    db.add(rsvp)
    db.commit()
    return rsvp_out(rsvp)
