from sqlalchemy import Column, String, Date, DateTime
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
from app.database import Base

class Tournament(Base):
    __tablename__ = "tournaments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_user_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String, nullable=False)
    location = Column(String, nullable=True)
    event_date = Column(Date, nullable=False)
    registration_closes_at = Column(Date, nullable=True)
    status = Column(String, nullable=False, default="draft")
    # club — в сетке показываем клуб; region — регион (региональные и выше)
    competition_level = Column(String, nullable=False, default="club")
    # ФИО для подписей в PDF/Excel протоколах
    chief_judge = Column(String, nullable=True)
    chief_secretary = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)