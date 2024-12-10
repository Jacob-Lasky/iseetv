import aiohttp
import logging
from typing import List, Optional
from ..models import Channel
import re

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

    def parse_m3u(self, content: str) -> List[Channel]:
        """Parse M3U content into channel objects"""
        lines = content.split("\n")
        channels = []
        current_channel = None

        for line in lines:
            line = line.strip()

            if line.startswith("#EXTINF:"):
                # Parse channel info
                info = line[8:].split(",", 1)
                attrs = self._parse_attributes(info[0])
                name = (
                    info[1].strip()
                    if len(info) > 1
                    else attrs.get("tvg-name", "Unknown")
                )

                current_channel = {
                    "id": attrs.get("tvg-id", f"channel-{len(channels)}"),
                    "name": name,
                    "group": attrs.get("group-title", "Uncategorized"),
                    "logo": attrs.get("tvg-logo"),
                    "is_favorite": False,
                }

            elif line.startswith("http") and current_channel:
                current_channel["url"] = line
                channels.append(current_channel)
                current_channel = None

        logger.info(f"Parsed {len(channels)} channels")
        return channels

    def _parse_attributes(self, attr_string: str) -> dict:
        """Parse EXTINF attributes into a dictionary"""
        attrs = {}
        matches = re.finditer(r'([a-zA-Z-]+)="([^"]*)"', attr_string)
        for match in matches:
            key, value = match.groups()
            attrs[key] = value
        return attrs
