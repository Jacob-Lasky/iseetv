import subprocess
from fastapi import HTTPException
import logging
import sys
import subprocess
import os

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s:\t%(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger(__name__)


async def get_video_codec(url: str) -> str:
    logger.info(f"Determining video codec for {url}")
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
                "-i",
                url,
                "-c:v",
                "libx264",
                "-preset",
                "faster",
                "-c:a",
                "aac",
                "-b:a",
                "128k",  # Transcode audio to AAC
                "-f",
                "hls",
                "-hls_time",
                "4",
                "-hls_list_size",
                "0",
                "pipe:1",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            # bufsize=10**6,
        )
        return process
    except Exception as e:
        logger.error(f"FFmpeg failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to transcode video.")


def transcode_with_gpu(url: str):
    process = subprocess.Popen(
        [
            "ffmpeg",
            "-hwaccel",
            "cuda",
            "-i",
            url,
            "-c:v",
            "h264_nvenc",
            "-preset",
            "fast",
            "-c:a",
            "aac",
            "-b:a",
            "128k",  # Transcode audio to AAC
            "-f",
            "hls",
            "-hls_time",
            "4",
            "-hls_list_size",
            "0",
            "pipe:1",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        # bufsize=10**6,
    )
    return process


import subprocess
import os
import tempfile


def transcode_audio_only(url: str, channel_dir: str, channel_number: int):
    output_m3u8 = os.path.join(channel_dir, "output.m3u8")
    segment_pattern = os.path.join(channel_dir, "segment%03d.ts")

    process = subprocess.Popen(
        [
            "ffmpeg",
            "-i",
            url,
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-ar",
            "44100",
            "-b:a",
            "128k",
            "-ac",
            "2",
            "-f",
            "hls",
            "-hls_time",
            "4",
            "-hls_list_size",
            "0",
            "-hls_segment_filename",
            segment_pattern,
            "-hls_base_url",
            f"/api/segments/{channel_number}/",
            output_m3u8,
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    return process, output_m3u8


def transcode_video(url: str, gpu_available: bool):
    if gpu_available:
        logger.debug("GPU detected. Using GPU for transcoding.")
        return transcode_with_gpu(url)
    else:
        logger.debug("No GPU detected. Using CPU for transcoding.")
        return transcode_to_h264(url)
