from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
from app.database import Base

class Bout(Base):
    __tablename__ = "bouts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tournament_id = Column(UUID(as_uuid=True), nullable=False)
    discipline = Column(String, nullable=False)
    category_name = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    round_label = Column(String, nullable=False, default="round1")

    registration_id_a = Column(UUID(as_uuid=True), nullable=False)
    registration_id_b = Column(UUID(as_uuid=True), nullable=False)

    waza_ari_a = Column(Integer, nullable=False, default=0)
    ippon_a = Column(Integer, nullable=False, default=0)
    line1_level_a = Column(Integer, nullable=False, default=0)
    line2_level_a = Column(Integer, nullable=False, default=0)
    line3_level_a = Column(Integer, nullable=False, default=0)

    waza_ari_b = Column(Integer, nullable=False, default=0)
    ippon_b = Column(Integer, nullable=False, default=0)
    line1_level_b = Column(Integer, nullable=False, default=0)
    line2_level_b = Column(Integer, nullable=False, default=0)
    line3_level_b = Column(Integer, nullable=False, default=0)

    winner_registration_id = Column(UUID(as_uuid=True), nullable=True)
    win_method = Column(String, nullable=True)
    status = Column(String, nullable=False, default="pending")
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
