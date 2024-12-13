import subprocess
from fastapi import HTTPException
import logging
import sys
from fastapi import Depends
from functools import lru_cache

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s:\t%(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger(__name__)


# In-memory cache for channel codecs
codec_cache = {}


async def get_codec(channel_number: int, original_url: str):
    # Check cache
    if channel_number in codec_cache:
        return codec_cache[channel_number]

    # Fetch and cache codec
    codec = await get_video_codec(original_url)
    codec_cache[channel_number] = codec
    return codec


async def get_video_codec(url: str) -> str:
    logger.info(f"Fetching video codec for {url}")
    try:
        result = subprocess.run(
            [
                "ffprobe",
                # "-headers",
                # "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36",
                "-i",
                url,
                "-show_streams",
                "-select_streams",
                "v",
                "-show_entries",
                "stream=codec_name",
                "-of",
                "csv=p=0",
                "-loglevel",
                "error",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        # Log the error and raise an HTTP exception
        logger.error(f"FFprobe failed: {e.stderr}")
        raise HTTPException(status_code=500, detail="Failed to analyze video codec.")


def transcode_to_h264(url: str):
    logger.info(f"Transcoding video to H264 for {url}")
    try:
        process = subprocess.Popen(
            [
                "ffmpeg",
                # "-headers",
                # "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36",
                "-i",
                url,
                "-c:v",
                "libx264",
                "-c:a",
                "aac",
                "-f",
                "hls",
                "-hls_flags",
                "delete_segments",
                "-hls_time",
                "4",
                "pipe:1",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        return process
    except Exception as e:
        logger.error(f"FFmpeg failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to transcode video.")
