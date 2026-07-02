from sqlalchemy import Column, String, Integer, Numeric
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.database import Base

class WeightCategory(Base):
    __tablename__ = "weight_categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    discipline = Column(String, nullable=False)
    name = Column(String, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)


class Rank(Base):
    __tablename__ = "ranks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, unique=True, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)


class KataType(Base):
    __tablename__ = "kata_types"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group = Column(String, nullable=False)
    name = Column(String, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    # Реестр ката ФВКР (Приложение №1): официальный номер-код (например
    # "А-001") и коэффициент сложности, используемый при начислении баллов.
    code = Column(String, nullable=True, unique=True)
    coefficient = Column(Numeric, nullable=True)
