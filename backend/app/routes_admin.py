import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import check_password, make_token, require_admin
from .db import Guest, Setting, get_db, new_code, utcnow
from .ratelimit import login_limiter
from .schemas import GuestBulkIn, GuestIn, GuestPatch, LoginIn, SettingsModel, guest_out, iso

router = APIRouter(prefix="/admin")
protected = APIRouter(dependencies=[Depends(require_admin)])


@router.post("/login", dependencies=[Depends(login_limiter)])
def login(body: LoginIn):
    if not check_password(body.password):
        raise HTTPException(401, "Wrong password")
    token, expires_in = make_token()
    return {"token": token, "expiresIn": expires_in}


@protected.get("/settings")
def get_settings(db: Session = Depends(get_db)):
    return db.get(Setting, 1).data


@protected.put("/settings")
def put_settings(body: SettingsModel, db: Session = Depends(get_db)):
    row = db.get(Setting, 1)
    row.data = body.model_dump()
    db.commit()
    return row.data


def _get_guest(db: Session, guest_id: str) -> Guest:
    g = db.get(Guest, guest_id)
    if g is None:
        raise HTTPException(404, "Guest not found")
    return g


@protected.get("/guests")
def list_guests(db: Session = Depends(get_db)):
    rows = db.scalars(select(Guest).order_by(Guest.created_at.desc(), Guest.id)).all()
    return [guest_out(g) for g in rows]


def _make_guest(db: Session, data: GuestIn) -> Guest:
    g = Guest(code=new_code(db), name=data.name, phone=data.phone or "",
              party=data.party, invited=data.invited)
    db.add(g)
    db.flush()  # so the next generated code sees this one
    return g


@protected.post("/guests", status_code=201)
def create_guest(body: GuestIn, db: Session = Depends(get_db)):
    g = _make_guest(db, body)
    db.commit()
    return guest_out(g)


@protected.post("/guests/bulk")
def bulk_guests(body: GuestBulkIn, db: Session = Depends(get_db)):
    seen = set(p for p in db.scalars(select(Guest.phone)) if p)
    added, skipped = [], 0
    for item in body.guests:
        if item.phone and item.phone in seen:
            skipped += 1
            continue
        if item.phone:
            seen.add(item.phone)
        added.append(_make_guest(db, item))
    db.commit()
    return {"added": len(added), "skipped": skipped, "guests": [guest_out(g) for g in added]}


@protected.patch("/guests/{guest_id}")
def patch_guest(guest_id: str, body: GuestPatch, db: Session = Depends(get_db)):
    g = _get_guest(db, guest_id)
    if body.name is not None:
        g.name = body.name
    if "phone" in body.model_fields_set:
        g.phone = body.phone or ""
    if body.party is not None:
        g.party = body.party
    if body.invited is not None:
        g.invited = body.invited
        if g.rsvp:  # drop answers for groups no longer invited
            g.rsvp.attending = {k: v for k, v in g.rsvp.attending.items() if k in body.invited}
    if body.sent is not None:
        g.sent_at = utcnow() if body.sent else None
    db.commit()
    return guest_out(g)


@protected.delete("/guests/{guest_id}", status_code=204)
def delete_guest(guest_id: str, db: Session = Depends(get_db)):
    g = _get_guest(db, guest_id)
    db.delete(g)  # cascades to rsvp
    db.commit()
    return Response(status_code=204)


def _safe(v) -> str:
    s = "" if v is None else str(v)
    return "'" + s if s[:1] in ("=", "+", "-", "@", "\t", "\r") else s


def _yn(attending: dict, group: str) -> str:
    if group not in attending:
        return ""
    return "yes" if attending[group] else "no"


@protected.get("/export.csv")
def export_csv(db: Session = Depends(get_db)):
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["name", "phone", "party", "invited", "link code", "sent", "opened",
                "attending barat", "attending walima", "headcount", "message", "rsvp time"])
    for g in db.scalars(select(Guest).order_by(Guest.created_at.desc(), Guest.id)):
        r = g.rsvp
        att = r.attending if r else {}
        w.writerow([_safe(x) for x in [
            g.name, g.phone, g.party, ", ".join(g.invited), g.code, iso(g.sent_at), iso(g.opened_at),
            _yn(att, "barat"), _yn(att, "walima"),
            r.headcount if r else "", r.message if r else "", iso(r.updated_at) if r else "",
        ]])
    return Response(out.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": 'attachment; filename="wedding-guests.csv"'})


router.include_router(protected)
