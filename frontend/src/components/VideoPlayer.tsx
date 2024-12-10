import React from 'react';
import { Box, Paper, Avatar, Typography } from '@mui/material';
import Hls from 'hls.js';
import { Channel } from '../models/Channel';

export {};

interface VideoPlayerProps {
  url: string;
  channel: Channel;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ url, channel }) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play()
          .catch(e => console.warn('Autoplay prevented:', e));
      });

      return () => {
        hls.destroy();
        video.pause();
      };
    }
    else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.play()
        .catch(e => console.warn('Autoplay prevented:', e));

      return () => {
        video.pause();
      };
    }
  }, [url]);

  return (
    <Paper elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ 
        width: '100%', 
        height: '100%',
        maxHeight: 'calc(100vh - 160px)', // Adjusted to account for info bar
        bgcolor: 'black',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <video
          ref={videoRef}
          controls
          style={{ 
            width: '100%',
            height: '100%',
            maxHeight: '100%',
            objectFit: 'contain'
          }}
          playsInline
          autoPlay
        />
      </Box>
      
      {/* Channel Info Bar */}
      <Box sx={{ 
        p: 1, 
        display: 'flex', 
        alignItems: 'center',
        gap: 2,
        borderTop: 1,
        borderColor: 'divider'
      }}>
        <Avatar
          src={channel.logo}
          alt={channel.name}
          variant="square"
          sx={{ width: 40, height: 40 }}
        >
          {channel.name[0]}
        </Avatar>
        <Typography variant="h6" component="div">
          {channel.name}
        </Typography>
      </Box>
    </Paper>
  );
}; 