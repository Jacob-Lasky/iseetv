from sqlalchemy import Column, Integer, String, DateTime, Boolean
from app.database import Base
import datetime


class Channel(Base):
    __tablename__ = "channels"

    channel_number = Column(Integer, primary_key=True)
    guide_id = Column(String, index=True)
    name = Column(String, index=True)
    url = Column(String)
    group = Column(String, index=True)
    logo = Column(String, nullable=True)
    is_favorite = Column(Boolean, default=False)
    last_watched = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
