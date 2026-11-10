import csv
import io

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from . import mailer, otp
from .auth import check_password, make_token, require_admin, require_owner
from .db import Admin, Guest, Setting, get_db, get_owner, new_code, utcnow
from .ratelimit import (client_ip, login_limiter, otp_email_hour, otp_email_minute, otp_ip_hour,
                        otp_verify_limiter)
from .schemas import (AdminIn, AdminPatch, GuestBulkIn, GuestIn, GuestPatch, LoginIn, OtpRequestIn,
                      OtpVerifyIn, SettingsModel, admin_brief, admin_out, guest_out, iso, me_out)

router = APIRouter(prefix="/admin")
protected = APIRouter(dependencies=[Depends(require_admin)])
owner_only = APIRouter(dependencies=[Depends(require_owner)])


def _session(admin: Admin) -> dict:
    token, expires_in = make_token(admin.id)
    return {"token": token, "expiresIn": expires_in, "admin": admin_brief(admin)}


@router.post("/login", dependencies=[Depends(login_limiter)])
def login(body: LoginIn, db: Session = Depends(get_db)):
    """Password fallback: logs in as the owner record."""
    owner = get_owner(db) if check_password(body.password) else None
    if owner is None:
        raise HTTPException(401, "Wrong password")
    return _session(owner)


