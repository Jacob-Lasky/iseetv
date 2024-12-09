from sqlalchemy import Column, Integer, String, DateTime
from app.database import Base
import datetime


class Channel(Base):
    __tablename__ = "channels"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    url = Column(String)
    group = Column(String, index=True)
    logo = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
