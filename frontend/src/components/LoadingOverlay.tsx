import React from 'react';
import { Box, CircularProgress, Backdrop, Typography } from '@mui/material';

interface LoadingOverlayProps {
  message?: string;
  progress?: {
    loaded: number;
    total: number;
  };
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  message = 'Loading...',
  progress 
}) => {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <Backdrop
      open={true}
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }}
    >
      <CircularProgress color="primary" size={60} />
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <Typography variant="h6" sx={{ color: 'white' }}>
          {message}
        </Typography>
        {progress && (
          <Typography variant="body2" sx={{ color: 'white' }}>
            {formatBytes(progress.loaded)}
            {progress.total > 0 && ` / ${formatBytes(progress.total)}`}
          </Typography>
        )}
      </Box>
    </Backdrop>
  );
}; 