@router.post("/otp/request")
def otp_request(body: OtpRequestIn, request: Request, tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Same answer whether or not the email is an admin's. The email goes out after the response."""
    ip = client_ip(request)
    if otp_email_minute.blocked(body.email):
        raise HTTPException(429, "A code was just requested. Wait a minute before asking for another.")
    if otp_email_hour.blocked(body.email) or otp_ip_hour.blocked(ip):
        raise HTTPException(429, "Too many codes requested. Try again in an hour.")
    for limiter, key in ((otp_email_minute, body.email), (otp_email_hour, body.email), (otp_ip_hour, ip)):
        limiter.add(key)
    admin = db.scalar(select(Admin).where(Admin.email == body.email))
    if admin is not None and admin.active and mailer.can_deliver():
        tasks.add_task(mailer.deliver_otp, admin.email, admin.name, otp.issue(db, admin.email))
    return {"sent": True}


@router.post("/otp/verify", dependencies=[Depends(otp_verify_limiter)])
def otp_verify(body: OtpVerifyIn, db: Session = Depends(get_db)):
    admin = db.scalar(select(Admin).where(Admin.email == body.email)) if otp.verify(db, body.email, body.code) else None
    if admin is None or not admin.active:
        raise HTTPException(401, "Wrong or expired code")
    return _session(admin)


@protected.get("/me")
def get_me(me: Admin = Depends(require_admin)):
    return me_out(me)


# ---- admins (owner only) ----
def _get_admin(db: Session, admin_id: str) -> Admin:
    a = db.get(Admin, admin_id)
    if a is None:
        raise HTTPException(404, "Admin not found")
    return a


@owner_only.get("/admins")
def list_admins(db: Session = Depends(get_db)):
    counts = dict(db.execute(select(Guest.added_by, func.count()).group_by(Guest.added_by)).all())
    rows = db.scalars(select(Admin).order_by(Admin.created_at, Admin.id)).all()
    rows.sort(key=lambda a: a.role != "owner")  # owner first, then oldest first
    return [admin_out(a, counts.get(a.id, 0)) for a in rows]


@owner_only.post("/admins", status_code=201)
def create_admin(body: AdminIn, db: Session = Depends(get_db)):
    if db.scalar(select(Admin.id).where(Admin.email == body.email)) is not None:
        raise HTTPException(409, "An admin with this email already exists")
    a = Admin(name=body.name, email=body.email, phone=body.phone or "", role="admin", active=True)
    db.add(a)
    db.commit()
    return admin_out(a, 0)


@owner_only.patch("/admins/{admin_id}")
def patch_admin(admin_id: str, body: AdminPatch, db: Session = Depends(get_db)):
    a = _get_admin(db, admin_id)
    if body.active is False and a.role == "owner":
        raise HTTPException(400, "The owner cannot be deactivated")
    if body.name is not None:
        a.name = body.name
    if "phone" in body.model_fields_set:
        a.phone = body.phone or ""
    if body.active is not None:
        a.active = body.active
        if not a.active:
            otp.clear(db, a.email)
    db.commit()
    count = db.scalar(select(func.count()).select_from(Guest).where(Guest.added_by == a.id))
    return admin_out(a, count)


@owner_only.delete("/admins/{admin_id}", status_code=204)
def delete_admin(admin_id: str, db: Session = Depends(get_db), me: Admin = Depends(require_owner)):
    a = _get_admin(db, admin_id)
    if a.role == "owner":
        raise HTTPException(400, "The owner cannot be removed")
    db.execute(update(Guest).where(Guest.added_by == a.id).values(added_by=me.id))  # guests stay
    otp.clear(db, a.email)
    db.delete(a)
    db.commit()
    return Response(status_code=204)


# ---- settings ----
@protected.get("/settings")
def get_settings(db: Session = Depends(get_db)):
    return db.get(Setting, 1).data


@owner_only.put("/settings")
def put_settings(body: SettingsModel, db: Session = Depends(get_db)):
    row = db.get(Setting, 1)
    row.data = body.model_dump()
    db.commit()
    return row.data


# ---- guests: the owner sees all of them, an admin only the ones they added ----
def _is_owner(me: Admin) -> bool:
    return me.role == "owner"


def _mine(stmt, me: Admin):
    return stmt if _is_owner(me) else stmt.where(Guest.added_by == me.id)


def _get_guest(db: Session, guest_id: str, me: Admin) -> Guest:
    g = db.get(Guest, guest_id)
    if g is None or not (_is_owner(me) or g.added_by == me.id):
        raise HTTPException(404, "Guest not found")
    return g


def _guests(db: Session, me: Admin):
    return db.scalars(_mine(select(Guest), me).order_by(Guest.created_at.desc(), Guest.id)).all()


@protected.get("/guests")
def list_guests(db: Session = Depends(get_db), me: Admin = Depends(require_admin)):
    return [guest_out(g, _is_owner(me)) for g in _guests(db, me)]


def _make_guest(db: Session, data: GuestIn, me: Admin) -> Guest:
    g = Guest(code=new_code(db), name=data.name, phone=data.phone or "",
              party=data.party, invited=data.invited, added_by=me.id)
    db.add(g)
    db.flush()  # so the next generated code sees this one
    return g


@protected.post("/guests", status_code=201)
def create_guest(body: GuestIn, db: Session = Depends(get_db), me: Admin = Depends(require_admin)):
    g = _make_guest(db, body, me)
    db.commit()
    return guest_out(g, _is_owner(me))


@protected.post("/guests/bulk")
def bulk_guests(body: GuestBulkIn, db: Session = Depends(get_db), me: Admin = Depends(require_admin)):
    # "already exists" is judged within what this admin can see, so it never reveals another admin's guests
    seen = set(p for p in db.scalars(_mine(select(Guest.phone), me)) if p)
    added, skipped = [], 0
    for item in body.guests:
        if item.phone and item.phone in seen:
            skipped += 1
            continue
        if item.phone:
            seen.add(item.phone)
        added.append(_make_guest(db, item, me))
    db.commit()
    return {"added": len(added), "skipped": skipped, "guests": [guest_out(g, _is_owner(me)) for g in added]}


@protected.patch("/guests/{guest_id}")
def patch_guest(guest_id: str, body: GuestPatch, db: Session = Depends(get_db),
                me: Admin = Depends(require_admin)):
    g = _get_guest(db, guest_id, me)
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
    return guest_out(g, _is_owner(me))


@protected.delete("/guests/{guest_id}", status_code=204)
def delete_guest(guest_id: str, db: Session = Depends(get_db), me: Admin = Depends(require_admin)):
    g = _get_guest(db, guest_id, me)
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
def export_csv(db: Session = Depends(get_db), me: Admin = Depends(require_admin)):
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["name", "phone", "party", "invited", "link code", "sent", "opened",
                "attending barat", "attending walima", "headcount", "message", "rsvp time"]
               + (["added by"] if _is_owner(me) else []))
    for g in _guests(db, me):
        r = g.rsvp
        att = r.attending if r else {}
        w.writerow([_safe(x) for x in [
            g.name, g.phone, g.party, ", ".join(g.invited), g.code, iso(g.sent_at), iso(g.opened_at),
            _yn(att, "barat"), _yn(att, "walima"),
            r.headcount if r else "", r.message if r else "", iso(r.updated_at) if r else "",
        ] + ([g.adder.name if g.adder else ""] if _is_owner(me) else [])])
    return Response(out.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": 'attachment; filename="wedding-guests.csv"'})


router.include_router(protected)
router.include_router(owner_only)
