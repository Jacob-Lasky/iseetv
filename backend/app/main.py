from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app import models, database
from typing import Optional
from pydantic import BaseModel
import logging
import sys
import datetime
from .services.m3u_service import M3UService
from sqlalchemy import func
from fastapi.responses import StreamingResponse
import requests
from .video_helpers import get_video_codec, transcode_to_h264
import time

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


# In-memory cache for channel codecs
codec_cache = {}


async def get_codec(channel_number: int, original_url: str):
    # Check cache
    if channel_number in codec_cache:
        return codec_cache[channel_number]
    else:
        # clear the cache
        clear_cache()

    # Fetch and cache codec
    codec = await get_video_codec(original_url)
    logger.info(f"Cached codec for channel {channel_number}: {codec}")
    codec_cache[channel_number] = codec
    return codec


def clear_cache():
    global codec_cache
    codec_cache = {}
    logger.info("Cleared codec cache")


# Add a test log at startup
@app.on_event("startup")
async def startup_event():
    logger.info("ISeeTV backend starting up...")


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
            query = query.filter(models.Channel.is_favorite)

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
async def stream_channel(channel_number: int, db: Session = Depends(database.get_db)):
    # Fetch the channel from the database
    channel = (
        db.query(models.Channel)
        .filter(models.Channel.channel_number == channel_number)
        .first()
    )
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Construct the m3u8 URL
    original_url = f"{channel.url}.m3u8"
    logger.debug(f"Fetching HLS manifest from {original_url}")

    try:
        # Check if transcoding is needed
        codec = await get_codec(channel_number, original_url)
        logger.debug(f"Detected codec: {codec}")

        if "h264" in codec:
            logger.debug("Streaming original H264 stream without transcoding")

            # Fetch the original stream using requests
            def stream_original():
                start_time = time.time()
                with requests.get(original_url, stream=True) as response:
                    response.raise_for_status()
                    for chunk in response.iter_content(chunk_size=1024 * 1024):
                        yield chunk
                logger.debug(f"Streaming time: {time.time() - start_time}")

            return StreamingResponse(
                stream_original(), media_type="application/vnd.apple.mpegurl"
            )

        elif "hevc" in codec:
            # Transcode HEVC to H.264
            process = transcode_to_h264(original_url)

            # Stream FFmpeg output
            async def stream_ffmpeg_output():
                while True:
                    chunk = process.stdout.read(1024)
                    if not chunk:
                        break
                    yield chunk
                process.stdout.close()
                process.wait()  # Wait for FFmpeg to finish
                if process.returncode != 0:
                    logger.error(f"FFmpeg error: {process.stderr.read().decode()}")
                    raise RuntimeError("FFmpeg failed during transcoding.")

            return StreamingResponse(
                stream_ffmpeg_output(), media_type="application/vnd.apple.mpegurl"
            )

        else:
            raise HTTPException(status_code=415, detail=f"Unsupported codec: {codec}")

    except Exception as e:
        logger.error(f"Error streaming channel {channel_number}: {str(e)}")
        raise HTTPException(
            status_code=500, detail="An error occurred during streaming."
        )


# used by hls.js
@app.get("/hls/{segment_path:path}")
async def get_hls_segment(segment_path: str):
    # Proxy the segment requests to the external HLS server
    segment_url = f"https://medcoreplatplus.xyz:443/hls/{segment_path}"
    logger.debug(f"Fetching HLS segment from {segment_url}")
    response = requests.get(segment_url, stream=True)

    if response.status_code == 200:
        return StreamingResponse(
            response.iter_content(chunk_size=1024), media_type="video/MP2T"
        )
    raise HTTPException(
        status_code=response.status_code, detail="Failed to fetch segment"
    )
