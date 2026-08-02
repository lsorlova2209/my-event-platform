from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import text, or_
from datetime import date, datetime
from typing import Optional, List
from io import BytesIO
from pathlib import Path
import os
import secrets
from urllib.parse import quote

from app.database import get_db, engine, Base
from app.models.user import User
from app.models.tournament import Tournament
from app.models.athlete import Athlete, Registration
from app.models.club import Club
from app.models.reference import WeightCategory, Rank, KataType
from app.models.bout import Bout
from app.models.kata_score import KataScore, KataSession
from app.models.secretary_access import SecretaryAccess
from app.auth import hash_password, verify_password, create_token, get_current_user, get_optional_user, require_roles
from app.draw import build_category_draw, subgroup_for_draw_number
from app.kumite_protocol import determine_winner
from app.kata_protocol import ROUND_SCALES, validate_scores, compute_total, determine_round_result
from app.documents import build_category_excel_zip, build_pdf, build_participants_list_pdf, team_standings
from app.kata_registry import KATA_TYPES, KATA_STYLE_ORDER, kata_style
from app.age_group import compute_age_group
from app.notifications import send_email, club_confirm_email_body, smtp_configured
from app.application_import import parse_application_xlsx, preview_dict, fill_application_template
from app.kata_teams import (
    is_kata_group_category,
    assign_kata_group_teams,
    collapse_kata_group_for_draw,
    apply_team_seeds,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="СпортДок API", version="1.0.0")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
_cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", FRONTEND_URL).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_ROOT = Path(os.getenv("UPLOAD_DIR", Path(__file__).resolve().parents[1] / "uploads"))
TOURNAMENT_UPLOAD_DIR = UPLOAD_ROOT / "tournaments"
TOURNAMENT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_COVER_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_COVER_BYTES = 20 * 1024 * 1024
MAX_IMPORT_BYTES = 20 * 1024 * 1024
MAX_REGULATIONS_BYTES = 20 * 1024 * 1024
ALLOWED_REGULATIONS_TYPES = {
    "application/pdf": ".pdf",
}
APPLICATION_TEMPLATE_NAME = "Шаблон_заявки_СпортДок_по_образцу_ПР.xlsx"
APPLICATION_TEMPLATE_PATH = (
    Path(__file__).resolve().parents[2] / "docs" / "templates" / APPLICATION_TEMPLATE_NAME
)


def tournament_public_dict(t: Tournament) -> dict:
    return {
        "id": str(t.id),
        "name": t.name,
        "location": t.location,
        "event_date": str(t.event_date),
        "registration_closes_at": str(t.registration_closes_at) if t.registration_closes_at else None,
        "status": t.status,
        "competition_level": t.competition_level or "municipal",
        "chief_judge": t.chief_judge,
        "chief_secretary": t.chief_secretary,
        "cover_image": t.cover_image,
        "regulations_pdf": getattr(t, "regulations_pdf", None),
        "draw_published": bool(getattr(t, "draw_published", False)),
    }


def _unlink_tournament_upload(relative_path: Optional[str]) -> None:
    if not relative_path or not relative_path.startswith("/uploads/tournaments/"):
        return
    path = UPLOAD_ROOT / relative_path.removeprefix("/uploads/")
    try:
        if path.is_file() and path.resolve().is_relative_to(TOURNAMENT_UPLOAD_DIR.resolve()):
            path.unlink()
    except OSError:
        pass


def _unlink_cover(cover_image: Optional[str]) -> None:
    _unlink_tournament_upload(cover_image)


# ─── СХЕМЫ ────────────────────────────────────────────────────────────────────


class LoginRequest(BaseModel):
    email: str
    password: str

class ClubRegister(BaseModel):
    responsible_name: str
    responsible_position: Optional[str] = None
    full_name: str
    short_name: Optional[str] = None
    region: Optional[str] = None
    contact_phone: Optional[str] = None
    email: str
    password: str
    trainers: Optional[str] = None

class TrainerAdd(BaseModel):
    name: str

class TournamentCreate(BaseModel):
    name: str
    location: Optional[str] = None
    event_date: date
    registration_closes_at: Optional[date] = None
    admin_user_id: str
    competition_level: Optional[str] = "municipal"
    chief_judge: Optional[str] = None
    chief_secretary: Optional[str] = None


class TournamentUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    event_date: Optional[date] = None
    registration_closes_at: Optional[date] = None
    competition_level: Optional[str] = None
    chief_judge: Optional[str] = None
    chief_secretary: Optional[str] = None

class AthleteCreate(BaseModel):
    last_name: str
    first_name: str
    middle_name: Optional[str] = None
    gender: Optional[str] = None
    birth_date: date
    age_years: Optional[str] = None
    weight: Optional[float] = None
    rank: Optional[str] = None
    club_name: Optional[str] = None
    trainer_name: Optional[str] = None
    admission_status: Optional[str] = None
    tournament_id: str
    discipline: str
    category_name: Optional[str] = None
    team_number: Optional[str] = None

class AthleteUpdate(BaseModel):
    last_name: Optional[str] = None
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    gender: Optional[str] = None
    birth_date: Optional[date] = None
    age_years: Optional[str] = None
    weight: Optional[float] = None
    rank: Optional[str] = None
    club_name: Optional[str] = None
    trainer_name: Optional[str] = None

class BoutCreate(BaseModel):
    tournament_id: str
    registration_id_a: str
    registration_id_b: str
    round_label: Optional[str] = "round1"

class BoutResult(BaseModel):
    waza_ari_a: int = 0
    ippon_a: int = 0
    line1_level_a: int = Field(0, ge=0, le=3)
    line2_level_a: int = Field(0, ge=0, le=3)
    line3_level_a: int = Field(0, ge=0, le=3)
    waza_ari_b: int = 0
    ippon_b: int = 0
    line1_level_b: int = Field(0, ge=0, le=3)
    line2_level_b: int = Field(0, ge=0, le=3)
    line3_level_b: int = Field(0, ge=0, le=3)

class KataScoreSubmit(BaseModel):
    tournament_id: str
    registration_id: str
    round_label: str
    scores: List[float]
    kata_name: Optional[str] = None

class KataNameSet(BaseModel):
    kata_name: str

class KataSessionStart(BaseModel):
    category_name: Optional[str] = None
    gender: Optional[str] = None

class SecretaryCreate(BaseModel):
    email: str
    password: str
    name: str

class SecretaryAccessGrant(BaseModel):
    secretary_user_id: str
    discipline: str
    gender: Optional[str] = None
    category_name: Optional[str] = None

class SeedSwapRequest(BaseModel):
    registration_id_a: str
    registration_id_b: str

class DrawRequest(BaseModel):
    force: bool = False

# ─── STARTUP ──────────────────────────────────────────────────────────────────

@app.on_event("startup")
def apply_schema_patches():
    with engine.begin() as conn:
        conn.execute(text(
            "ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS competition_level VARCHAR DEFAULT 'municipal' NOT NULL"
        ))
        conn.execute(text(
            "ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS chief_judge VARCHAR"
        ))
        conn.execute(text(
            "ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS chief_secretary VARCHAR"
        ))
        conn.execute(text(
            "ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS cover_image VARCHAR"
        ))
        conn.execute(text(
            "ALTER TABLE registrations ADD COLUMN IF NOT EXISTS weigh_status VARCHAR"
        ))
        conn.execute(text(
            "ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS draw_published BOOLEAN DEFAULT FALSE NOT NULL"
        ))
        conn.execute(text(
            "ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS regulations_pdf VARCHAR"
        ))

@app.on_event("startup")
def create_admin():
    db = next(get_db())
    existing = db.query(User).filter(User.email == "admin@sportdok.ru").first()
    if not existing:
        admin = User(
            email="admin@sportdok.ru",
            password_hash=hash_password("admin123"),
            role="admin",
            name="Администратор"
        )
        db.add(admin)
        db.commit()

WEIGHT_CATEGORIES = {
    "kumite_ok": [
        "38", "40", "42", "45", "47", "50", "52", "55", "57", "58", "60", "62",
        "63", "65", "67", "68", "70", "70+", "73", "75", "78", "80", "83", "90", "90+",
        "абсолютная категория", "командные соревнования", "двоеборье"
    ],
    "kumite_pk": [
        "35", "40", "45", "50", "55", "60", "65", "70", "75", "75+", "80", "85", "90", "90+", "95"
    ],
    "kumite_sz": [
        "36", "39", "42", "45", "48", "51", "54", "57", "60", "64", "68", "72",
        "76", "76+", "80", "85", "90", "90+"
    ],
}

RANKS = [
    "МСМК", "МС", "КМС", "1 разряд", "2 разряд", "3 разряд",
    "1 юн. разряд", "2 юн. разряд", "3 юн. разряд", "Б/р"
]

@app.on_event("startup")
def seed_reference_catalogs():
    db = next(get_db())
    if db.query(WeightCategory).first() is None:
        categories = [
            WeightCategory(discipline=discipline, name=name, sort_order=i)
            for discipline, names in WEIGHT_CATEGORIES.items()
            for i, name in enumerate(names)
        ]
        db.add_all(categories)
        db.commit()
    if db.query(Rank).first() is None:
        db.add_all([Rank(name=name, sort_order=i) for i, name in enumerate(RANKS)])
        db.commit()
    if db.query(KataType).first() is None:
        kata_types = [
            KataType(group=group, name=name, code=code, coefficient=coefficient, sort_order=i)
            for group, entries in KATA_TYPES.items()
            for i, (code, name, coefficient) in enumerate(entries)
        ]
        db.add_all(kata_types)
        db.commit()

# ─── AUTH ─────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "project": "СпортДок"}

