from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db, engine, Base
from app.models.user import User
from app.auth import hash_password, verify_password, create_token

Base.metadata.create_all(bind=engine)

app = FastAPI(title="СпортДок API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoginRequest(BaseModel):
    email: str
    password: str

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

@app.get("/")
def root():
    return {"status": "ok", "project": "СпортДок"}

@app.post("/api/v1/auth/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        return {"success": False, "message": "Неверный email или пароль"}
    token = create_token({"sub": str(user.id), "role": user.role})
    return {
        "success": True,
        "token": token,
        "role": user.role,
        "name": user.name,
        "email": data.email
    }