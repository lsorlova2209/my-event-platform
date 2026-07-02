from sqlalchemy import Column, String, Date, DateTime, Numeric, Integer
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
from app.database import Base

class Athlete(Base):
    __tablename__ = "athletes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    last_name = Column(String, nullable=False)
    first_name = Column(String, nullable=False)
    middle_name = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    birth_date = Column(Date, nullable=False)
    age_years = Column(String, nullable=True)
    weight = Column(Numeric, nullable=True)
    rank = Column(String, nullable=True)
    club_name = Column(String, nullable=True)
    trainer_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Registration(Base):
    __tablename__ = "registrations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    athlete_id = Column(UUID(as_uuid=True), nullable=False)
    tournament_id = Column(UUID(as_uuid=True), nullable=False)
    discipline = Column(String, nullable=False)
    category_name = Column(String, nullable=True)
    team_number = Column(String, nullable=True)
    admission_status = Column(String, nullable=True)
    seed = Column(Integer, nullable=True)
    subgroup = Column(Integer, nullable=True)
    status = Column(String, nullable=False, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)