from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
from app.database import Base

class Club(Base):
    __tablename__ = "clubs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    responsible_name = Column(String, nullable=False)
    responsible_position = Column(String, nullable=True)
    full_name = Column(String, nullable=False)
    short_name = Column(String, nullable=True)
    region = Column(String, nullable=True)
    contact_phone = Column(String, nullable=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    trainers = Column(String, nullable=True)
    status = Column(String, nullable=False, default="pending")
    # ТЗ 3.2, шаг 2-3: подтверждение email по ссылке из письма, раньше
    # одобрения администратором.
    email_verified = Column(Boolean, nullable=False, default=False)
    email_verification_token = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
