import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

Group = Literal["barat", "walima"]
Party = Literal["single", "family"]


def normalize_phone(value: str | None) -> str:
    digits = re.sub(r"\D", "", value or "")
    if len(digits) == 10:
        digits = "91" + digits
    return digits


def _dedupe_groups(v: list[str]) -> list[str]:
    return [g for g in ("barat", "walima") if g in v]


# ---- settings ----
class Couple(BaseModel):
    groom: str = Field(max_length=200)
    groomFull: str = Field(max_length=200)
    groomParents: str = Field(max_length=300)
    bride: str = Field(max_length=200)
    brideFull: str = Field(max_length=200)
    brideParents: str = Field(max_length=300)
    hosts: str = Field(max_length=300)
    hashtag: str = Field(max_length=100)


class Contact(BaseModel):
    whatsapp: str = Field(max_length=40)


class Event(BaseModel):
    key: str = Field(pattern=r"^[a-z0-9_-]{1,32}$")
    group: Group
    name: str = Field(max_length=200)
    ur: str = Field(default="", max_length=200)
    date: str
    time: str
    timeLabel: str = Field(default="", max_length=200)
    venue: str = Field(default="", max_length=200)
    addr: str = Field(default="", max_length=300)
    map: str = Field(default="", max_length=1000)
    enabled: bool = True

    @field_validator("date")
    @classmethod
    def _date(cls, v: str) -> str:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
            raise ValueError("date must be YYYY-MM-DD")
        datetime.strptime(v, "%Y-%m-%d")
        return v

    @field_validator("time")
    @classmethod
    def _time(cls, v: str) -> str:
        if not re.fullmatch(r"\d{2}:\d{2}", v):
            raise ValueError("time must be HH:MM")
        datetime.strptime(v, "%H:%M")
        return v


class SettingsModel(BaseModel):
    couple: Couple
    contact: Contact
    timingsTentative: bool
    countdownEvent: str
    events: list[Event] = Field(min_length=1, max_length=20)

    @model_validator(mode="after")
    def _check(self):
        keys = [e.key for e in self.events]
        if len(set(keys)) != len(keys):
            raise ValueError("event keys must be unique")
        if self.countdownEvent not in keys:
            raise ValueError("countdownEvent must be an existing event key")
        return self


# ---- guests ----
class GuestIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=40)
    party: Party = "family"
    invited: list[Group] = Field(default_factory=lambda: ["barat", "walima"], min_length=1)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name is required")
        return v

    @field_validator("phone")
    @classmethod
    def _phone(cls, v):
        return normalize_phone(v)

    @field_validator("invited")
    @classmethod
    def _inv(cls, v):
        return _dedupe_groups(v)


class GuestBulkIn(BaseModel):
    guests: list[GuestIn] = Field(max_length=2000)


class GuestPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=40)
    party: Party | None = None
    invited: list[Group] | None = Field(default=None, min_length=1)
    sent: bool | None = None

    @field_validator("name")
    @classmethod
    def _name(cls, v):
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("name is required")
        return v

    @field_validator("phone")
    @classmethod
    def _phone(cls, v):
        return normalize_phone(v) if v is not None else None

    @field_validator("invited")
    @classmethod
    def _inv(cls, v):
        return _dedupe_groups(v) if v is not None else None


class RsvpIn(BaseModel):
    attending: dict[Group, bool]
    headcount: int = Field(default=1, ge=1, le=50)
    message: str = Field(default="", max_length=500)


class LoginIn(BaseModel):
    password: str = Field(max_length=200)


# ---- output helpers (camelCase dicts) ----
def iso(dt: datetime | None) -> str | None:
    return dt.isoformat() + "Z" if dt else None


def rsvp_out(r) -> dict | None:
    if r is None:
        return None
    return {"attending": r.attending, "headcount": r.headcount, "message": r.message,
            "updatedAt": iso(r.updated_at)}


def guest_out(g) -> dict:
    return {"id": g.id, "code": g.code, "name": g.name, "phone": g.phone, "party": g.party,
            "invited": g.invited, "sentAt": iso(g.sent_at), "openedAt": iso(g.opened_at),
            "createdAt": iso(g.created_at), "rsvp": rsvp_out(g.rsvp)}
