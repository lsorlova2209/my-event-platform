from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from datetime import date, datetime
from typing import Optional, List
from app.database import get_db, engine, Base
from app.models.user import User
from app.models.tournament import Tournament
from app.models.athlete import Athlete, Registration
from app.models.club import Club
from app.models.reference import WeightCategory, Rank, KataType
from app.models.bout import Bout
from app.auth import hash_password, verify_password, create_token
from app.draw import build_category_draw
from app.kumite_protocol import determine_winner

Base.metadata.create_all(bind=engine)

app = FastAPI(title="СпортДок API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# ─── STARTUP ──────────────────────────────────────────────────────────────────

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

KATA_TYPES = {
    "ОК-ката": ["Годзю-рю", "Вадо-рю", "Ренгокай", "Группа", "Бункай"],
    "СЗ-ката": [
        "Соло", "Соло с предметом", "Пара", "Пара с предметами",
        "Группа", "Группа смешанная", "Группа смешанная с предметами"
    ],
}

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
            KataType(group=group, name=name, sort_order=i)
            for group, names in KATA_TYPES.items()
            for i, name in enumerate(names)
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
        status="pending"
    )
    db.add(club)
    db.commit()
    return {"success": True, "message": "Заявка подана. Ожидайте одобрения администратора."}

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
        }
        for c in clubs
    ]

@app.post("/api/v1/clubs/{club_id}/approve")
def approve_club(club_id: str, db: Session = Depends(get_db)):
    club = db.query(Club).filter(Club.id == club_id).first()
    if not club:
        return {"success": False, "message": "Клуб не найден"}
    club.status = "approved"
    db.commit()
    return {"success": True, "message": f"Клуб {club.full_name} одобрен"}

@app.post("/api/v1/clubs/{club_id}/reject")
def reject_club(club_id: str, db: Session = Depends(get_db)):
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
def add_club_trainer(club_id: str, data: TrainerAdd, db: Session = Depends(get_db)):
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
def remove_club_trainer(club_id: str, name: str, db: Session = Depends(get_db)):
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
def create_tournament(data: TournamentCreate, db: Session = Depends(get_db)):
    tournament = Tournament(
        name=data.name,
        location=data.location,
        event_date=data.event_date,
        registration_closes_at=data.registration_closes_at,
        admin_user_id=data.admin_user_id,
        status="draft"
    )
    db.add(tournament)
    db.commit()
    db.refresh(tournament)
    return {
        "success": True,
        "id": str(tournament.id),
        "name": tournament.name,
        "location": tournament.location,
        "event_date": str(tournament.event_date),
        "status": tournament.status
    }

@app.get("/api/v1/tournaments/")
def list_tournaments(db: Session = Depends(get_db)):
    tournaments = db.query(Tournament).order_by(Tournament.created_at.desc()).all()
    return [
        {
            "id": str(t.id),
            "name": t.name,
            "location": t.location,
            "event_date": str(t.event_date),
            "status": t.status
        }
        for t in tournaments
    ]

@app.delete("/api/v1/tournaments/{tournament_id}")
def delete_tournament(tournament_id: str, db: Session = Depends(get_db)):
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        return {"success": False, "message": "Турнир не найден"}
    name = tournament.name
    db.query(Registration).filter(Registration.tournament_id == tournament_id).delete()
    db.delete(tournament)
    db.commit()
    return {"success": True, "message": f"Турнир {name} удалён"}

