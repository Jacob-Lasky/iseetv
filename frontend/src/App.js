import { Container, Typography, Button, Box, IconButton } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { useState, useMemo } from 'react';
import './App.css';
import { api } from './services/api';

function App() {
  const [mode, setMode] = useState('system');
  const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

  const theme = useMemo(() => createTheme({
    palette: {
      mode: mode === 'system' ? (prefersDarkMode ? 'dark' : 'light') : mode,
    },
  }), [mode, prefersDarkMode]);

  const toggleTheme = () => {
    setMode(prevMode => {
      if (prevMode === 'light') return 'dark';
      if (prevMode === 'dark') return 'system';
      return 'light';
    });
  };

  const fetchData = async () => {
    try {
      const data = await api.get('/items');
      console.log(data);
    } catch (error) {
      console.error('Failed to fetch:', error);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="sm">
        <Box sx={{ 
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2
        }}>
          <IconButton onClick={toggleTheme} color="inherit">
            {theme.palette.mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>
          <Typography variant="h4" component="h1">
            Welcome to React!
          </Typography>
          <Typography variant="body1">
            Current theme: {mode}
          </Typography>
          <Button 
            variant="contained" 
            color="primary"
            href="https://reactjs.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn React
          </Button>
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;
