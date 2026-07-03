from sqlalchemy import Column, String, DateTime, Numeric
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
from app.database import Base

class KataScore(Base):
    __tablename__ = "kata_scores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tournament_id = Column(UUID(as_uuid=True), nullable=False)
    registration_id = Column(UUID(as_uuid=True), nullable=False)
    category_name = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    round_label = Column(String, nullable=False)
    # Конкретная ката (реестр ФВКР, Приложение №1), которую участник выступил
    # в этом конкретном круге - как в официальном протоколе хода
    # соревнований, где у каждого круга своя колонка "ката" перед оценками.
    kata_name = Column(String, nullable=True)

    score_1 = Column(Numeric, nullable=False)
    score_2 = Column(Numeric, nullable=False)
    score_3 = Column(Numeric, nullable=False)
    score_4 = Column(Numeric, nullable=False)
    score_5 = Column(Numeric, nullable=False)

    total_score = Column(Numeric, nullable=False)
    lowest_counted_score = Column(Numeric, nullable=False)
    highest_counted_score = Column(Numeric, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)


class KataSession(Base):
    __tablename__ = "kata_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tournament_id = Column(UUID(as_uuid=True), nullable=False)
    category_name = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