@app.post("/api/v1/tournaments/{tournament_id}/draw")
def draw_tournament(tournament_id: str, db: Session = Depends(get_db)):
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        return {"success": False, "message": "Турнир не найден"}

    rank_order = {r.name: r.sort_order for r in db.query(Rank).all()}
    regs = db.query(Registration).filter(Registration.tournament_id == tournament_id).all()

    groups = {}
    for reg in regs:
        athlete = db.query(Athlete).filter(Athlete.id == reg.athlete_id).first()
        if not athlete:
            continue
        key = (reg.discipline, athlete.gender, reg.category_name)
        groups.setdefault(key, []).append({
            "registration_id": str(reg.id),
            "full_name": f"{athlete.last_name} {athlete.first_name} {athlete.middle_name or ''}".strip(),
            "club_name": athlete.club_name,
            "rank_sort_order": rank_order.get(athlete.rank),
            "_reg": reg
        })

    if not groups:
        return {"success": False, "message": "В турнире нет заявленных участников"}

    categories = []
    for (discipline, gender, category_name), participants in groups.items():
        result = build_category_draw(discipline, participants)
        flat = result["participants"] if "participants" in result else [p for sub in result["subgroups"] for p in sub["participants"]]
        for p in flat:
            p["_reg"].seed = p["seed"]
            p["_reg"].subgroup = p.get("subgroup")
            del p["_reg"]
        categories.append({
            "discipline": discipline,
            "gender": gender,
            "category_name": category_name,
            "participant_count": len(participants),
            **result
        })

    db.commit()
    return {"success": True, "tournament_id": tournament_id, "categories": categories}

# ─── ATHLETES ─────────────────────────────────────────────────────────────────

@app.post("/api/v1/athletes/")
def create_athlete(data: AthleteCreate, db: Session = Depends(get_db)):
    athlete = Athlete(
        last_name=data.last_name,
        first_name=data.first_name,
        middle_name=data.middle_name,
        gender=data.gender,
        birth_date=data.birth_date,
        age_years=data.age_years,
        weight=data.weight,
        rank=data.rank,
        club_name=data.club_name,
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

    return {"success": True, "athlete_id": str(athlete.id)}

@app.get("/api/v1/tournaments/{tournament_id}/athletes")
def list_athletes(tournament_id: str, db: Session = Depends(get_db)):
    regs = db.query(Registration).filter(
        Registration.tournament_id == tournament_id
    ).all()
    result = []
    for reg in regs:
        athlete = db.query(Athlete).filter(Athlete.id == reg.athlete_id).first()
        if athlete:
            result.append({
                "id": str(athlete.id),
                "registration_id": str(reg.id),
                "full_name": f"{athlete.last_name} {athlete.first_name} {athlete.middle_name or ''}".strip(),
                "gender": athlete.gender,
                "birth_date": str(athlete.birth_date),
                "weight": float(athlete.weight) if athlete.weight else None,
                "rank": athlete.rank,
                "club_name": athlete.club_name,
                "discipline": reg.discipline,
                "category_name": reg.category_name,
                "team_number": reg.team_number,
                "admission_status": reg.admission_status,
                "seed": reg.seed,
                "subgroup": reg.subgroup
            })
    return result

@app.delete("/api/v1/athletes/{athlete_id}")
def delete_athlete(athlete_id: str, db: Session = Depends(get_db)):
    athlete = db.query(Athlete).filter(Athlete.id == athlete_id).first()
    if not athlete:
        return {"success": False, "message": "Участник не найден"}
    full_name = f"{athlete.last_name} {athlete.first_name}"
    db.query(Registration).filter(Registration.athlete_id == athlete_id).delete()
    db.delete(athlete)
    db.commit()
    return {"success": True, "message": f"Участник {full_name} удалён"}

# ─── ПРОТОКОЛ КУМИТЭ ──────────────────────────────────────────────────────────

@app.post("/api/v1/bouts/")
def create_bout(data: BoutCreate, db: Session = Depends(get_db)):
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

    bout = Bout(
        tournament_id=data.tournament_id,
        discipline=reg_a.discipline,
        category_name=reg_a.category_name,
        round_label=data.round_label or "round1",
        registration_id_a=data.registration_id_a,
        registration_id_b=data.registration_id_b
    )
    db.add(bout)
    db.commit()
    db.refresh(bout)
    return {"success": True, "id": str(bout.id)}

@app.post("/api/v1/bouts/{bout_id}/result")
def submit_bout_result(bout_id: str, data: BoutResult, db: Session = Depends(get_db)):
    bout = db.query(Bout).filter(Bout.id == bout_id).first()
    if not bout:
        return {"success": False, "message": "Поединок не найден"}

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
    kata_types = query.order_by(KataType.group, KataType.sort_order).all()
    return [
        {"id": str(k.id), "group": k.group, "name": k.name}
        for k in kata_types
    ]
