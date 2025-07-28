import { useState, useMemo, useEffect } from 'react';
import './App.css';
import RealtimeChat from './pages/RealtimeChat';
import { Configuration } from './pages/Configuration';
import Sessions from './pages/Sessions';
import SessionDetail from './pages/SessionDetail';
import { useSettings } from './hooks/useSettings';
import {
  AppBar,
  Box,
  Toolbar,
  IconButton,
  Typography,
  Menu,
  MenuItem,
  ThemeProvider,
  createTheme,
  CssBaseline,
  Container,
  Button,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChatIcon from '@mui/icons-material/Chat';
import SettingsIcon from '@mui/icons-material/Settings';
import HistoryIcon from '@mui/icons-material/History';

type View = 'chat' | 'configuration' | 'sessions' | 'session-detail';

function App() {
  const [anchorElNav, setAnchorElNav] = useState<null | HTMLElement>(null);
  const [currentView, setCurrentView] = useState<View>('chat');
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const { settings } = useSettings();
  const [darkMode, setDarkMode] = useState(false);
  
  useEffect(() => {
    if (settings?.darkMode !== undefined) {
      setDarkMode(settings.darkMode);
    }
  }, [settings]);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? 'dark' : 'light',
        },
      }),
    [darkMode],
  );

  const handleOpenNavMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElNav(event.currentTarget);
  };

  const handleCloseNavMenu = () => {
    setAnchorElNav(null);
  };

  const navigateTo = (view: View, sessionId?: number) => {
    setCurrentView(view);
    if (sessionId !== undefined) {
      setSelectedSessionId(sessionId);
    }
    handleCloseNavMenu();
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static">
          <Container maxWidth="xl">
            <Toolbar disableGutters>
              {/* Logo for desktop */}
              <ChatIcon sx={{ display: { xs: 'none', md: 'flex' }, mr: 1 }} />
              <Typography
                variant="h6"
                noWrap
                sx={{
                  mr: 2,
                  display: { xs: 'none', md: 'flex' },
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  letterSpacing: '.3rem',
                  color: 'inherit',
                  textDecoration: 'none',
                }}
              >
                NIA
              </Typography>

              {/* Mobile menu */}
              <Box sx={{ flexGrow: 1, display: { xs: 'flex', md: 'none' } }}>
                <IconButton
                  size="large"
                  aria-label="navigation menu"
                  aria-controls="menu-appbar"
                  aria-haspopup="true"
                  onClick={handleOpenNavMenu}
                  color="inherit"
                >
                  <MenuIcon />
                </IconButton>
                <Menu
                  id="menu-appbar"
                  anchorEl={anchorElNav}
                  anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                  }}
                  keepMounted
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                  }}
                  open={Boolean(anchorElNav)}
                  onClose={handleCloseNavMenu}
                  sx={{ display: { xs: 'block', md: 'none' } }}
                >
                  <MenuItem onClick={() => navigateTo('chat')}>
                    <Typography sx={{ textAlign: 'center' }}>Chat</Typography>
                  </MenuItem>
                  <MenuItem onClick={() => navigateTo('sessions')}>
                    <Typography sx={{ textAlign: 'center' }}>Sessions</Typography>
                  </MenuItem>
                  <MenuItem onClick={() => navigateTo('configuration')}>
                    <Typography sx={{ textAlign: 'center' }}>Configuration</Typography>
                  </MenuItem>
                </Menu>
              </Box>

              {/* Logo for mobile */}
              <ChatIcon sx={{ display: { xs: 'flex', md: 'none' }, mr: 1 }} />
              <Typography
                variant="h5"
                noWrap
                sx={{
                  mr: 2,
                  display: { xs: 'flex', md: 'none' },
                  flexGrow: 1,
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  letterSpacing: '.3rem',
                  color: 'inherit',
                  textDecoration: 'none',
                }}
              >
                NIA
              </Typography>

              {/* Desktop navigation */}
              <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' }, justifyContent: 'center' }}>
                <Button
                  onClick={() => navigateTo('chat')}
                  sx={{ 
                    my: 2, 
                    color: 'white', 
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mx: 2,
                    fontWeight: currentView === 'chat' ? 'bold' : 'normal',
                    borderBottom: currentView === 'chat' ? '2px solid white' : 'none',
                  }}
                  startIcon={<ChatIcon />}
                >
                  Chat
                </Button>
                <Button
                  onClick={() => navigateTo('sessions')}
                  sx={{ 
                    my: 2, 
                    color: 'white', 
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mx: 2,
                    fontWeight: currentView === 'sessions' || currentView === 'session-detail' ? 'bold' : 'normal',
                    borderBottom: currentView === 'sessions' || currentView === 'session-detail' ? '2px solid white' : 'none',
                  }}
                  startIcon={<HistoryIcon />}
                >
                  Sessions
                </Button>
                <Button
                  onClick={() => navigateTo('configuration')}
                  sx={{ 
                    my: 2, 
                    color: 'white', 
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mx: 2,
                    fontWeight: currentView === 'configuration' ? 'bold' : 'normal',
                    borderBottom: currentView === 'configuration' ? '2px solid white' : 'none',
                  }}
                  startIcon={<SettingsIcon />}
                >
                  Configuration
                </Button>
              </Box>
            </Toolbar>
          </Container>
        </AppBar>
        
        <main className="container">
          {currentView === 'chat' && <RealtimeChat />}
          {currentView === 'configuration' && <Configuration />}
          {currentView === 'sessions' && (
            <Sessions onSelectSession={(id) => navigateTo('session-detail', id)} />
          )}
          {currentView === 'session-detail' && selectedSessionId && (
            <SessionDetail 
              sessionId={selectedSessionId} 
              onBack={() => navigateTo('sessions')} 
            />
          )}
        </main>
      </Box>
    </ThemeProvider>
  );
}

export default App;

