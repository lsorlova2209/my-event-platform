from sqlalchemy import Column, String, Date, DateTime, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
from app.database import Base


class CompetitionDay(Base):
    __tablename__ = "competition_days"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tournament_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    date = Column(Date, nullable=False)
    label = Column(String, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
