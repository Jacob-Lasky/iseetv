import React, { useState } from 'react';
import { Container, Box, IconButton, ThemeProvider, CssBaseline, Drawer, useMediaQuery, Tooltip } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { Settings as SettingsIcon } from '@mui/icons-material';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { SettingsModal } from './components/SettingsModal';
import { VideoPlayer } from './components/VideoPlayer';
import { ChannelList } from './components/ChannelList';
import { settingsService } from './services/settingsService';
import { channelService } from './services/channelService';
import type { Settings } from './models/Settings';
import type { Channel } from './models/Channel';
import { LoadingOverlay } from './components/LoadingOverlay';
import { NumbersIcon } from './components/NumbersIcon';

const DRAWER_WIDTH = 300;

function App() {
  const [settings, setSettings] = useState<Settings>(settingsService.getSettings());
  const [showSettings, setShowSettings] = useState(settingsService.shouldShowSettings());
  const [selectedChannel, setSelectedChannel] = useState<Channel>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [downloadProgress, setDownloadProgress] = useState<{ loaded: number; total: number }>();

  const theme = React.useMemo(() => createTheme({
    palette: {
      mode: settings.theme === 'system' 
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : settings.theme,
    }
  }), [settings.theme]);

  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(!isMobile);

  const handleChannelSelect = async (channel: Channel) => {
    setSelectedChannel(channel);
    if (isMobile) setDrawerOpen(false);
  };

  const handleToggleFavorite = async (channel: Channel) => {
    try {
      await channelService.toggleFavorite(channel.channel_number);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleSaveSettings = async (newSettings: Settings) => {
    // Save settings first
    setSettings(newSettings);
    settingsService.saveSettings(newSettings);
    setShowSettings(false);  // Close modal immediately

    // Then load channels if M3U URL changed
    if (newSettings.m3uUrl !== settings.m3uUrl) {
      try {
        setIsLoading(true);
        setError(undefined);
        setDownloadProgress(undefined);
        
        await channelService.refreshM3U(newSettings.m3uUrl);
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('[App] Settings save error:', {
          message: errorMessage,
          error: err
        });
        setError(`Failed to load channels: ${errorMessage}`);
      } finally {
        setIsLoading(false);
        setDownloadProgress(undefined);
      }
    }
  };

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    setSettings({ ...settings, theme });
  };

  const handleToggleChannelNumbers = () => {
    const newSettings = {
      ...settings,
      showChannelNumbers: !settings.showChannelNumbers
    };
    setSettings(newSettings);
    settingsService.saveSettings(newSettings);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth={false} disableGutters sx={{ height: '100vh' }}>
        <Box sx={{ display: 'flex', height: '100%' }}>
          {/* Channel List Drawer */}
          <Drawer
            variant={isMobile ? 'temporary' : 'persistent'}
            open={isMobile ? drawerOpen : drawerOpen}
            onClose={() => setDrawerOpen(false)}
            sx={{
              width: DRAWER_WIDTH,
              flexShrink: 0,
              '& .MuiDrawer-paper': {
                width: DRAWER_WIDTH,
                boxSizing: 'border-box',
              },
            }}
          >
            <Box sx={{ height: '100%', pt: 8, position: 'relative' }}>
              <Box sx={{ 
                position: 'absolute',
                top: 8,
                width: '100%',
                display: { xs: 'none', md: 'flex' },
                justifyContent: 'space-between',
                px: 1
              }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Tooltip title="Settings">
                    <IconButton onClick={() => setShowSettings(true)} size="small">
                      <SettingsIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={settings.showChannelNumbers ? "Hide Channel Numbers" : "Show Channel Numbers"}>
                    <IconButton 
                      onClick={handleToggleChannelNumbers}
                      size="small"
                      color={settings.showChannelNumbers ? "primary" : "default"}
                    >
                      <NumbersIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
                <IconButton onClick={() => setDrawerOpen(false)}>
                  <ChevronLeftIcon />
                </IconButton>
              </Box>
              <ChannelList
                selectedChannel={selectedChannel}
                onChannelSelect={handleChannelSelect}
                onToggleFavorite={handleToggleFavorite}
                showChannelNumbers={settings.showChannelNumbers}
                onToggleChannelNumbers={handleToggleChannelNumbers}
              />
            </Box>
          </Drawer>

          {/* Main Content */}
          <Box sx={{ flexGrow: 1, p: 2 }}>
            {/* Top Bar */}
            <Box sx={{ position: 'absolute', top: 16, left: 16, right: 16, display: 'flex', justifyContent: 'space-between' }}>
              <Box>
                {!drawerOpen && (
                  <IconButton 
                    onClick={() => setDrawerOpen(true)}
                    sx={{ display: { xs: 'none', md: 'flex' } }}
                  >
                    <ChevronRightIcon />
                  </IconButton>
                )}
                {isMobile && (
                  <IconButton onClick={() => setDrawerOpen(!drawerOpen)}>
                    <MenuIcon />
                  </IconButton>
                )}
              </Box>
            </Box>

            {/* Video Player */}
            {settings.m3uUrl && (
              <Box sx={{ 
                width: '100%',
                height: 'calc(100vh - 80px)', // Adjust based on your header height
                display: 'flex',
                flexDirection: 'column',
                mt: 2
              }}>
                {selectedChannel ? (
                  <VideoPlayer 
                    url={selectedChannel.url} 
                    channel={selectedChannel}
                  />
                ) : (
                  <Box 
                    sx={{ 
                      height: '100%', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      bgcolor: 'background.paper',
                      borderRadius: 1,
                      p: 3
                    }}
                  >
                    Select a channel to start watching
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </Box>

        <SettingsModal
          open={showSettings}
          onClose={() => setShowSettings(false)}
          settings={settings}
          onSave={handleSaveSettings}
          onThemeChange={handleThemeChange}
        />

        {isLoading && (
          <LoadingOverlay 
            message="Loading channels..." 
            progress={downloadProgress}
          />
        )}
        
        {error && (
          <Box sx={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0,
            zIndex: 2000,
            bgcolor: 'error.main',
            color: 'error.contrastText',
            p: 1,
            textAlign: 'center'
          }}>
            {error}
          </Box>
        )}
      </Container>
    </ThemeProvider>
  );
}

export default App; 