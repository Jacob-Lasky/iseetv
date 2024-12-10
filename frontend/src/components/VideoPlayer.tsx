import React from 'react';
import { Box, Paper } from '@mui/material';
import Hls from 'hls.js';

interface VideoPlayerProps {
  url: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ url }) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(e => console.log('Auto-play prevented:', e));
      });

      return () => {
        hls.destroy();
      };
    }
    else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = url;
    }
  }, [url]);

  return (
    <Paper elevation={3}>
      <Box sx={{ width: '100%', aspectRatio: '16/9', bgcolor: 'black' }}>
        <video
          ref={videoRef}
          controls
          style={{ width: '100%', height: '100%' }}
          playsInline
        />
      </Box>
    </Paper>
  );
}; 