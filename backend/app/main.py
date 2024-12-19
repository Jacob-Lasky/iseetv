from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app import models, database
from typing import Optional, Dict, Tuple
from pydantic import BaseModel
import logging
import sys
import datetime
from .services.m3u_service import M3UService
from sqlalchemy import func
from fastapi.responses import StreamingResponse
import requests
from .video_helpers import get_video_codec, transcode_video, transcode_audio_only
import time
import subprocess
import os
import shutil
import time
import signal
from starlette.staticfiles import StaticFiles
from starlette.routing import Mount

# import uvicorn
# from custom_logger import get_logger

# # Set up logging before creating the FastAPI app
# logger = get_logger(__name__, prefix="[backend]")
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


# gpu availability cache
gpu_availability_cache = {}


async def is_gpu_available(channel_number: int):
    if channel_number in gpu_availability_cache:
        return gpu_availability_cache[channel_number]
    else:
        try:
            result = subprocess.run(
                ["nvidia-smi"], stdout=subprocess.PIPE, stderr=subprocess.PIPE
            )
            is_gpu_available = result.returncode == 0
            logger.info(f"GPU availability: {is_gpu_available}")
            gpu_availability_cache[channel_number] = is_gpu_available
            return is_gpu_available
        except FileNotFoundError:
            return False


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


# Temporary directories for streaming
stream_resources: Dict[int, Tuple[str, subprocess.Popen]] = {}

# Mount a single static files directory for all segments
SEGMENTS_DIR = "/tmp/iseetv_segments"
os.makedirs(SEGMENTS_DIR, exist_ok=True)
app.mount("/segments", StaticFiles(directory=SEGMENTS_DIR), name="segments")


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

    # Create temp directory for this channel if it doesn't exist
    if channel_number not in stream_resources:
        # Create channel-specific directory inside the segments directory
        channel_dir = os.path.join(SEGMENTS_DIR, str(channel_number))
        os.makedirs(channel_dir, exist_ok=True)
        logger.info(f"Created channel directory: {channel_dir}")

        # Start FFmpeg process
        process, output_m3u8 = transcode_audio_only(
            original_url, channel_dir, channel_number
        )

        # Wait for the .m3u8 manifest to be ready
        timeout = 10
        start_time = time.time()
        manifest_ready = False

        while not manifest_ready and time.time() - start_time < timeout:
            if os.path.exists(output_m3u8):
                # Check if at least one segment exists
                segments = [f for f in os.listdir(channel_dir) if f.endswith(".ts")]
                if segments:
                    manifest_ready = True
                    break
            time.sleep(0.5)

        if not manifest_ready:
            # Clean up if manifest isn't ready
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
            if os.path.exists(channel_dir):
                shutil.rmtree(channel_dir)
            raise HTTPException(
                status_code=500,
                detail="Failed to generate HLS manifest and segments.",
            )

        # Only store the resources after we know they're ready
        stream_resources[channel_number] = (channel_dir, process)
        logger.info(
            f"Started FFmpeg process for channel {channel_number} with PID {process.pid}"
        )

        # Only after the new channel is ready, clean up other channels
        for existing_channel in list(stream_resources.keys()):
            if existing_channel != channel_number:
                logger.info(
                    f"Cleaning up existing channel {existing_channel} before switching"
                )
                cleanup_channel_resources(existing_channel)

    channel_dir, _ = stream_resources[channel_number]
    output_m3u8 = os.path.join(channel_dir, "output.m3u8")

    # Verify the file exists before returning
    if not os.path.exists(output_m3u8):
        # If file doesn't exist, clean up and raise error
        cleanup_channel_resources(channel_number)
        raise HTTPException(
            status_code=500,
            detail="M3U8 file not found. Channel may have been cleaned up.",
        )

    # Add this before returning the FileResponse
    logger.info(f"Serving m3u8 for channel {channel_number}")

    # Verify m3u8 content before serving
    with open(output_m3u8, "r") as f:
        content = f.read()
        logger.debug(f"M3U8 content: {content}")

    return FileResponse(output_m3u8, media_type="application/vnd.apple.mpegurl")


def update_base_url(m3u8_path: str, mount_path: str):
    """Update the base URL in the m3u8 file to match the mount path"""
    if os.path.exists(m3u8_path):
        with open(m3u8_path, "r") as f:
            content = f.read()

        # Update the base URL
        content = content.replace("/segments/", f"{mount_path}/")

        with open(m3u8_path, "w") as f:
            f.write(content)


@app.get("/stream/{channel_number}/cleanup")
def cleanup_channel_resources(channel_number: int):
    """Clean up resources for a specific channel."""
    if channel_number in stream_resources:
        channel_dir, process = stream_resources.pop(channel_number)

        # Terminate the FFmpeg process gracefully
        if process.poll() is None:
            logger.info(f"Terminating FFmpeg process for channel {channel_number}")
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                logger.warning(
                    f"FFmpeg process for channel {channel_number} didn't terminate gracefully, killing it"
                )
                process.kill()

        # Remove the channel directory
        if os.path.exists(channel_dir):
            logger.info(f"Removing channel directory: {channel_dir}")
            shutil.rmtree(channel_dir, ignore_errors=True)

        return {"message": f"Cleaned up resources for channel {channel_number}"}

    return {"message": f"No resources found for channel {channel_number}"}


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


@app.on_event("shutdown")
def cleanup_temp_dirs():
    # Clean up all channels and the segments directory
    for channel_number in list(stream_resources.keys()):
        cleanup_channel_resources(channel_number)
    if os.path.exists(SEGMENTS_DIR):
        shutil.rmtree(SEGMENTS_DIR)
