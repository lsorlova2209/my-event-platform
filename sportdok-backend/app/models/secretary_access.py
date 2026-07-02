from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
from app.database import Base

class SecretaryAccess(Base):
    __tablename__ = "secretary_access"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tournament_id = Column(UUID(as_uuid=True), nullable=False)
    secretary_user_id = Column(UUID(as_uuid=True), nullable=False)
    discipline = Column(String, nullable=False)
    gender = Column(String, nullable=True)
    category_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
