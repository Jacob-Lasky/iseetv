from fastapi import FastAPI, Depends, HTTPException, Request
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
from fastapi.responses import StreamingResponse
import httpx
import m3u8
from urllib.parse import urljoin


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
        f"Getting channels with skip={skip}, limit={limit}, group={group}, search={search}, favorites_only={favorites_only}"
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

        # If group is specified, don't paginate
        if group:
            channels = query.all()
        else:
            channels = query.offset(skip).limit(limit).all()

        return {"items": channels, "total": total, "skip": skip, "limit": limit}
    except Exception as e:
        logger.error(f"Error getting channels: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/channels/{channel_number}/favorite")
async def toggle_favorite(channel_number: int, db: Session = Depends(database.get_db)):
    """Toggle favorite status for a channel"""
    logger.info(f"Toggling favorite status for channel {channel_number}")

    # Get the channel
    channel = (
        db.query(models.Channel)
        .filter(models.Channel.channel_number == channel_number)
        .first()
    )

    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Toggle the favorite status
    channel.is_favorite = not channel.is_favorite

    try:
        # Commit the change to the database
        db.commit()
        # Refresh the channel object to ensure we have the latest data
        db.refresh(channel)
        logger.info(
            f"Channel {channel_number} favorite status updated to: {channel.is_favorite}"
        )
        return channel
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update favorite status: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update favorite status")


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
    logger.info("Getting channel groups")
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


@app.get("/stream/{channel_number}")
async def stream_channel(
    request: Request, channel_number: int, db: Session = Depends(database.get_db)
):
    channel = (
        db.query(models.Channel)
        .filter(models.Channel.channel_number == channel_number)
        .first()
    )
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    m3u8_url = f"{channel.url}.m3u8"

    async def stream_for_30_seconds():
        start_time = datetime.datetime.now()
        while (datetime.datetime.now() - start_time).total_seconds() < 30:
            try:
                async with httpx.AsyncClient(
                    timeout=30.0, follow_redirects=True
                ) as client:
                    response = await client.get(m3u8_url)
                    if response.status_code != 200:
                        raise HTTPException(
                            status_code=response.status_code,
                            detail="Failed to fetch HLS manifest",
                        )

                    # Parse the m3u8 file
                    playlist = m3u8.loads(response.text)

                    # Log some info about the manifest
                    logger.info(f"Segments: {len(playlist.segments)}")
                    logger.info(f"Target Duration: {playlist.target_duration}")
                    logger.info(
                        f"Time elapsed: {(datetime.datetime.now() - start_time).total_seconds():.1f}s"
                    )

                    yield playlist.dumps().encode()
                    await asyncio.sleep(2)  # Wait 2 seconds before next update

            except Exception as e:
                logger.error(f"Failed to fetch manifest: {str(e)}")
                await asyncio.sleep(1)  # Wait before retry
                continue

        logger.info("30 second test complete, stopping stream")

    return StreamingResponse(
        content=stream_for_30_seconds(),
        media_type="application/vnd.apple.mpegurl",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
    )


@app.get("/segment/{channel_number}")
async def get_segment(channel_number: int, url: str):
    """Proxy endpoint for HLS segments"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, follow_redirects=True)
            response.raise_for_status()

            return StreamingResponse(
                content=response.aiter_bytes(),
                media_type="video/MP2T",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Access-Control-Allow-Headers": "*",
                    "Cache-Control": "public, max-age=86400",
                },
            )
    except Exception as e:
        logger.error(f"Segment fetch error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