@app.post("/api/v1/auth/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    # проверяем сначала в users (admin)
    user = db.query(User).filter(User.email == data.email).first()
    if user and verify_password(data.password, user.password_hash):
        token = create_token({"sub": str(user.id), "role": user.role})
        return {
            "success": True,
            "token": token,
            "role": user.role,
            "name": user.name,
            "email": data.email,
            "user_id": str(user.id)
        }
    # проверяем в clubs
    club = db.query(Club).filter(Club.email == data.email).first()
    if club and verify_password(data.password, club.password_hash):
        if not club.email_verified:
            return {"success": False, "message": "Подтвердите email - проверьте почту со ссылкой для подтверждения регистрации"}
        if club.status == "pending":
            return {"success": False, "message": "Ваша заявка ещё не одобрена администратором"}
        if club.status == "rejected":
            return {"success": False, "message": "Ваша заявка отклонена"}
        token = create_token({"sub": str(club.id), "role": "club"})
        return {
            "success": True,
            "token": token,
            "role": "club",
            "name": club.short_name or club.full_name,
            "email": data.email,
            "user_id": str(club.id),
            "club_id": str(club.id)
        }
    return {"success": False, "message": "Неверный email или пароль"}

# ─── CLUBS ────────────────────────────────────────────────────────────────────

@app.post("/api/v1/clubs/register")
def register_club(data: ClubRegister, db: Session = Depends(get_db)):
    existing = db.query(Club).filter(Club.email == data.email).first()
    if existing:
        return {"success": False, "message": "Клуб с таким email уже зарегистрирован"}
    token = secrets.token_urlsafe(32)
    club = Club(
        responsible_name=data.responsible_name,
        responsible_position=data.responsible_position,
        full_name=data.full_name,
        short_name=data.short_name,
        region=data.region,
        contact_phone=data.contact_phone,
        email=data.email,
        password_hash=hash_password(data.password),
        trainers=data.trainers,
        status="pending",
        email_verified=False,
        email_verification_token=token
    )
    db.add(club)
    db.commit()

    confirm_link = f"{FRONTEND_URL}/?confirm_email={token}"
    sent = send_email(
        club.email,
        "Подтвердите email — СпортДок",
        club_confirm_email_body(club.responsible_name, club.full_name, confirm_link),
    )
    if sent:
        return {"success": True, "message": "Заявка подана. Проверьте email для подтверждения регистрации."}
    if smtp_configured():
        return {
            "success": True,
            "message": "Заявка сохранена, но письмо не удалось отправить. Напишите администратору — он вышлет ссылку повторно.",
        }
    return {
        "success": True,
        "message": "Заявка подана. На сервере ещё не настроена отправка почты — администратор подтвердит заявку вручную.",
    }

@app.post("/api/v1/clubs/confirm-email")
def confirm_club_email(token: str, db: Session = Depends(get_db)):
    club = db.query(Club).filter(Club.email_verification_token == token).first()
    if not club:
        return {"success": False, "message": "Ссылка недействительна или уже использована"}
    club.email_verified = True
    club.email_verification_token = None
    db.commit()

    # ТЗ 3.2, шаг 3: администратору приходит уведомление о новой заявке
    # только после подтверждения email клубом, а не сразу при регистрации.
    admins = db.query(User).filter(User.role.in_(["admin", "owner"])).all()
    for admin in admins:
        send_email(admin.email, "Новая заявка клуба — требует одобрения",
                   f"Клуб «{club.full_name}» ({club.email}) подтвердил email и ожидает одобрения регистрации.")

    return {"success": True, "message": "Email подтверждён. Ожидайте одобрения администратора."}

@app.get("/api/v1/clubs/")
def list_clubs(db: Session = Depends(get_db)):
    clubs = db.query(Club).order_by(Club.created_at.desc()).all()
    return [
        {
            "id": str(c.id),
            "full_name": c.full_name,
            "short_name": c.short_name,
            "region": c.region,
            "email": c.email,
            "responsible_name": c.responsible_name,
            "status": c.status,
            "trainers": c.trainers,
            "email_verified": c.email_verified,
        }
        for c in clubs
    ]

@app.post("/api/v1/clubs/{club_id}/resend-verification")
def resend_club_verification(club_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, {"admin", "owner"})
    club = db.query(Club).filter(Club.id == club_id).first()
    if not club:
        return {"success": False, "message": "Клуб не найден"}
    if club.email_verified:
        return {"success": False, "message": "Email уже подтверждён"}
    token = secrets.token_urlsafe(32)
    club.email_verification_token = token
    db.commit()
    confirm_link = f"{FRONTEND_URL}/?confirm_email={token}"
    sent = send_email(
        club.email,
        "Подтвердите email — СпортДок",
        club_confirm_email_body(club.responsible_name, club.full_name, confirm_link),
    )
    if not sent:
        return {
            "success": False,
            "message": "Не удалось отправить письмо. Проверьте SMTP_* в .env на сервере.",
        }
    return {"success": True, "message": f"Письмо отправлено на {club.email}"}


@app.post("/api/v1/clubs/{club_id}/force-verify-email")
def force_verify_club_email(club_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Админ вручную отмечает email подтверждённым (если письмо не дошло)."""
    require_roles(current_user, {"admin", "owner"})
    club = db.query(Club).filter(Club.id == club_id).first()
    if not club:
        return {"success": False, "message": "Клуб не найден"}
    club.email_verified = True
    club.email_verification_token = None
    db.commit()
    return {"success": True, "message": f"Email клуба {club.full_name} отмечен как подтверждённый"}


@app.post("/api/v1/clubs/{club_id}/approve")
def approve_club(club_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, {"admin", "owner"})
    club = db.query(Club).filter(Club.id == club_id).first()
    if not club:
        return {"success": False, "message": "Клуб не найден"}
    club.status = "approved"
    db.commit()
    send_email(club.email, "Заявка одобрена — СпортДок",
               f"Здравствуйте, {club.responsible_name}!\n\nВаш клуб «{club.full_name}» одобрен. Теперь вы можете регистрировать участников соревнований.")
    return {"success": True, "message": f"Клуб {club.full_name} одобрен"}

@app.post("/api/v1/clubs/{club_id}/reject")
def reject_club(club_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, {"admin", "owner"})
    club = db.query(Club).filter(Club.id == club_id).first()
    if not club:
        return {"success": False, "message": "Клуб не найден"}
    club.status = "rejected"
    db.commit()
    return {"success": True, "message": f"Клуб {club.full_name} отклонён"}

@app.get("/api/v1/clubs/{club_id}/trainers")
def list_club_trainers(club_id: str, db: Session = Depends(get_db)):
    club = db.query(Club).filter(Club.id == club_id).first()
    if not club:
        return {"success": False, "message": "Клуб не найден"}
    trainers = [t.strip() for t in (club.trainers or "").split(",") if t.strip()]
    return {"success": True, "trainers": trainers}

@app.post("/api/v1/clubs/{club_id}/trainers")
def add_club_trainer(club_id: str, data: TrainerAdd, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, {"admin", "owner", "club"})
    if current_user["role"] == "club" and current_user["user_id"] != club_id:
        raise HTTPException(status_code=403, detail="Нет доступа к этому клубу")
    club = db.query(Club).filter(Club.id == club_id).first()
    if not club:
        return {"success": False, "message": "Клуб не найден"}
    trainers = [t.strip() for t in (club.trainers or "").split(",") if t.strip()]
    name = data.name.strip()
    if not name:
        return {"success": False, "message": "Укажите ФИО тренера"}
    if name in trainers:
        return {"success": False, "message": "Такой тренер уже есть в списке"}
    trainers.append(name)
    club.trainers = ", ".join(trainers)
    db.commit()
    return {"success": True, "trainers": trainers}

@app.delete("/api/v1/clubs/{club_id}/trainers")
def remove_club_trainer(club_id: str, name: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, {"admin", "owner", "club"})
    if current_user["role"] == "club" and current_user["user_id"] != club_id:
        raise HTTPException(status_code=403, detail="Нет доступа к этому клубу")
    club = db.query(Club).filter(Club.id == club_id).first()
    if not club:
        return {"success": False, "message": "Клуб не найден"}
    trainers = [t.strip() for t in (club.trainers or "").split(",") if t.strip()]
    if name not in trainers:
        return {"success": False, "message": "Тренер не найден"}
    trainers.remove(name)
    club.trainers = ", ".join(trainers)
    db.commit()
    return {"success": True, "trainers": trainers}

# ─── TOURNAMENTS ──────────────────────────────────────────────────────────────

@app.post("/api/v1/tournaments/")
def create_tournament(data: TournamentCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, {"admin", "owner"})
    tournament = Tournament(
        name=data.name,
        location=data.location,
        event_date=data.event_date,
        registration_closes_at=data.registration_closes_at,
        admin_user_id=data.admin_user_id,
        competition_level=data.competition_level or "municipal",
        chief_judge=(data.chief_judge or "").strip() or None,
        chief_secretary=(data.chief_secretary or "").strip() or None,
        status="draft"
    )
    db.add(tournament)
    db.commit()
    db.refresh(tournament)
    return {"success": True, **tournament_public_dict(tournament)}

@app.get("/api/v1/tournaments/")
def list_tournaments(db: Session = Depends(get_db)):
    tournaments = db.query(Tournament).order_by(Tournament.event_date.desc(), Tournament.created_at.desc()).all()
    return [tournament_public_dict(t) for t in tournaments]


@app.patch("/api/v1/tournaments/{tournament_id}")
def update_tournament(tournament_id: str, data: TournamentUpdate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, {"admin", "owner"})
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        return {"success": False, "message": "Турнир не найден"}
    payload = data.model_dump(exclude_unset=True)
    for key, value in payload.items():
        if key in ("chief_judge", "chief_secretary", "location", "name") and isinstance(value, str):
            value = value.strip() or None
        setattr(tournament, key, value)
    db.commit()
    db.refresh(tournament)
    return {"success": True, **tournament_public_dict(tournament)}


@app.post("/api/v1/tournaments/{tournament_id}/cover")
async def upload_tournament_cover(
    tournament_id: str,
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_roles(current_user, {"admin", "owner"})
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        return {"success": False, "message": "Турнир не найден"}

    content_type = (file.content_type or "").split(";")[0].strip().lower()
    ext = ALLOWED_COVER_TYPES.get(content_type)
    if not ext:
        return {"success": False, "message": "Нужен файл JPG, PNG или WebP"}

    data = await file.read()
    if not data:
        return {"success": False, "message": "Пустой файл"}
    if len(data) > MAX_COVER_BYTES:
        return {"success": False, "message": "Файл больше 20 МБ"}

    _unlink_cover(tournament.cover_image)
    filename = f"{tournament.id}{ext}"
    dest = TOURNAMENT_UPLOAD_DIR / filename
    with dest.open("wb") as out:
        out.write(data)

    tournament.cover_image = f"/uploads/tournaments/{filename}"
    db.commit()
    db.refresh(tournament)
    return {"success": True, **tournament_public_dict(tournament)}


@app.post("/api/v1/tournaments/{tournament_id}/regulations")
async def upload_tournament_regulations(
    tournament_id: str,
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_roles(current_user, {"admin", "owner"})
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        return {"success": False, "message": "Турнир не найден"}

    content_type = (file.content_type or "").split(";")[0].strip().lower()
    filename_hint = (file.filename or "").lower()
    is_pdf = content_type in ALLOWED_REGULATIONS_TYPES or filename_hint.endswith(".pdf")
    if not is_pdf:
        return {"success": False, "message": "Нужен файл PDF"}

    data = await file.read()
    if not data:
        return {"success": False, "message": "Пустой файл"}
    if len(data) > MAX_REGULATIONS_BYTES:
        return {"success": False, "message": "Файл больше 20 МБ"}
    if not data.startswith(b"%PDF"):
        return {"success": False, "message": "Файл не похож на PDF"}

    _unlink_tournament_upload(getattr(tournament, "regulations_pdf", None))
    filename = f"{tournament.id}_regulations.pdf"
    dest = TOURNAMENT_UPLOAD_DIR / filename
    with dest.open("wb") as out:
        out.write(data)

    tournament.regulations_pdf = f"/uploads/tournaments/{filename}"
    db.commit()
    db.refresh(tournament)
    return {"success": True, **tournament_public_dict(tournament)}


@app.delete("/api/v1/tournaments/{tournament_id}/regulations")
def delete_tournament_regulations(
    tournament_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_roles(current_user, {"admin", "owner"})
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        return {"success": False, "message": "Турнир не найден"}
    _unlink_tournament_upload(getattr(tournament, "regulations_pdf", None))
    tournament.regulations_pdf = None
    db.commit()
    db.refresh(tournament)
    return {"success": True, **tournament_public_dict(tournament)}


@app.delete("/api/v1/tournaments/{tournament_id}")
def delete_tournament(tournament_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, {"admin", "owner"})
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        return {"success": False, "message": "Турнир не найден"}
    name = tournament.name
    cover = tournament.cover_image
    regulations = getattr(tournament, "regulations_pdf", None)
    db.query(Registration).filter(Registration.tournament_id == tournament_id).delete()
    db.delete(tournament)
    db.commit()
    _unlink_cover(cover)
    _unlink_tournament_upload(regulations)
    return {"success": True, "message": f"Турнир {name} удалён"}

def draw_category_key(discipline, category_name):
    """The 'category' a registration draws/scores into. For ката this is the
    style (Ашихара/Косики/...), not the specific ката the athlete picked -
    same as the official protocols (docs/samples), where one сетка/protocol
    page covers a whole style regardless of which ката each competitor
    performs. Кумитэ keeps using category_name (weight class) as-is."""
    return kata_style(category_name) if discipline == "kata" else category_name


NO_WEIGH_CATEGORIES = {"абсолютная категория", "двоеборье", "командные соревнования"}
KUMITE_DISCIPLINES = {"kumite_ok", "kumite_pk", "kumite_sz"}


def weigh_admit_required(discipline, category_name):
    if discipline not in KUMITE_DISCIPLINES:
        return False
    return (category_name or "").strip().lower() not in NO_WEIGH_CATEGORIES


def registration_eligible_for_draw(reg):
    """Ката / АБС / двоеборье / команды — только мандатный допуск.
    Весовые категории кумитэ — мандатный и весовой допуск."""
    if getattr(reg, "admission_status", None) != "approved":
        return False
    if weigh_admit_required(reg.discipline, reg.category_name):
        return getattr(reg, "weigh_status", None) == "approved"
    return True


def category_sort_key(cat):
    """Groups ката categories together in official style order (Ашихара,
    Косики, ...); leaves everything else in its original relative order."""
    if cat["discipline"] == "kata":
        try:
            style_index = KATA_STYLE_ORDER.index(cat["category_name"])
        except ValueError:
            style_index = len(KATA_STYLE_ORDER)
        return (0, style_index, cat.get("gender") or "")
    return (1, 0, "")


def _draw_needs_repair(participants, discipline):
    """Old draw assigned seeds 1..k per subgroup (duplicate № жребья in category)."""
    if discipline == "kata":
        return False
    n = len(participants)
    if n == 0:
        return False
    regs = [p["_reg"] for p in participants]
    seeds = [r.seed for r in regs if r.seed is not None]
    if len(seeds) != n:
        return False
    if len(set(seeds)) != n:
        return True
    if n >= 5:
        if set(seeds) != set(range(1, n + 1)):
            return True
        for reg in regs:
            expected = subgroup_for_draw_number(reg.seed, n)
            if reg.subgroup != expected:
                return True
    return False


def _renumber_category_seeds(participants):
    """Fix duplicate № жребья (1,2,3 per half) → global 1..N without touching bouts."""
    n = len(participants)
    if n < 5:
        return False
    by_sg = {1: [], 2: []}
    for p in participants:
        reg = p["_reg"]
        sg = reg.subgroup if reg.subgroup in (1, 2) else (1 if (reg.seed or 0) % 2 == 1 else 2)
        by_sg[sg].append(p)
    changed = False
    for sg, group in by_sg.items():
        group.sort(key=lambda p: (p["_reg"].seed or 999, str(p["_reg"].id)))
        for i, p in enumerate(group):
            new_seed = 2 * i + sg
            if p["_reg"].seed != new_seed or p["_reg"].subgroup != sg:
                p["_reg"].seed = new_seed
                p["_reg"].subgroup = sg
                changed = True
    return changed


def _category_has_completed_bouts(db, tournament_id, discipline, gender, category_name):
    return db.query(Bout).filter(
        Bout.tournament_id == tournament_id,
        Bout.discipline == discipline,
        Bout.gender == gender,
        Bout.category_name == category_name,
        Bout.status == "completed",
    ).first() is not None


def _clear_category_draw(db, tournament_id, discipline, gender, category_name, participants):
    db.query(Bout).filter(
        Bout.tournament_id == tournament_id,
        Bout.discipline == discipline,
        Bout.gender == gender,
        Bout.category_name == category_name,
        Bout.status != "completed",
    ).delete(synchronize_session=False)
    seen = set()
    for p in participants:
        reg = p["_reg"]
        reg.seed = None
        reg.subgroup = None
        seen.add(str(reg.id))
    # Сбрасываем № жребья и у недопущенных (их нет в списке жеребьёвки)
    rows = (
        db.query(Registration, Athlete)
        .join(Athlete, Registration.athlete_id == Athlete.id)
        .filter(Registration.tournament_id == tournament_id, Registration.discipline == discipline)
        .all()
    )
    for reg, athlete in rows:
        if str(reg.id) in seen:
            continue
        if athlete.gender != gender:
            continue
        if draw_category_key(reg.discipline, reg.category_name) != category_name:
            continue
        reg.seed = None
        reg.subgroup = None


def _apply_category_draw(db, tournament_id, discipline, gender, category_name, participants):
    draw_list = participants
    kata_group = discipline == "kata" and is_kata_group_category(category_name)
    if kata_group:
        draw_list = collapse_kata_group_for_draw(participants)
        if not draw_list:
            for p in participants:
                if "_reg" in p:
                    del p["_reg"]
            return {
                "discipline": discipline,
                "gender": gender,
                "category_name": category_name,
                "participant_count": 0,
                "system": "kata_order",
                "participants": [],
                "message": "Нет полных команд (по 3 человека одного региона)",
            }

    result = build_category_draw(discipline, draw_list)
    flat = result.get("participants") or [p for sub in result.get("subgroups") or [] for p in sub["participants"]]
    if kata_group:
        apply_team_seeds(flat)
        for p in flat:
            p.pop("_regs", None)
            p.pop("_reg", None)
        for p in participants:
            p.pop("_reg", None)
    else:
        for p in flat:
            p["_reg"].seed = p["seed"]
            p["_reg"].subgroup = p.get("subgroup")
            del p["_reg"]
    return {
        "discipline": discipline,
        "gender": gender,
        "category_name": category_name,
        "participant_count": len(draw_list),
        **result,
    }


def _build_tournament_groups(db, tournament_id):
    rank_order = {r.name: r.sort_order for r in db.query(Rank).all()}
    rows = (
        db.query(Registration, Athlete)
        .join(Athlete, Registration.athlete_id == Athlete.id)
        .filter(Registration.tournament_id == tournament_id)
        .order_by(Registration.created_at, Registration.id)
        .all()
    )
    club_names = {athlete.club_name for _, athlete in rows if athlete.club_name}
    region_lookup = _region_by_club_name(db, club_names)
    groups = {}
    for reg, athlete in rows:
        key = (reg.discipline, athlete.gender, draw_category_key(reg.discipline, reg.category_name))
        groups.setdefault(key, []).append({
            "registration_id": str(reg.id),
            "full_name": f"{athlete.last_name} {athlete.first_name} {athlete.middle_name or ''}".strip(),
            "club_name": athlete.club_name,
            "region": region_lookup.get(athlete.club_name) if athlete.club_name else None,
            "team_number": reg.team_number,
            "rank_sort_order": rank_order.get(athlete.rank),
            "_reg": reg
        })
    return groups


def _repair_stale_draws(db, tournament_id):
    """Fix categories that still have duplicate № жребья (old per-subgroup draw). Returns count repaired."""
    groups = _build_tournament_groups(db, tournament_id)
    repaired = 0
    for (discipline, gender, category_name), all_participants in groups.items():
        participants = [p for p in all_participants if registration_eligible_for_draw(p["_reg"])]
        if not participants or not _draw_needs_repair(participants, discipline):
            for p in all_participants:
                if "_reg" in p:
                    del p["_reg"]
            continue
        if _category_has_completed_bouts(db, tournament_id, discipline, gender, category_name):
            if _renumber_category_seeds(participants):
                repaired += 1
            for p in all_participants:
                if "_reg" in p:
                    del p["_reg"]
            continue
        _clear_category_draw(db, tournament_id, discipline, gender, category_name, all_participants)
        _apply_category_draw(db, tournament_id, discipline, gender, category_name, participants)
        repaired += 1
        for p in all_participants:
            if "_reg" in p:
                del p["_reg"]
    if repaired:
        db.commit()
    return repaired


@app.post("/api/v1/tournaments/{tournament_id}/draw/repair")
def repair_draw(tournament_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Re-draw categories that still use the old per-subgroup numbering (1,2,3 in each half)."""
    require_roles(current_user, {"admin", "owner"})
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        return {"success": False, "message": "Турнир не найден"}

    groups = _build_tournament_groups(db, tournament_id)
    repaired, skipped = [], []
    for (discipline, gender, category_name), all_participants in groups.items():
        participants = [p for p in all_participants if registration_eligible_for_draw(p["_reg"])]
        if not participants or not _draw_needs_repair(participants, discipline):
            for p in all_participants:
                if "_reg" in p:
                    del p["_reg"]
            continue
        if _category_has_completed_bouts(db, tournament_id, discipline, gender, category_name):
            if _renumber_category_seeds(participants):
                repaired.append({
                    "discipline": discipline, "gender": gender, "category_name": category_name,
                    "renumbered": True,
                    "message": "Номера жребья исправлены (1…N), бои не тронуты",
                })
            else:
                skipped.append({
                    "discipline": discipline, "gender": gender, "category_name": category_name,
                    "message": "Есть завершённые бои — пережеребить нельзя",
                })
            for p in all_participants:
                if "_reg" in p:
                    del p["_reg"]
            continue
        _clear_category_draw(db, tournament_id, discipline, gender, category_name, all_participants)
        repaired.append(_apply_category_draw(db, tournament_id, discipline, gender, category_name, participants))
        for p in all_participants:
            if "_reg" in p:
                del p["_reg"]

    if repaired or skipped:
        db.commit()
    return {"success": True, "repaired": repaired, "skipped": skipped}


@app.post("/api/v1/tournaments/{tournament_id}/draw")
def draw_tournament(tournament_id: str, body: DrawRequest = DrawRequest(), current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, {"admin", "owner"})
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        return {"success": False, "message": "Турнир не найден"}

    assign_kata_group_teams(db, tournament_id, _region_by_club_name(db))
    db.flush()

    groups = _build_tournament_groups(db, tournament_id)

    if not groups:
        return {"success": False, "message": "В турнире нет заявленных участников"}

    categories = []
    any_changed = False
    for (discipline, gender, category_name), all_participants in groups.items():
        eligible = [p for p in all_participants if registration_eligible_for_draw(p["_reg"])]
        ineligible = [p for p in all_participants if not registration_eligible_for_draw(p["_reg"])]
        excluded_count = len(ineligible)

        def _drop_regs(plist):
            for p in plist:
                if "_reg" in p:
                    del p["_reg"]

        if not eligible:
            if any(p["_reg"].seed is not None for p in all_participants) and not _category_has_completed_bouts(
                db, tournament_id, discipline, gender, category_name
            ):
                _clear_category_draw(db, tournament_id, discipline, gender, category_name, all_participants)
                any_changed = True
            _drop_regs(all_participants)
            categories.append({
                "discipline": discipline,
                "gender": gender,
                "category_name": category_name,
                "participant_count": 0,
                "excluded_count": excluded_count,
                "skipped": True,
                "message": "Нет допущенных участников",
            })
            continue

        participants = eligible
        already_seeded = all(p["_reg"].seed is not None for p in participants)
        ineligible_have_seeds = any(p["_reg"].seed is not None for p in ineligible)
        needs_refresh = (
            (not already_seeded)
            or ineligible_have_seeds
            or _draw_needs_repair(participants, discipline)
        )

        if already_seeded and not body.force and not needs_refresh:
            _drop_regs(all_participants)
            categories.append({
                "discipline": discipline,
                "gender": gender,
                "category_name": category_name,
                "participant_count": len(participants),
                "excluded_count": excluded_count,
                "already_drawn": True
            })
            continue

        if (already_seeded or ineligible_have_seeds) and (body.force or needs_refresh):
            if _category_has_completed_bouts(db, tournament_id, discipline, gender, category_name):
                if not body.force and _draw_needs_repair(participants, discipline) and _renumber_category_seeds(participants):
                    categories.append({
                        "discipline": discipline,
                        "gender": gender,
                        "category_name": category_name,
                        "participant_count": len(participants),
                        "excluded_count": excluded_count,
                        "renumbered": True,
                        "message": "Номера жребья исправлены (1…N), бои не тронуты",
                    })
                    _drop_regs(all_participants)
                    continue
                _drop_regs(all_participants)
                categories.append({
                    "discipline": discipline,
                    "gender": gender,
                    "category_name": category_name,
                    "participant_count": len(participants),
                    "excluded_count": excluded_count,
                    "skipped": True,
                    "message": "Есть завершённые бои — пережеребить нельзя",
                })
                continue
            _clear_category_draw(db, tournament_id, discipline, gender, category_name, all_participants)

        drawn = _apply_category_draw(db, tournament_id, discipline, gender, category_name, participants)
        drawn["excluded_count"] = excluded_count
        categories.append(drawn)
        _drop_regs(ineligible)
        any_changed = True

    if any_changed:
        tournament.draw_published = False

    categories.sort(key=category_sort_key)
    db.commit()
    return {
        "success": True,
        "tournament_id": tournament_id,
        "categories": categories,
        "draw_published": bool(tournament.draw_published),
    }


@app.post("/api/v1/tournaments/{tournament_id}/draw/publish")
def publish_draw(tournament_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, {"admin", "owner"})
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        return {"success": False, "message": "Турнир не найден"}
    has_seed = (
        db.query(Registration)
        .filter(Registration.tournament_id == tournament_id, Registration.seed.isnot(None))
        .first()
        is not None
    )
    if not has_seed:
        return {"success": False, "message": "Сначала проведите жеребьёвку"}
    tournament.draw_published = True
    db.commit()
    return {"success": True, "draw_published": True, "message": "Жеребьёвка опубликована на странице турнира"}


@app.post("/api/v1/tournaments/{tournament_id}/draw/unpublish")
def unpublish_draw(tournament_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, {"admin", "owner"})
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        return {"success": False, "message": "Турнир не найден"}
    tournament.draw_published = False
    db.commit()
    return {"success": True, "draw_published": False, "message": "Жеребьёвка снята с публикации"}


@app.post("/api/v1/tournaments/{tournament_id}/draw/swap-seed")
def swap_draw_seed(tournament_id: str, data: SeedSwapRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    # ТЗ 5.3.4: only admin/owner may renumber the draw — secretaries and clubs cannot.
    require_roles(current_user, {"admin", "owner"})

    if data.registration_id_a == data.registration_id_b:
        return {"success": False, "message": "Нельзя поменять участника местами с самим собой"}
    reg_a = db.query(Registration).filter(Registration.id == data.registration_id_a).first()
    reg_b = db.query(Registration).filter(Registration.id == data.registration_id_b).first()
    if not reg_a or not reg_b:
        return {"success": False, "message": "Участник не найден"}
    if str(reg_a.tournament_id) != tournament_id or str(reg_b.tournament_id) != tournament_id:
        return {"success": False, "message": "Участник не заявлен на этот турнир"}
    if reg_a.seed is None or reg_b.seed is None:
        return {"success": False, "message": "Жеребьёвка ещё не проведена для этой категории"}

    athlete_a = db.query(Athlete).filter(Athlete.id == reg_a.athlete_id).first()
    athlete_b = db.query(Athlete).filter(Athlete.id == reg_b.athlete_id).first()
    same_category = (
        reg_a.discipline == reg_b.discipline
        and draw_category_key(reg_a.discipline, reg_a.category_name) == draw_category_key(reg_b.discipline, reg_b.category_name)
        and (athlete_a.gender if athlete_a else None) == (athlete_b.gender if athlete_b else None)
    )
    if not same_category:
        return {"success": False, "message": "Участники из разных категорий"}
    reg_a.seed, reg_b.seed = reg_b.seed, reg_a.seed

    category_regs = db.query(Registration).join(Athlete, Registration.athlete_id == Athlete.id).filter(
        Registration.tournament_id == tournament_id,
        Registration.discipline == reg_a.discipline,
        Registration.category_name == reg_a.category_name,
        Athlete.gender == (athlete_a.gender if athlete_a else None),
    ).all()
    n_in_category = len(category_regs)
    for reg in category_regs:
        reg.subgroup = subgroup_for_draw_number(reg.seed, n_in_category)

    db.commit()
    return {
        "success": True,
        "registration_id_a": str(reg_a.id), "seed_a": reg_a.seed,
        "registration_id_b": str(reg_b.id), "seed_b": reg_b.seed
    }

# ─── ATHLETES ─────────────────────────────────────────────────────────────────

def find_duplicate_athlete(db, tournament_id, last_name, first_name, middle_name, birth_date):
    """ТЗ 4.4: один и тот же участник определяется по точному совпадению
    ФИО и даты рождения (отличие хоть на один символ - уже новый участник).
    Не указана область поиска, поэтому здесь - в рамках одного турнира: клуб
    "подаёт повторную карточку на того же участника" именно на этом
    соревновании, а не глобально по всей истории платформы (это ближе к
    §5.6 "База спортсменов", которая отдельно вынесена в версию 2)."""
    return db.query(Athlete).join(Registration, Registration.athlete_id == Athlete.id).filter(
        Registration.tournament_id == tournament_id,
        Athlete.last_name == last_name,
        Athlete.first_name == first_name,
        (Athlete.middle_name == middle_name) if middle_name else (Athlete.middle_name.is_(None) | (Athlete.middle_name == "")),
        Athlete.birth_date == birth_date
    ).first()


@app.get("/api/v1/tournaments/{tournament_id}/athletes/lookup")
def lookup_athlete(tournament_id: str, last_name: str, first_name: str, birth_date: date, middle_name: Optional[str] = None, db: Session = Depends(get_db)):
    athlete = find_duplicate_athlete(db, tournament_id, last_name, first_name, middle_name, birth_date)
    if not athlete:
        return {"found": False}
    regs = db.query(Registration).filter(Registration.tournament_id == tournament_id, Registration.athlete_id == athlete.id).all()
    return {
        "found": True,
        "athlete_id": str(athlete.id),
        "full_name": f"{athlete.last_name} {athlete.first_name} {athlete.middle_name or ''}".strip(),
        "existing_registrations": [{"discipline": r.discipline, "category_name": r.category_name} for r in regs]
    }


@app.post("/api/v1/athletes/")
def create_athlete(data: AthleteCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, {"admin", "owner", "club"})
    club_name = data.club_name
    own_club = None
    if current_user["role"] == "club":
        # Не доверяем club_name из тела запроса для роли "клуб" - иначе клуб
        # может подать заявку от имени другого клуба. Берём имя из
        # собственной записи клуба по токену.
        own_club = db.query(Club).filter(Club.id == current_user["user_id"]).first()
        club_name = (own_club.short_name or own_club.full_name) if own_club else club_name

    existing = find_duplicate_athlete(db, data.tournament_id, data.last_name, data.first_name, data.middle_name, data.birth_date)

    if existing:
        already = db.query(Registration).filter(
            Registration.tournament_id == data.tournament_id,
            Registration.athlete_id == existing.id,
            Registration.discipline == data.discipline,
            Registration.category_name == data.category_name
        ).first()
        if already:
            return {"success": False, "message": "Участник уже заявлен в эту категорию"}
        athlete = existing
    else:
        athlete = Athlete(
            last_name=data.last_name,
            first_name=data.first_name,
            middle_name=data.middle_name,
            gender=data.gender,
            birth_date=data.birth_date,
            age_years=data.age_years,
            weight=data.weight,
            rank=data.rank,
            club_name=club_name,
            trainer_name=data.trainer_name
        )
        db.add(athlete)
        db.commit()
        db.refresh(athlete)

    registration = Registration(
        athlete_id=athlete.id,
        tournament_id=data.tournament_id,
        discipline=data.discipline,
        category_name=data.category_name,
        team_number=data.team_number,
        admission_status=data.admission_status
    )
    db.add(registration)
    db.commit()

    if own_club:
        full_name = f"{athlete.last_name} {athlete.first_name} {athlete.middle_name or ''}".strip()
        send_email(own_club.email, "Участник зарегистрирован — СпортДок",
                   f"Участник {full_name} ({data.discipline}, категория «{data.category_name}») успешно зарегистрирован на соревнование.")

    return {"success": True, "athlete_id": str(athlete.id)}


async def _read_import_xlsx(file: UploadFile) -> tuple[Optional[bytes], Optional[str]]:
    filename = (file.filename or "").lower()
    if not filename.endswith(".xlsx"):
        return None, "Нужен файл Excel (.xlsx)"
    data = await file.read()
    if not data:
        return None, "Пустой файл"
    if len(data) > MAX_IMPORT_BYTES:
        return None, "Файл больше 20 МБ"
    return data, None


def _club_name_for_user(current_user, db: Session) -> Optional[str]:
    if current_user["role"] != "club":
        return None
    own_club = db.query(Club).filter(Club.id == current_user["user_id"]).first()
    if not own_club:
        return None
    return own_club.short_name or own_club.full_name


@app.get("/api/v1/templates/application")
def download_application_template():
    """Пустой шаблон без данных турнира (обратная совместимость)."""
    if not APPLICATION_TEMPLATE_PATH.is_file():
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    return FileResponse(
        path=str(APPLICATION_TEMPLATE_PATH),
        filename=APPLICATION_TEMPLATE_NAME,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@app.get("/api/v1/tournaments/{tournament_id}/templates/application")
def download_tournament_application_template(
    tournament_id: str,
    current_user=Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Шаблон заявки с названием турнира, местом и датой комиссии по допуску.

    Авторизация не обязательна (карточка турнира публичная). Если передан
    токен клуба — в жёлтую ячейку подставим название команды.
    """
    if not APPLICATION_TEMPLATE_PATH.is_file():
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Турнир не найден")

    team_name = None
    if current_user and current_user.get("role") == "club":
        team_name = _club_name_for_user(current_user, db)

    admission = tournament.registration_closes_at or tournament.event_date
    try:
        payload = fill_application_template(
            APPLICATION_TEMPLATE_PATH,
            tournament_name=tournament.name or "",
            location=tournament.location,
            admission_date=admission,
            team_name=team_name,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Не удалось сформировать шаблон: {exc}") from exc

    # Только ASCII в filename= — иначе nginx/uvicorn могут отдать 500 на кириллице в заголовке
    ascii_name = "".join(ch if (ch.isascii() and (ch.isalnum() or ch in " _-")) else "_" for ch in (tournament.name or "turnir"))[:40]
    ascii_name = ascii_name.strip("_ ") or "turnir"
    filename = f"Zayavka_{ascii_name}.xlsx"
    starred = quote(f"Заявка_{(tournament.name or 'турнир').strip()[:40]}.xlsx")
    return StreamingResponse(
        BytesIO(payload),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=\"{filename}\"; filename*=UTF-8''{starred}"
        },
    )



@app.post("/api/v1/tournaments/{tournament_id}/import/preview")
async def preview_tournament_import(
    tournament_id: str,
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_roles(current_user, {"admin", "owner", "club"})
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        return {"success": False, "message": "Турнир не найден"}

    data, err = await _read_import_xlsx(file)
    if err:
        return {"success": False, "message": err}

    club_override = _club_name_for_user(current_user, db)
    result = parse_application_xlsx(data, club_name_override=club_override)
    preview = preview_dict(result)
    if result.file_errors:
        preview["success"] = False
        preview["message"] = result.file_errors[0]
    return preview


@app.post("/api/v1/tournaments/{tournament_id}/import")
async def import_tournament_application(
    tournament_id: str,
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_roles(current_user, {"admin", "owner", "club"})
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        return {"success": False, "message": "Турнир не найден"}

    data, err = await _read_import_xlsx(file)
    if err:
        return {"success": False, "message": err}

    club_override = _club_name_for_user(current_user, db)
    result = parse_application_xlsx(data, club_name_override=club_override)
    if result.file_errors:
        return {"success": False, "message": result.file_errors[0], **{k: v for k, v in preview_dict(result).items() if k != "success"}}

    created_athletes = 0
    created_registrations = 0
    skipped_registrations = 0
    row_errors = []

    for person in result.athletes:
        if person.errors:
            row_errors.append({
                "row": person.row,
                "name": f"{person.last_name} {person.first_name}".strip(),
                "messages": person.errors,
            })
            continue
        if not person.birth_date:
            row_errors.append({
                "row": person.row,
                "name": f"{person.last_name} {person.first_name}".strip(),
                "messages": ["нет даты рождения"],
            })
            continue

        club_name = club_override or person.club_name
        existing = find_duplicate_athlete(
            db, tournament_id, person.last_name, person.first_name, person.middle_name, person.birth_date
        )
        if existing:
            athlete = existing
        else:
            athlete = Athlete(
                last_name=person.last_name,
                first_name=person.first_name,
                middle_name=person.middle_name,
                gender=person.gender,
                birth_date=person.birth_date,
                age_years=person.age_years,
                weight=person.weight,
                rank=person.rank,
                club_name=club_name,
                trainer_name=person.trainer_name,
            )
            db.add(athlete)
            db.flush()
            created_athletes += 1

        for reg in person.registrations:
            already = db.query(Registration).filter(
                Registration.tournament_id == tournament_id,
                Registration.athlete_id == athlete.id,
                Registration.discipline == reg.discipline,
                Registration.category_name == reg.category_name,
            ).first()
            if already:
                skipped_registrations += 1
                continue
            db.add(Registration(
                athlete_id=athlete.id,
                tournament_id=tournament_id,
                discipline=reg.discipline,
                category_name=reg.category_name,
                team_number=reg.team_number,
            ))
            created_registrations += 1

    db.flush()
    club_names = {
        a.club_name
        for a in db.query(Athlete).join(Registration, Registration.athlete_id == Athlete.id)
        .filter(Registration.tournament_id == tournament_id).all()
        if a.club_name
    }
    team_stats = assign_kata_group_teams(db, tournament_id, _region_by_club_name(db, club_names))
    db.commit()

    msg = (
        f"Добавлено участников: {created_athletes}, заявок: {created_registrations}"
        + (f", пропущено дублей: {skipped_registrations}" if skipped_registrations else "")
        + (f", строк с ошибками: {len(row_errors)}" if row_errors else "")
    )
    if team_stats.get("teams"):
        msg += f"; команд ката-группы: {team_stats['teams']}"

    return {
        "success": True,
        "club_name": club_override or result.club_name,
        "created_athletes": created_athletes,
        "created_registrations": created_registrations,
        "skipped_registrations": skipped_registrations,
        "error_rows": len(row_errors),
        "errors": row_errors[:50],
        "kata_group_teams": team_stats,
        "message": msg,
    }


@app.post("/api/v1/tournaments/{tournament_id}/kata-group/assign-teams")
def assign_kata_group_teams_endpoint(
    tournament_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Собрать команды ката-группы: по 3 человека одного региона."""
    require_roles(current_user, {"admin", "owner", "secretary"})
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        return {"success": False, "message": "Турнир не найден"}
    stats = assign_kata_group_teams(db, tournament_id, _region_by_club_name(db))
    db.commit()
    return {
        "success": True,
        **stats,
        "message": (
            f"Собрано команд: {stats['teams']} "
            f"(участников в ката-группе: {stats['people']}, обновлено записей: {stats['updated']})"
        ),
    }


def _region_by_club_name(db, club_names=None):
    region_by_club_name = {}
    q = db.query(Club)
    if club_names is not None:
        names = [n for n in club_names if n]
        if not names:
            return {}
        q = q.filter(or_(Club.short_name.in_(names), Club.full_name.in_(names)))
    for club in q.all():
        if club.short_name:
            region_by_club_name[club.short_name] = club.region
        if club.full_name:
            region_by_club_name.setdefault(club.full_name, club.region)
    return region_by_club_name


def _registration_athlete_rows(db, tournament_id, discipline=None, gender=None):
    q = (
        db.query(Registration, Athlete)
        .join(Athlete, Registration.athlete_id == Athlete.id)
        .filter(Registration.tournament_id == tournament_id)
    )
    if discipline:
        q = q.filter(Registration.discipline == discipline)
    if gender:
        q = q.filter(Athlete.gender == gender)
    return q.all()


def _athlete_list_item(reg, athlete, event_date, region_lookup):
    return {
        "id": str(athlete.id),
        "registration_id": str(reg.id),
        "full_name": f"{athlete.last_name} {athlete.first_name} {athlete.middle_name or ''}".strip(),
        "gender": athlete.gender,
        "weight": float(athlete.weight) if athlete.weight else None,
        "rank": athlete.rank,
        "club_name": athlete.club_name,
        "region": region_lookup.get(athlete.club_name),
        "discipline": reg.discipline,
        "category_name": reg.category_name,
        "kata_name": reg.kata_name,
        "team_number": reg.team_number,
        "admission_status": reg.admission_status,
        "weigh_status": getattr(reg, "weigh_status", None),
        "weigh_required": weigh_admit_required(reg.discipline, reg.category_name),
        "age_group": compute_age_group(athlete.birth_date, event_date, athlete.gender, reg.discipline),
        "seed": reg.seed,
        "subgroup": reg.subgroup,
    }


@app.get("/api/v1/tournaments/{tournament_id}/athletes/categories")
def list_athlete_categories(tournament_id: str, db: Session = Depends(get_db)):
    """Лёгкая сводка для быстрой отрисовки заголовков категорий."""
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        return {"total": 0, "categories": [], "clubs": []}
    rows = _registration_athlete_rows(db, tournament_id)
    event_date = tournament.event_date
    groups = {}
    clubs = set()
    for reg, athlete in rows:
        if athlete.club_name:
            clubs.add(athlete.club_name.strip())
        cat = draw_category_key(reg.discipline, reg.category_name)
        age = compute_age_group(athlete.birth_date, event_date, athlete.gender, reg.discipline)
        key = (reg.discipline, athlete.gender, cat, age or "")
        if key not in groups:
            groups[key] = {
                "discipline": reg.discipline,
                "gender": athlete.gender,
                "category_name": cat,
                "age_group": age,
                "count": 0,
            }
        groups[key]["count"] += 1
    categories = sorted(
        groups.values(),
        key=lambda g: (
            g.get("discipline") or "",
            g.get("gender") or "",
            str(g.get("category_name") or ""),
            g.get("age_group") or "",
        ),
    )
    return {
        "total": len(rows),
        "categories": categories,
        "clubs": sorted(c for c in clubs if c),
        "draw_published": bool(getattr(tournament, "draw_published", False)),
    }


@app.get("/api/v1/tournaments/{tournament_id}/athletes")
def list_athletes(
    tournament_id: str,
    discipline: Optional[str] = None,
    gender: Optional[str] = None,
    category_name: Optional[str] = None,
    age_group: Optional[str] = None,
    q: Optional[str] = None,
    club: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_optional_user),
):
    # Repair жеребьёвки не делаем здесь — только POST .../draw/repair.
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    rows = _registration_athlete_rows(db, tournament_id, discipline=discipline, gender=gender)
    club_names = {athlete.club_name for _, athlete in rows if athlete.club_name}
    region_lookup = _region_by_club_name(db, club_names)
    event_date = tournament.event_date if tournament else None
    q_norm = (q or "").strip().lower()
    club_norm = (club or "").strip().lower()
    age_filter = (age_group or "").strip()
    cat_filter = (category_name or "").strip()
    draw_published = bool(getattr(tournament, "draw_published", False)) if tournament else False
    role = (current_user or {}).get("role")
    show_draw = draw_published or role in {"admin", "owner", "secretary"}

    result = []
    for reg, athlete in rows:
        draw_cat = draw_category_key(reg.discipline, reg.category_name)
        if cat_filter and draw_cat != cat_filter and (reg.category_name or "") != cat_filter:
            continue
        item = _athlete_list_item(reg, athlete, event_date, region_lookup)
        if age_filter and (item.get("age_group") or "") != age_filter:
            continue
        if club_norm:
            club_name = (athlete.club_name or "").lower()
            region = (item.get("region") or "").lower()
            if club_norm not in club_name and club_norm not in region:
                continue
        if q_norm:
            full = (item.get("full_name") or "").lower()
            if q_norm not in full:
                continue
        if cat_filter:
            item = {**item, "category_name": draw_cat}
        if not show_draw:
            item = {**item, "seed": None, "subgroup": None}
        result.append(item)
    return result

@app.post("/api/v1/registrations/{registration_id}/admit")
def admit_registration(registration_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, {"admin", "owner"})
    reg = db.query(Registration).filter(Registration.id == registration_id).first()
    if not reg:
        return {"success": False, "message": "Заявка не найдена"}
    reg.admission_status = "approved"
    db.commit()
    return {"success": True, "admission_status": reg.admission_status}

@app.post("/api/v1/registrations/{registration_id}/reject-admission")
def reject_admission(registration_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, {"admin", "owner"})
    reg = db.query(Registration).filter(Registration.id == registration_id).first()
    if not reg:
        return {"success": False, "message": "Заявка не найдена"}
    reg.admission_status = "rejected"
    db.commit()
    return {"success": True, "admission_status": reg.admission_status}

@app.post("/api/v1/registrations/{registration_id}/reset-admission")
def reset_admission(registration_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, {"admin", "owner"})
    reg = db.query(Registration).filter(Registration.id == registration_id).first()
    if not reg:
        return {"success": False, "message": "Заявка не найдена"}
    reg.admission_status = None
    db.commit()
    return {"success": True, "admission_status": None}

@app.post("/api/v1/registrations/{registration_id}/admit-weigh")
def admit_weigh(registration_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, {"admin", "owner"})
    reg = db.query(Registration).filter(Registration.id == registration_id).first()
    if not reg:
        return {"success": False, "message": "Заявка не найдена"}
    if not weigh_admit_required(reg.discipline, reg.category_name):
        return {"success": False, "message": "Весовой допуск для этой категории не требуется"}
    reg.weigh_status = "approved"
    db.commit()
    return {"success": True, "weigh_status": reg.weigh_status}

@app.post("/api/v1/registrations/{registration_id}/reset-weigh")
def reset_weigh(registration_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, {"admin", "owner"})
    reg = db.query(Registration).filter(Registration.id == registration_id).first()
    if not reg:
        return {"success": False, "message": "Заявка не найдена"}
    reg.weigh_status = None
    db.commit()
    return {"success": True, "weigh_status": None}

@app.get("/api/v1/athletes/{athlete_id}")
def get_athlete(athlete_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    # Нужен для формы редактирования - список участников турнира отдаёт
    # только склеенное full_name, а для PATCH нужны фамилия/имя/отчество
    # по отдельности.
    require_roles(current_user, {"admin", "owner"})
    athlete = db.query(Athlete).filter(Athlete.id == athlete_id).first()
    if not athlete:
        return {"success": False, "message": "Участник не найден"}
    return {
        "success": True,
        "id": str(athlete.id),
        "last_name": athlete.last_name,
        "first_name": athlete.first_name,
        "middle_name": athlete.middle_name,
        "gender": athlete.gender,
        "birth_date": str(athlete.birth_date),
        "age_years": athlete.age_years,
        "weight": float(athlete.weight) if athlete.weight else None,
        "rank": athlete.rank,
        "club_name": athlete.club_name,
        "trainer_name": athlete.trainer_name
    }

@app.patch("/api/v1/athletes/{athlete_id}")
def update_athlete(athlete_id: str, data: AthleteUpdate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, {"admin", "owner"})
    athlete = db.query(Athlete).filter(Athlete.id == athlete_id).first()
    if not athlete:
        return {"success": False, "message": "Участник не найден"}
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(athlete, field, value)
    db.commit()
    db.refresh(athlete)
    return {
        "success": True,
        "id": str(athlete.id),
        "last_name": athlete.last_name,
        "first_name": athlete.first_name,
        "middle_name": athlete.middle_name,
        "gender": athlete.gender,
        "birth_date": str(athlete.birth_date),
        "age_years": athlete.age_years,
        "weight": float(athlete.weight) if athlete.weight else None,
        "rank": athlete.rank,
        "club_name": athlete.club_name,
        "trainer_name": athlete.trainer_name
    }

@app.delete("/api/v1/athletes/{athlete_id}")
def delete_athlete(athlete_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, {"admin", "owner"})
    athlete = db.query(Athlete).filter(Athlete.id == athlete_id).first()
    if not athlete:
        return {"success": False, "message": "Участник не найден"}
    full_name = f"{athlete.last_name} {athlete.first_name}"
    db.query(Registration).filter(Registration.athlete_id == athlete_id).delete()
    db.delete(athlete)
    db.commit()
    return {"success": True, "message": f"Участник {full_name} удалён"}

# ─── ПРОТОКОЛ КУМИТЭ ──────────────────────────────────────────────────────────

def secretary_has_access(db, user, tournament_id, discipline, gender, category_name):
    """Admins/owners always pass. Secretaries need a matching grant for this
    exact (tournament, discipline, gender, category) 'стол'."""
    if user["role"] != "secretary":
        return True
    grant = db.query(SecretaryAccess).filter(
        SecretaryAccess.tournament_id == tournament_id,
        SecretaryAccess.secretary_user_id == user["user_id"],
        SecretaryAccess.discipline == discipline,
        SecretaryAccess.gender == gender,
        SecretaryAccess.category_name == category_name
    ).first()
    return grant is not None

@app.post("/api/v1/bouts/")
def create_bout(data: BoutCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, {"admin", "owner", "secretary"})
    if data.registration_id_a == data.registration_id_b:
        return {"success": False, "message": "Участник не может биться сам с собой"}
    reg_a = db.query(Registration).filter(Registration.id == data.registration_id_a).first()
    reg_b = db.query(Registration).filter(Registration.id == data.registration_id_b).first()
    if not reg_a or not reg_b:
        return {"success": False, "message": "Участник не найден"}
    if str(reg_a.tournament_id) != data.tournament_id or str(reg_b.tournament_id) != data.tournament_id:
        return {"success": False, "message": "Участник не заявлен на этот турнир"}
    if reg_a.discipline == "kata" or reg_b.discipline == "kata":
        return {"success": False, "message": "Протокол кумитэ недоступен для ката"}
    if reg_a.discipline != reg_b.discipline or reg_a.category_name != reg_b.category_name:
        return {"success": False, "message": "Участники из разных категорий"}

    athlete_a = db.query(Athlete).filter(Athlete.id == reg_a.athlete_id).first()
    gender = athlete_a.gender if athlete_a else None
    if not secretary_has_access(db, current_user, data.tournament_id, reg_a.discipline, gender, reg_a.category_name):
        raise HTTPException(status_code=403, detail="Нет доступа к этой сетке")

    bout = Bout(
        tournament_id=data.tournament_id,
        discipline=reg_a.discipline,
        category_name=reg_a.category_name,
        gender=gender,
        round_label=data.round_label or "round1",
        registration_id_a=data.registration_id_a,
        registration_id_b=data.registration_id_b
    )
    db.add(bout)
    db.commit()
    db.refresh(bout)
    return {"success": True, "id": str(bout.id)}

@app.post("/api/v1/bouts/{bout_id}/result")
def submit_bout_result(bout_id: str, data: BoutResult, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, {"admin", "owner", "secretary"})
    bout = db.query(Bout).filter(Bout.id == bout_id).first()
    if not bout:
        return {"success": False, "message": "Поединок не найден"}
    if not secretary_has_access(db, current_user, str(bout.tournament_id), bout.discipline, bout.gender, bout.category_name):
        raise HTTPException(status_code=403, detail="Нет доступа к этой сетке")

    bout.waza_ari_a, bout.ippon_a = data.waza_ari_a, data.ippon_a
    bout.line1_level_a, bout.line2_level_a, bout.line3_level_a = data.line1_level_a, data.line2_level_a, data.line3_level_a
    bout.waza_ari_b, bout.ippon_b = data.waza_ari_b, data.ippon_b
    bout.line1_level_b, bout.line2_level_b, bout.line3_level_b = data.line1_level_b, data.line2_level_b, data.line3_level_b

    winner, method = determine_winner(
        bout.discipline, bout.category_name,
        data.waza_ari_a, data.ippon_a, [data.line1_level_a, data.line2_level_a, data.line3_level_a],
        data.waza_ari_b, data.ippon_b, [data.line1_level_b, data.line2_level_b, data.line3_level_b]
    )
    bout.winner_registration_id = (bout.registration_id_a if winner == "a" else bout.registration_id_b) if winner else None
    bout.win_method = method
    bout.status = "completed" if winner else "undecided"
    bout.finished_at = datetime.utcnow()
    db.commit()

    return {
        "success": True,
        "winner_registration_id": str(bout.winner_registration_id) if bout.winner_registration_id else None,
        "win_method": method,
        "status": bout.status
    }

@app.get("/api/v1/tournaments/{tournament_id}/bouts")
def list_bouts(tournament_id: str, db: Session = Depends(get_db)):
    bouts = db.query(Bout).filter(Bout.tournament_id == tournament_id).order_by(Bout.created_at).all()

    def athlete_name(registration_id):
        reg = db.query(Registration).filter(Registration.id == registration_id).first()
        if not reg:
            return None
        athlete = db.query(Athlete).filter(Athlete.id == reg.athlete_id).first()
        return f"{athlete.last_name} {athlete.first_name}".strip() if athlete else None

    return [
        {
            "id": str(b.id),
            "discipline": b.discipline,
            "category_name": b.category_name,
            "round_label": b.round_label,
            "registration_id_a": str(b.registration_id_a),
            "athlete_a": athlete_name(b.registration_id_a),
            "waza_ari_a": b.waza_ari_a,
            "ippon_a": b.ippon_a,
            "lines_a": [b.line1_level_a, b.line2_level_a, b.line3_level_a],
            "registration_id_b": str(b.registration_id_b),
            "athlete_b": athlete_name(b.registration_id_b),
            "waza_ari_b": b.waza_ari_b,
            "ippon_b": b.ippon_b,
            "lines_b": [b.line1_level_b, b.line2_level_b, b.line3_level_b],
            "winner_registration_id": str(b.winner_registration_id) if b.winner_registration_id else None,
            "win_method": b.win_method,
            "status": b.status
        }
        for b in bouts
    ]

# ─── ПРОТОКОЛ КАТА ────────────────────────────────────────────────────────────

@app.post("/api/v1/registrations/{registration_id}/kata-name")
def set_kata_name(registration_id: str, data: KataNameSet, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    # Стиль (Registration.category_name) клуб выбирает при заявке; конкретную
    # ката внутри стиля выбирает секретарь здесь, в сетке ката, перед вводом
    # первой оценки - см. обсуждение и решение пользователя 2026-07-03.
    require_roles(current_user, {"admin", "owner", "secretary"})
    reg = db.query(Registration).filter(Registration.id == registration_id).first()
    if not reg:
        return {"success": False, "message": "Участник не найден"}
    if reg.discipline != "kata":
        return {"success": False, "message": "Доступно только для дисциплины «ката»"}
    athlete = db.query(Athlete).filter(Athlete.id == reg.athlete_id).first()
    style = kata_style(reg.category_name)
    if not secretary_has_access(db, current_user, str(reg.tournament_id), "kata", athlete.gender if athlete else None, style):
        raise HTTPException(status_code=403, detail="Нет доступа к этой сетке")
    reg.kata_name = data.kata_name
    db.commit()
    return {"success": True, "kata_name": reg.kata_name}

@app.post("/api/v1/kata-scores/")
def submit_kata_score(data: KataScoreSubmit, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, {"admin", "owner", "secretary"})
    if data.round_label not in ROUND_SCALES:
        return {"success": False, "message": "Некорректный круг"}
    reg = db.query(Registration).filter(Registration.id == data.registration_id).first()
    if not reg:
        return {"success": False, "message": "Участник не найден"}
    if str(reg.tournament_id) != data.tournament_id:
        return {"success": False, "message": "Участник не заявлен на этот турнир"}
    if reg.discipline != "kata":
        return {"success": False, "message": "Протокол ката доступен только для дисциплины «ката»"}
    if not validate_scores(data.round_label, data.scores):
        lo, hi = ROUND_SCALES[data.round_label]
        return {"success": False, "message": f"Нужно ровно 5 оценок в диапазоне {lo}–{hi}"}

    athlete = db.query(Athlete).filter(Athlete.id == reg.athlete_id).first()
    style = kata_style(reg.category_name)
    if not secretary_has_access(db, current_user, data.tournament_id, "kata", athlete.gender if athlete else None, style):
        raise HTTPException(status_code=403, detail="Нет доступа к этой сетке")
    total, low, high = compute_total(data.scores)

    score_row = db.query(KataScore).filter(
        KataScore.registration_id == data.registration_id,
        KataScore.round_label == data.round_label
    ).first()
    is_new = score_row is None
    if is_new:
        score_row = KataScore(
            tournament_id=data.tournament_id,
            registration_id=data.registration_id,
            category_name=style,
            gender=athlete.gender if athlete else None,
            round_label=data.round_label
        )

    score_row.score_1, score_row.score_2, score_row.score_3, score_row.score_4, score_row.score_5 = data.scores
    score_row.total_score = total
    score_row.lowest_counted_score = low
    score_row.highest_counted_score = high
    if data.kata_name is not None:
        score_row.kata_name = data.kata_name

    if is_new:
        db.add(score_row)
    db.commit()
    db.refresh(score_row)
    return {"success": True, "id": str(score_row.id), "total_score": float(total)}

@app.get("/api/v1/tournaments/{tournament_id}/kata-scores")
def list_kata_scores(tournament_id: str, category_name: str, gender: Optional[str] = None, db: Session = Depends(get_db)):
    """Raw per-judge scores across all rounds for a category - kata-standings
    only returns the aggregated total/place for one round at a time, which
    isn't enough to render the official round-by-round score table."""
    query = db.query(KataScore).filter(
        KataScore.tournament_id == tournament_id,
        KataScore.category_name == category_name
    )
    if gender:
        query = query.filter(KataScore.gender == gender)
    return [
        {
            "registration_id": str(s.registration_id),
            "round_label": s.round_label,
            "kata_name": s.kata_name,
            "score_1": float(s.score_1),
            "score_2": float(s.score_2),
            "score_3": float(s.score_3),
            "score_4": float(s.score_4),
            "score_5": float(s.score_5),
            "total_score": float(s.total_score)
        }
        for s in query.all()
    ]

@app.get("/api/v1/tournaments/{tournament_id}/kata-standings")
def kata_standings(tournament_id: str, category_name: str, round_label: str, gender: Optional[str] = None, db: Session = Depends(get_db)):
    if round_label not in ROUND_SCALES:
        return {"success": False, "message": "Некорректный круг"}

    query = db.query(KataScore).filter(
        KataScore.tournament_id == tournament_id,
        KataScore.category_name == category_name,
        KataScore.round_label == round_label
    )
    if gender:
        query = query.filter(KataScore.gender == gender)
    scores = query.all()
    if not scores:
        return {"success": True, "ranked": [], "cutoff": None, "tie_at_cutoff": False}

    entries = [
        {
            "registration_id": str(s.registration_id),
            "scores": [float(s.score_1), float(s.score_2), float(s.score_3), float(s.score_4), float(s.score_5)]
        }
        for s in scores
    ]
    result = determine_round_result(round_label, entries)

    def athlete_name(registration_id):
        reg = db.query(Registration).filter(Registration.id == registration_id).first()
        if not reg:
            return None
        athlete = db.query(Athlete).filter(Athlete.id == reg.athlete_id).first()
        return f"{athlete.last_name} {athlete.first_name}".strip() if athlete else None

    for r in result["ranked"]:
        r["full_name"] = athlete_name(r["registration_id"])

    return {"success": True, **result}

@app.post("/api/v1/tournaments/{tournament_id}/kata-sessions")
def start_kata_session(tournament_id: str, data: KataSessionStart, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, {"admin", "owner", "secretary"})
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        return {"success": False, "message": "Турнир не найден"}
    if not secretary_has_access(db, current_user, tournament_id, "kata", data.gender, data.category_name):
        raise HTTPException(status_code=403, detail="Нет доступа к этой сетке")
    session = KataSession(
        tournament_id=tournament_id,
        category_name=data.category_name,
        gender=data.gender,
        started_at=datetime.utcnow()
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"success": True, "id": str(session.id), "started_at": session.started_at.isoformat()}

@app.post("/api/v1/kata-sessions/{session_id}/finish")
def finish_kata_session(session_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, {"admin", "owner", "secretary"})
    session = db.query(KataSession).filter(KataSession.id == session_id).first()
    if not session:
        return {"success": False, "message": "Сессия не найдена"}
    if not secretary_has_access(db, current_user, str(session.tournament_id), "kata", session.gender, session.category_name):
        raise HTTPException(status_code=403, detail="Нет доступа к этой сетке")
    session.finished_at = datetime.utcnow()
    db.commit()
    return {"success": True, "finished_at": session.finished_at.isoformat()}

@app.get("/api/v1/tournaments/{tournament_id}/kata-sessions")
def list_kata_sessions(tournament_id: str, db: Session = Depends(get_db)):
    sessions = db.query(KataSession).filter(KataSession.tournament_id == tournament_id).order_by(KataSession.created_at).all()
    return [
        {
            "id": str(s.id),
            "category_name": s.category_name,
            "gender": s.gender,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "finished_at": s.finished_at.isoformat() if s.finished_at else None
        }
        for s in sessions
    ]

# ─── СЕКРЕТАРИ ────────────────────────────────────────────────────────────────

@app.post("/api/v1/secretaries/")
def create_secretary(data: SecretaryCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, {"admin", "owner"})
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        return {"success": False, "message": "Пользователь с таким email уже существует"}
    secretary = User(
        email=data.email,
        password_hash=hash_password(data.password),
        role="secretary",
        name=data.name
    )
    db.add(secretary)
    db.commit()
    db.refresh(secretary)
    return {"success": True, "id": str(secretary.id)}

@app.get("/api/v1/secretaries/")
def list_secretaries(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, {"admin", "owner"})
    secretaries = db.query(User).filter(User.role == "secretary").order_by(User.created_at.desc()).all()
    return [{"id": str(s.id), "email": s.email, "name": s.name} for s in secretaries]

@app.post("/api/v1/tournaments/{tournament_id}/secretary-access")
def grant_secretary_access(tournament_id: str, data: SecretaryAccessGrant, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, {"admin", "owner"})
    secretary = db.query(User).filter(User.id == data.secretary_user_id, User.role == "secretary").first()
    if not secretary:
        return {"success": False, "message": "Секретарь не найден"}
    access = SecretaryAccess(
        tournament_id=tournament_id,
        secretary_user_id=data.secretary_user_id,
        discipline=data.discipline,
        gender=data.gender,
        category_name=data.category_name
    )
    db.add(access)
    db.commit()
    db.refresh(access)
    return {"success": True, "id": str(access.id)}

@app.delete("/api/v1/secretary-access/{access_id}")
def revoke_secretary_access(access_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, {"admin", "owner"})
    access = db.query(SecretaryAccess).filter(SecretaryAccess.id == access_id).first()
    if not access:
        return {"success": False, "message": "Доступ не найден"}
    db.delete(access)
    db.commit()
    return {"success": True}

@app.get("/api/v1/tournaments/{tournament_id}/secretary-access")
def list_secretary_access(tournament_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, {"admin", "owner"})
    grants = db.query(SecretaryAccess).filter(SecretaryAccess.tournament_id == tournament_id).all()
    result = []
    for g in grants:
        secretary = db.query(User).filter(User.id == g.secretary_user_id).first()
        result.append({
            "id": str(g.id),
            "secretary_user_id": str(g.secretary_user_id),
            "secretary_name": secretary.name if secretary else None,
            "discipline": g.discipline,
            "gender": g.gender,
            "category_name": g.category_name
        })
    return result

@app.get("/api/v1/secretaries/me/access")
def my_secretary_access(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_roles(current_user, {"secretary"})
    grants = db.query(SecretaryAccess).filter(SecretaryAccess.secretary_user_id == current_user["user_id"]).all()
    return [
        {
            "id": str(g.id),
            "tournament_id": str(g.tournament_id),
            "discipline": g.discipline,
            "gender": g.gender,
            "category_name": g.category_name
        }
        for g in grants
    ]

# ─── ИТОГОВЫЕ ДОКУМЕНТЫ ───────────────────────────────────────────────────────

def _assemble_tournament_documents(tournament_id, db):
    """Shared data assembly for both the Excel and PDF exports. Returns
    None if the tournament doesn't exist, else (tournament_info, summary,
    categories_payload, all_placements)."""
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        return None

    region_by_club_name = _region_by_club_name(db)

    regs = db.query(Registration).filter(Registration.tournament_id == tournament_id).all()
    groups = {}
    for reg in regs:
        athlete = db.query(Athlete).filter(Athlete.id == reg.athlete_id).first()
        if not athlete:
            continue
        key = (reg.discipline, athlete.gender, draw_category_key(reg.discipline, reg.category_name))
        groups.setdefault(key, []).append((reg, athlete))

    def full_name(athlete):
        return f"{athlete.last_name} {athlete.first_name} {athlete.middle_name or ''}".strip()

    def doc_label(reg, athlete):
        level = tournament.competition_level or "municipal"
        use_region = level in (
            "region", "regional", "interregional", "national", "international",
        )
        org = region_by_club_name.get(athlete.club_name) if use_region else athlete.club_name
        if not org:
            org = athlete.club_name or region_by_club_name.get(athlete.club_name)
        suffix = f" ({org})" if org else ""
        prefix = f"{reg.seed} " if reg.seed is not None else ""
        return f"{prefix}{full_name(athlete)}{suffix}"

    all_placements = []
    categories_payload = []

    for (discipline, gender, category_name), members in groups.items():
        reg_by_id = {str(reg.id): (reg, athlete) for reg, athlete in members}
        placements = []
        progress = []
        kata_scores_payload = []
        bouts_payload = []

        participants_payload = [
            {
                "registration_id": str(reg.id),
                "seed": reg.seed,
                "subgroup": reg.subgroup,
                "last_name": athlete.last_name,
                "first_name": athlete.first_name,
                "middle_name": athlete.middle_name,
                "gender": athlete.gender,
                "birth_date": athlete.birth_date.isoformat() if athlete.birth_date else None,
                "age_years": athlete.age_years,
                "rank": athlete.rank,
                "weight": float(athlete.weight) if athlete.weight else None,
                "club_name": athlete.club_name,
                "region": region_by_club_name.get(athlete.club_name),
                "trainer_name": athlete.trainer_name,
                "discipline": reg.discipline,
                "category_name": reg.category_name,
                "age_group": compute_age_group(athlete.birth_date, tournament.event_date, athlete.gender, reg.discipline),
            }
            for reg, athlete in members
        ]

        if discipline == "kata":
            scores = db.query(KataScore).filter(
                KataScore.tournament_id == tournament_id,
                KataScore.category_name == category_name,
                KataScore.gender == gender
            ).order_by(KataScore.round_label, KataScore.total_score.desc()).all()
            kata_scores_payload = [
                {
                    "registration_id": str(s.registration_id),
                    "round_label": s.round_label,
                    "kata_name": s.kata_name,
                    "score_1": float(s.score_1),
                    "score_2": float(s.score_2),
                    "score_3": float(s.score_3),
                    "score_4": float(s.score_4),
                    "score_5": float(s.score_5),
                    "total_score": float(s.total_score),
                }
                for s in scores
            ]
            for s in scores:
                pair = reg_by_id.get(str(s.registration_id))
                name = doc_label(pair[0], pair[1]) if pair else "?"
                progress.append(f"{s.round_label}: {name} — {float(s.total_score)} (мин. зачётная {float(s.lowest_counted_score)}, макс. зачётная {float(s.highest_counted_score)})")

            final_scores = [s for s in scores if s.round_label == "final"]
            if final_scores:
                entries = [
                    {
                        "registration_id": str(s.registration_id),
                        "scores": [float(s.score_1), float(s.score_2), float(s.score_3), float(s.score_4), float(s.score_5)]
                    }
                    for s in final_scores
                ]
                result = determine_round_result("final", entries)
                for r in result["ranked"][:4]:
                    pair = reg_by_id.get(r["registration_id"])
                    if pair:
                        placements.append({
                            "place": r["place"],
                            "full_name": full_name(pair[1]),
                            "club_name": pair[1].club_name,
                            "region": region_by_club_name.get(pair[1].club_name),
                            "registration_id": r["registration_id"]
                        })
        else:
            bouts = db.query(Bout).filter(
                Bout.tournament_id == tournament_id,
                Bout.discipline == discipline,
                Bout.category_name == category_name
            ).order_by(Bout.created_at).all()
            bouts_payload = [
                {
                    "registration_id_a": str(b.registration_id_a),
                    "registration_id_b": str(b.registration_id_b),
                    "winner_registration_id": str(b.winner_registration_id) if b.winner_registration_id else None,
                    "win_method": b.win_method,
                    "status": b.status,
                    "round_label": b.round_label,
                }
                for b in bouts
            ]
            for b in bouts:
                pair_a = reg_by_id.get(str(b.registration_id_a))
                pair_b = reg_by_id.get(str(b.registration_id_b))
                name_a = doc_label(pair_a[0], pair_a[1]) if pair_a else "?"
                name_b = doc_label(pair_b[0], pair_b[1]) if pair_b else "?"
                if b.status == "completed":
                    winner_name = name_a if str(b.winner_registration_id) == str(b.registration_id_a) else name_b
                    progress.append(f"{b.round_label}: {name_a} vs {name_b} — победитель {winner_name} ({b.win_method})")
                else:
                    progress.append(f"{b.round_label}: {name_a} vs {name_b} — результат не введён")

            final_bout = next((b for b in bouts if b.round_label == "final" and b.status == "completed"), None)
            bronze_bout = next((b for b in bouts if b.round_label == "bronze" and b.status == "completed"), None)

            if final_bout:
                winner_id = str(final_bout.winner_registration_id)
                loser_id = str(final_bout.registration_id_b) if winner_id == str(final_bout.registration_id_a) else str(final_bout.registration_id_a)
                for place, reg_id in ((1, winner_id), (2, loser_id)):
                    pair = reg_by_id.get(reg_id)
                    if pair:
                        placements.append({
                            "place": place,
                            "full_name": full_name(pair[1]),
                            "club_name": pair[1].club_name,
                            "region": region_by_club_name.get(pair[1].club_name),
                            "registration_id": reg_id
                        })
            if bronze_bout:
                winner_id = str(bronze_bout.winner_registration_id)
                loser_id = str(bronze_bout.registration_id_b) if winner_id == str(bronze_bout.registration_id_a) else str(bronze_bout.registration_id_a)
                for place, reg_id in ((3, winner_id), (4, loser_id)):
                    pair = reg_by_id.get(reg_id)
                    if pair:
                        placements.append({
                            "place": place,
                            "full_name": full_name(pair[1]),
                            "club_name": pair[1].club_name,
                            "region": region_by_club_name.get(pair[1].club_name),
                            "registration_id": reg_id
                        })

            # Round-robin (exactly 3 participants, no final/bronze bouts): rank by win count.
            if not final_bout and len(members) == 3 and bouts:
                wins = {reg_id: 0 for reg_id in reg_by_id}
                for b in bouts:
                    if b.status == "completed" and b.winner_registration_id:
                        wid = str(b.winner_registration_id)
                        wins[wid] = wins.get(wid, 0) + 1
                ranked_ids = sorted(wins.items(), key=lambda kv: -kv[1])
                place, prev_count = 0, None
                for i, (reg_id, count) in enumerate(ranked_ids):
                    if count != prev_count:
                        place = i + 1
                        prev_count = count
                    pair = reg_by_id.get(reg_id)
                    if pair:
                        placements.append({
                            "place": place,
                            "full_name": full_name(pair[1]),
                            "club_name": pair[1].club_name,
                            "region": region_by_club_name.get(pair[1].club_name),
                            "registration_id": reg_id
                        })

        placements.sort(key=lambda p: p["place"])
        all_placements.extend(placements)
        categories_payload.append({
            "discipline": discipline,
            "gender": gender,
            "category_name": category_name,
            "competition_level": tournament.competition_level or "municipal",
            "placements": placements,
            "progress": progress,
            "participants": participants_payload,
            "kata_scores": kata_scores_payload,
            "bouts": bouts_payload
        })

    categories_payload.sort(key=category_sort_key)

    discipline_counts = {}
    for reg in regs:
        discipline_counts[reg.discipline] = discipline_counts.get(reg.discipline, 0) + 1

    summary = {
        "participant_count": len(regs),
        "category_count": len(groups),
        "discipline_counts": discipline_counts
    }
    tournament_info = {
        "name": tournament.name,
        "location": tournament.location,
        "event_date": str(tournament.event_date),
        "registration_closes_at": str(tournament.registration_closes_at) if tournament.registration_closes_at else None,
        "status": tournament.status,
        "competition_level": tournament.competition_level or "municipal",
        "chief_judge": tournament.chief_judge,
        "chief_secretary": tournament.chief_secretary,
    }

    return tournament_info, summary, categories_payload, all_placements

@app.get("/api/v1/tournaments/{tournament_id}/documents/excel")
def export_documents_excel(tournament_id: str, db: Session = Depends(get_db)):
    assembled = _assemble_tournament_documents(tournament_id, db)
    if not assembled:
        return {"success": False, "message": "Турнир не найден"}
    tournament_info, summary, categories_payload, all_placements = assembled

    # Одна категория = один .xlsx + сводная справка отдельным файлом, всё в ZIP.
    cats_with_people = [c for c in categories_payload if c.get("participants")]
    if not cats_with_people:
        return {"success": False, "message": "Нет категорий с участниками для выгрузки"}

    buffer = build_category_excel_zip(tournament_info, cats_with_people, summary=summary)
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=sportdok_excel_{tournament_id[:8]}.zip"}
    )

@app.get("/api/v1/tournaments/{tournament_id}/documents/pdf")
def export_documents_pdf(tournament_id: str, db: Session = Depends(get_db)):
    assembled = _assemble_tournament_documents(tournament_id, db)
    if not assembled:
        return {"success": False, "message": "Турнир не найден"}
    tournament_info, summary, categories_payload, all_placements = assembled

    buffer = build_pdf(tournament_info, summary, categories_payload, team_standings(all_placements))

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=sportdok_export_{tournament_id[:8]}.pdf"}
    )

@app.get("/api/v1/tournaments/{tournament_id}/documents/participants-pdf")
def export_participants_pdf(tournament_id: str, db: Session = Depends(get_db)):
    """Публичная выгрузка: только списки участников по категориям."""
    assembled = _assemble_tournament_documents(tournament_id, db)
    if not assembled:
        return {"success": False, "message": "Турнир не найден"}
    tournament_info, _summary, categories_payload, _placements = assembled
    buffer = build_participants_list_pdf(tournament_info, categories_payload)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=sportdok_participants_{tournament_id[:8]}.pdf"}
    )

# ─── СПРАВОЧНИКИ ──────────────────────────────────────────────────────────────

@app.get("/api/v1/weight-categories/")
def list_weight_categories(discipline: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(WeightCategory)
    if discipline:
        query = query.filter(WeightCategory.discipline == discipline)
    categories = query.order_by(WeightCategory.discipline, WeightCategory.sort_order).all()
    return [
        {"id": str(c.id), "discipline": c.discipline, "name": c.name}
        for c in categories
    ]

@app.get("/api/v1/ranks/")
def list_ranks(db: Session = Depends(get_db)):
    ranks = db.query(Rank).order_by(Rank.sort_order).all()
    return [{"id": str(r.id), "name": r.name} for r in ranks]

@app.get("/api/v1/kata-types/")
def list_kata_types(group: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(KataType)
    if group:
        query = query.filter(KataType.group == group)
    # Сортировка по официальному порядку стилей (KATA_STYLE_ORDER), а не по
    # алфавиту группы - иначе при совпадающих названиях ката из разных стилей
    # (напр. "Ванкан" в Косики и Годзю-рю) фронтенд определит стиль иначе,
    # чем kata_style() на бэкенде, и сетка/доступ секретаря разъедутся.
    kata_types = sorted(
        query.all(),
        key=lambda k: (KATA_STYLE_ORDER.index(k.group) if k.group in KATA_STYLE_ORDER else len(KATA_STYLE_ORDER), k.sort_order)
    )
    return [
        {
            "id": str(k.id), "group": k.group, "name": k.name,
            "code": k.code, "coefficient": float(k.coefficient) if k.coefficient is not None else None
        }
        for k in kata_types
    ]

# Статика загруженных обложек турниров (после API-роутов)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_ROOT)), name="uploads")
