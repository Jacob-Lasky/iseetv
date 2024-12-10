from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app import models, database
from typing import List, Optional
from pydantic import BaseModel
import logging
from fastapi.logger import logger as fastapi_logger
import sys
import datetime
from .services.m3u_service import M3UService
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
import asyncio
from sqlalchemy import func


# Simpler logging setup
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s:\t%(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger(__name__)


app = FastAPI()


# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChannelBase(BaseModel):
    id: str
    name: str
    url: str
    group: str
    logo: Optional[str] = None
    is_favorite: bool = False
    last_watched: Optional[datetime.datetime] = None


# Add a test log at startup
@app.on_event("startup")
async def startup_event():
    logger.info("ISeeTV backend starting up...")


@app.post("/channels/bulk")
async def create_channels(
    channels: List[ChannelBase], db: Session = Depends(database.get_db)
):
    logger.info(f"Starting bulk upload of {len(channels)} channels")
    try:
        # Clear existing channels
        deleted_count = db.query(models.Channel).delete()
        logger.info(f"Deleted {deleted_count} existing channels")

        # Bulk insert new channels
        db_channels = [models.Channel(**channel.dict()) for channel in channels]
        db.bulk_save_objects(db_channels)
        db.commit()

        logger.info(f"Successfully saved {len(channels)} channels")
        return {"message": f"Saved {len(channels)} channels"}
    except Exception as e:
        logger.error(f"Error saving channels: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/channels")
async def get_channels(
    skip: int = 0,
    limit: int = 100,
    group: Optional[str] = None,
    search: Optional[str] = None,
    favorites_only: bool = False,
    db: Session = Depends(database.get_db),
):
    logger.info(
        f"Fetching channels (skip={skip}, limit={limit}, group={group}, "
        f"search={search}, favorites={favorites_only})"
    )
    try:
        query = db.query(models.Channel)

        # Apply filters
        if group:
            query = query.filter(models.Channel.group == group)
        if search:
            query = query.filter(models.Channel.name.ilike(f"%{search}%"))
        if favorites_only:
            query = query.filter(models.Channel.is_favorite == True)

        # Always order by channel number
        query = query.order_by(models.Channel.channel_number)

        # Get total count before pagination
        total = query.count()

        # Apply pagination
        channels = query.offset(skip).limit(limit).all()

        logger.info(f"Returning {len(channels)} channels out of {total} total")
        return {"items": channels, "total": total, "skip": skip, "limit": limit}
    except Exception as e:
        logger.error(f"Error getting channels: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/channels/{channel_id}/favorite")
async def toggle_favorite(channel_id: str, db: Session = Depends(database.get_db)):
    channel = db.query(models.Channel).filter(models.Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    channel.is_favorite = not channel.is_favorite
    db.commit()
    return channel


m3u_service = M3UService()


@app.post("/m3u/refresh")
async def refresh_m3u(url: str, db: Session = Depends(database.get_db)):
    """Download and process M3U file from URL"""
    logger.info(f"Starting M3U refresh from {url}")

    try:
        # Download and parse M3U
        channels = await m3u_service.download_and_parse(url)

        # Clear existing channels
        deleted_count = db.query(models.Channel).delete()
        logger.info(f"Deleted {deleted_count} existing channels")

        # Save new channels
        db_channels = [models.Channel(**channel) for channel in channels]
        db.bulk_save_objects(db_channels)
        db.commit()

        logger.info(f"Successfully saved {len(channels)} channels")
        return {"message": f"Saved {len(channels)} channels"}

    except Exception as e:
        logger.error(f"Failed to refresh M3U: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to refresh M3U: {str(e)}")


@app.get("/test")
async def test_endpoint():
    logger.info("Received test request")
    try:
        response = {"message": "Hello from FastAPI backend!"}
        logger.info(f"Sending response: {response}")
        return response
    except Exception as e:
        logger.error(f"Error in test endpoint: {str(e)}")
        raise


@app.get("/channels/groups")
async def get_channel_groups(db: Session = Depends(database.get_db)):
    """Get all groups and their channel counts"""
    try:
        # Use SQLAlchemy to get groups and counts
        groups = (
            db.query(
                models.Channel.group,
                func.count(models.Channel.channel_number).label("count"),
            )
            .group_by(models.Channel.group)
            .order_by(models.Channel.group)
            .all()
        )

        return [
            {"name": group or "Uncategorized", "count": count}
            for group, count in groups
        ]
    except Exception as e:
        logger.error(f"Error getting channel groups: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
