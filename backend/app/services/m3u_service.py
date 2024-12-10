import aiohttp
import logging
from typing import List, Optional
from ..models import Channel
import re
import hashlib

logger = logging.getLogger(__name__)


class M3UService:
    async def download_and_parse(self, url: str) -> List[Channel]:
        """Download M3U file and parse it into channels"""
        logger.info(f"Downloading M3U from {url}")

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    if not response.ok:
                        raise Exception(f"HTTP {response.status}: {response.reason}")

                    content = await response.text()
                    logger.info(f"Downloaded {len(content)} bytes")

                    return self.parse_m3u(content)

        except Exception as e:
            logger.error(f"Failed to download M3U: {str(e)}")
            raise

    def _generate_channel_id(self, name: str, url: str) -> str:
        """Generate a unique channel ID from name and URL"""
        # Create a unique string combining name and URL
        unique_string = f"{name}:{url}"
        # Create an MD5 hash and take first 12 characters
        return hashlib.md5(unique_string.encode()).hexdigest()[:12]

    def parse_m3u(self, content: str) -> List[Channel]:
        """Parse M3U content into channel objects"""
        lines = content.split("\n")
        channels = []
        current_channel = None
        channel_number = 1  # Initialize counter

        for line in lines:
            line = line.strip()

            if line.startswith("#EXTINF:"):
                # Parse channel info
                info = line[8:].split(",", 1)
                if len(info) == 2:
                    attrs = self._parse_attributes(info[0])
                    name = info[1].strip()
                    current_channel = {
                        "channel_number": channel_number,  # Add channel number
                        "guide_id": self._generate_channel_id(
                            name, attrs.get("tvg-id", "")
                        ),
                        "name": name,
                        "group": attrs.get("group-title", "Uncategorized"),
                        "logo": attrs.get("tvg-logo"),
                    }
                    channel_number += 1  # Increment counter

            elif line.startswith("http"):
                if current_channel:
                    current_channel["url"] = line
                    channels.append(current_channel)
                    current_channel = None

        return channels

    def _parse_attributes(self, attr_string: str) -> dict:
        """Parse EXTINF attributes into a dictionary"""
        attrs = {}
        matches = re.finditer(r'([a-zA-Z-]+)="([^"]*)"', attr_string)
        for match in matches:
            key, value = match.groups()
            attrs[key] = value
        return attrs
