import secrets
import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker

from . import config

SEED_SETTINGS = {
    "couple": {
        "groom": "Atif", "groomFull": "Atif Moin",
        "groomParents": "S/o Late Mr. Moinul Hayat Khan & Mrs. Darakhshan Begum",
        "bride": "Nargis", "brideFull": "Nargis Siddiqui",
        "brideParents": "D/o Mr. Amanullah Siddiqui & Mrs. Shakeela Bano",
        "hosts": "Mrs. Darakhshan Begum & Family", "hashtag": "#AtifWedsNargis",
    },
    "contact": {"whatsapp": "917007136187"},
    "timingsTentative": True,
    "countdownEvent": "walima",
    "events": [
        {"key": "barat", "group": "barat", "name": "Barat", "ur": "بارات", "date": "2027-10-16",
         "time": "10:00", "timeLabel": "Departure around 10:00 AM", "venue": "Bhitari",
         "addr": "Saidpur, Ghazipur", "map": "", "enabled": True},
        {"key": "nikah", "group": "barat", "name": "Nikah", "ur": "نکاح", "date": "2027-10-16",
         "time": "14:30", "timeLabel": "Around 2 to 3 PM", "venue": "Bhitari",
         "addr": "Saidpur, Ghazipur", "map": "", "enabled": True},
        {"key": "walima", "group": "walima", "name": "Dawat-e-Walima", "ur": "دعوتِ ولیمہ",
         "date": "2027-10-18", "time": "19:00", "timeLabel": "Around 7:00 PM",
         "venue": "Hotel Giriraj", "addr": "Basti, Uttar Pradesh", "map": "", "enabled": True},
    ],
}

CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"


def utcnow() -> datetime:
    """Naive UTC (works the same on SQLite and Postgres)."""
    return datetime.now(UTC).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


class Setting(Base):
    __tablename__ = "wedding_settings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    data: Mapped[dict] = mapped_column(JSON)


class Guest(Base):
    __tablename__ = "wedding_guests"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code: Mapped[str] = mapped_column(String(10), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str] = mapped_column(String(40), default="")
    party: Mapped[str] = mapped_column(String(10), default="family")
    invited: Mapped[list] = mapped_column(JSON)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    opened_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    rsvp: Mapped["Rsvp | None"] = relationship(back_populates="guest", uselist=False,
                                               cascade="all, delete-orphan")


class Rsvp(Base):
    __tablename__ = "wedding_rsvps"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    guest_id: Mapped[str] = mapped_column(ForeignKey("wedding_guests.id"), unique=True)
    attending: Mapped[dict] = mapped_column(JSON)
    headcount: Mapped[int] = mapped_column(Integer, default=1)
    message: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    guest: Mapped[Guest] = relationship(back_populates="rsvp")


_url = config.database_url()
engine = create_engine(
    _url,
    pool_pre_ping=True,
    connect_args={"check_same_thread": False} if _url.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_db():
    with SessionLocal() as db:
        yield db


def init_db() -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.scalar(select(Setting.id).limit(1)) is None:
            db.add(Setting(id=1, data=SEED_SETTINGS))
            db.commit()


def new_code(db) -> str:
    while True:
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(10))
        if db.scalar(select(Guest.id).where(Guest.code == code)) is None:
            return code
