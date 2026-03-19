import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import EVENTS from './socketEvents';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Room from './pages/Room';
import Settings from './pages/Settings';
import Countdowns from './pages/Countdowns';
import Login from './pages/Login';
import Register from './pages/Register';

// Lazy load pages that are less frequently used or have heavy dependencies
const Highscores = React.lazy(() => import('./pages/Highscores'));
const ApiDocs = React.lazy(() => import('./pages/ApiDocs'));
const ExtensionInfo = React.lazy(() => import('./pages/ExtensionInfo'));
const Esports = React.lazy(() => import('./pages/Esports'));
const KoalaDashboard = React.lazy(() => import('./pages/KoalaDashboard'));
const GlobalBets = React.lazy(() => import('./pages/GlobalBets'));
const Admin = React.lazy(() => import('./pages/Admin'));
const FeatureRequests = React.lazy(() => import('./pages/FeatureRequests'));

import NewsTicker from './components/NewsTicker';
import Friends from './pages/Friends';
import WeatherWidget from './components/WeatherWidget';
import ClockWidget from './components/ClockWidget';
import KoalaCoinWidget from './components/KoalaCoinWidget';
import useEsportsNotifications from './hooks/useEsportsNotifications';
import GlobalAudioController from './components/GlobalAudioController';
import LiveStreamWidget from './components/LiveStreamWidget';
import './index.css';
import { Menu, Clock } from 'lucide-react';
import { useAuth } from './context/AuthContext';

// Global styles for the app container
const appStyle = {
  display: 'flex',
  width: '100%',
  height: '100%',
};

// Flex flow replaces contentStyle

// We will instantiate the socket inside App to control its lifecycle
const DEFAULT_LEAGUES = ['LCK', 'LEC', 'Prime League'];

function InnerApp() {
  const { user, setUser, token } = useAuth();
  const location = useLocation();

  const [activeRoomId, setActiveRoomId] = useState(() => localStorage.getItem('activeRoomId') || null);
  const [activeToken, setActiveToken] = useState(() => localStorage.getItem('activeToken') || null);
  const [roomState, setRoomState] = useState(null);
  const [roomError, setRoomError] = useState(null);
  const [roomTokens, setRoomTokens] = useState({ readToken: null, writeToken: null });

  // Sync room ID and token to localStorage
  useEffect(() => {
    if (activeRoomId) localStorage.setItem('activeRoomId', activeRoomId);
    else localStorage.removeItem('activeRoomId');
  }, [activeRoomId]);

  useEffect(() => {
    if (activeToken) localStorage.setItem('activeToken', activeToken);
    else localStorage.removeItem('activeToken');
  }, [activeToken]);

  // Clear room on logout
  useEffect(() => {
    if (!token) {
      setActiveRoomId(null);
      setActiveToken(null);
    }
  }, [token]);
  const [globalSocket, setGlobalSocket] = useState(null);
  const [isZenMode, setIsZenMode] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [globalAnnouncement, setGlobalAnnouncement] = useState('');
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);

  // Esports live match notifications
  const selectedLeagues = user.preferences?.esportsLeagues || DEFAULT_LEAGUES;
  useEsportsNotifications(selectedLeagues, globalSocket);

  useEffect(() => {
    // Check for extension installation
    const handleWindowMessage = (event) => {
      // Accept PONG from bridge.js
      if (event.data?.action === 'EXTENSION_PONG') {
        console.log('[App] Received EXTENSION_PONG from bridge.js!');
        setUser(prev => {
          if (prev.preferences?.hasExtension) return prev;
          console.log('[App] Setting hasExtension to true and propagating to server...');
          return { ...prev, preferences: { ...prev.preferences, hasExtension: true } };
        });
      }

      // Generic Data Pipe (Extension -> Window -> Socket)
      if (event.data?.type === 'EXTENSION_OUTBOUND') {
        window.dispatchEvent(new CustomEvent('EXTENSION_OUTBOUND_EVENT', {
          detail: event.data.payload
        }));
      }
    };
    window.addEventListener('message', handleWindowMessage);

    // Ping extension shortly after load
    setTimeout(() => window.postMessage({ action: 'EXTENSION_PING' }, '*'), 500);

    const newSocket = io('/', {
      transports: ['websocket'],
      autoConnect: true,
      auth: { token }
    });
    setGlobalSocket(newSocket);

    newSocket.on(EVENTS.CONNECT, () => {
      console.log('[App] globalSocket connected! ID:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on(EVENTS.GLOBAL_ANNOUNCEMENT, (data) => {
      if (data && data.message) {
        setGlobalAnnouncement(data.message);
        setTimeout(() => {
          setGlobalAnnouncement(prev => prev === data.message ? '' : prev);
        }, 15000);
      }
    });

    // Live coin balance update (no more F5 needed!)
    newSocket.on(EVENTS.COIN_BALANCE_UPDATE, ({ balance }) => {
      setUser(prev => ({ ...prev, koala_balance: balance }));
    });
    // Latency tracking loop
    newSocket.on(EVENTS.PONG, ({ clientTime, serverTime }) => {
      const now = Date.now();
      const ping = Math.round((now - clientTime) / 2);
      // Offset: if serverTime is 1000, and ping is 50, true time when we get it is 1050.
      // So offset = (serverTime + ping) - localDateNow
      const offset = (serverTime + ping) - now;
      setServerTimeOffset(offset);

      // Report back to server so others see our ping
      newSocket.emit(EVENTS.REPORT_METRICS, { ping, offset });
    });

    const pingInterval = setInterval(() => {
      if (newSocket.connected) {
        newSocket.emit(EVENTS.PING, { clientTime: Date.now() });
      }
    }, 5000);

    newSocket.on(EVENTS.DISCONNECT, (reason) => {
      console.error('[App] SOCKET DISCONNECTED. Reason:', reason);
      setIsConnected(false);
    });

    console.log('[App] InnerApp MOUNTED');

    return () => {
      console.trace('[App] InnerApp UNMOUNTING! This is destroying the socket!');
      window.removeEventListener('message', handleWindowMessage);
      clearInterval(pingInterval);
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    // Apply theme
    const theme = user?.preferences?.theme || 'neon';
    document.documentElement.dataset.theme = theme;

    // Notify server of preference change (like hasExtension) if in room
    if (globalSocket?.connected && activeRoomId) {
      globalSocket.emit('UPDATE_PREFERENCES', { roomId: activeRoomId, preferences: user.preferences });
    }
  }, [user, globalSocket, activeRoomId]);

  useEffect(() => {
    if (!activeRoomId || !user?.id || !globalSocket) return;

    // Ensure socket is connected before emitting
    const join = () => {
      console.log('[App] Joining room:', activeRoomId, 'with user:', user.displayName, 'token:', activeToken);
      setRoomError(null);
      globalSocket.emit(EVENTS.JOIN_ROOM, {
        roomId: activeRoomId,
        userId: user.id,
        displayName: user.displayName,
        preferences: user.preferences,
        token: activeToken
      });
    };

    const handleConnect = () => {
      join();
    };

    if (globalSocket.connected) {
      join();
    } else {
      globalSocket.on(EVENTS.CONNECT, handleConnect);
    }

    const handleSync = (state) => {
      setRoomState(state);

      // Auto-fetch tokens if we are a writer
      const myUser = state.users.find(u => u.userId === user.id || u.id === user.id || u.socketId === globalSocket?.id);
      if (myUser && myUser.role === 'write' && globalSocket) {
        globalSocket.emit(EVENTS.GET_INVITE_TOKENS, { roomId: state.id });
      }
    };
    const handleError = (msg) => {
      if (msg === 'Room not found or has expired. Please check the URL or create a new room.') {
        // If the user is NOT actively trying to view a room page, clear the active room state silently
        if (!location.pathname.startsWith('/room/')) {
          console.log('[App] Auto-rejoin failed: Room no longer exists. Clearing state.');
          setActiveRoomId(null);
          setActiveToken(null);
          return;
        }
      }
      console.error('[App] Received room error:', msg);
      setRoomError(msg);
    };
    const handleTokens = (data) => setRoomTokens(data);

    globalSocket.on(EVENTS.SYNC_STATE, handleSync);
    globalSocket.on(EVENTS.ERROR, handleError);
    globalSocket.on(EVENTS.ROOM_INVITE, (data) => {
      if (window.confirm(`${data.inviterName} has invited you to join the room "${data.roomName}". Join now?`)) {
        window.location.href = `/room/${data.roomId}`;
      }
    });
    globalSocket.on(EVENTS.INVITE_TOKENS, handleTokens);

    const handleOutboundSync = (e) => {
      const payload = e.detail;
      globalSocket.emit(EVENTS.EXTENSION_MESSAGE, { roomId: activeRoomId, payload });
    };
    window.addEventListener('EXTENSION_OUTBOUND_EVENT', handleOutboundSync);

    const handleExtensionMessage = (data) => {
      window.postMessage({
        type: 'EXTENSION_INBOUND',
        payload: data.payload,
        senderName: data.userDisplayName || null
      }, '*');
    };
    globalSocket.on(EVENTS.EXTENSION_MESSAGE, handleExtensionMessage);

    return () => {
      console.log('[App] Leaving room cleanup for:', activeRoomId);
      globalSocket.off(EVENTS.CONNECT, handleConnect);
      globalSocket.off(EVENTS.SYNC_STATE, handleSync);
      globalSocket.off(EVENTS.ERROR, handleError);
      globalSocket.off(EVENTS.INVITE_TOKENS, handleTokens);
      globalSocket.off(EVENTS.EXTENSION_MESSAGE, handleExtensionMessage);
      window.removeEventListener('EXTENSION_OUTBOUND_EVENT', handleOutboundSync);
      // Removed globalSocket.emit('leave_room'); from here because React StrictMode triggers Mount -> Unmount -> Mount instantly, 
      // causing us to leave the room right after joining.
    };
  }, [activeRoomId, activeToken, user?.id, globalSocket]);

  if (!globalSocket) return null;

  return (
      <>
      <GlobalAudioController socket={globalSocket} roomState={roomState} />
      <div className={`app-container ${globalAnnouncement ? 'has-banner' : ''}`} style={appStyle}>

        {globalAnnouncement && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
            background: '#ef4444', color: 'white', padding: '12px 24px',
            textAlign: 'center', fontWeight: 'bold', display: 'flex',
            justifyContent: 'space-between', alignItems: 'center',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
          }}>
            <span style={{ flex: 1 }}>{globalAnnouncement}</span>
            <button
              onClick={() => setGlobalAnnouncement('')}
              style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}
            >
              ✕
            </button>
          </div>
        )}

        {!isConnected && (
          <div style={{
            position: 'fixed',
            top: globalAnnouncement ? '50px' : '0', // Adjusted top position if announcement is present
            left: 0,
            right: 0,
            zIndex: 1000,
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            color: 'white',
            textAlign: 'center',
            padding: '10px 16px',
            fontSize: '0.85rem',
            fontWeight: 600,
            letterSpacing: '0.02em',
            animation: 'pulse 2s infinite',
          }}>
            ⚡ Connection lost — reconnecting...
          </div>
        )}

        {!isZenMode && (
          <>
            <div className="mobile-header">
              <button className="btn-ghost" style={{ padding: '8px', border: 'none' }} onClick={() => setIsMobileMenuOpen(true)}>
                <Menu size={24} color="var(--text-main)" />
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'center' }}>
                <Clock className="animate-glow" color="var(--accent-primary)" size={24} />
                <h2 style={{ fontSize: '1.2rem', margin: 0, background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  KoalaSync
                </h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ transform: 'scale(0.85)', transformOrigin: 'right center', display: 'flex', gap: '8px' }}>
                  {(user.preferences?.showClock ?? true) && <ClockWidget />}
                  {user?.id && (user.preferences?.showKoalaCoins ?? true) && <KoalaCoinWidget balance={user.koala_balance || 0} />}
                  {(user.preferences?.showWeather ?? false) && <WeatherWidget />}
                </div>
                <div id="mobile-room-actions"></div>
              </div>
            </div>

            {/* Global Desktop Widgets Container */}
            <div className="desktop-only" style={{ 
              position: 'absolute', 
              top: '32px', 
              right: isRightPanelOpen ? '352px' : '32px', 
              display: 'flex', 
              gap: '12px', 
              alignItems: 'center', 
              zIndex: 50,
              transition: 'right 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
              {(user.preferences?.showClock ?? true) && <ClockWidget />}
              {user?.id && (user.preferences?.showKoalaCoins ?? true) && <KoalaCoinWidget balance={user.koala_balance || 0} />}
              {(user.preferences?.showWeather ?? false) && <WeatherWidget />}
              <div id="desktop-room-actions" style={{ display: 'flex', gap: '12px' }}></div>
            </div>

            <div
              className={`sidebar-overlay ${isMobileMenuOpen ? 'open' : ''}`}
              onClick={() => setIsMobileMenuOpen(false)}
            />

            <Sidebar
              user={user}
              roomState={roomState}
              socket={globalSocket}
              activeToken={activeToken}
              isOpen={isMobileMenuOpen}
              onClose={() => setIsMobileMenuOpen(false)}
            />

            <LiveStreamWidget />
          </>
        )}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <main className="main-content" style={{ flex: 1, overflowY: 'auto', padding: isZenMode ? '0' : '2rem', position: 'relative' }}>
            <React.Suspense fallback={<div className="flex-center" style={{ height: '100%', opacity: 0.5 }}>Loading...</div>}>
              <Routes>
                <Route path="/" element={<Home user={user} globalSocket={globalSocket} />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/room/:id" element={<Room user={user} socket={globalSocket} roomState={roomState} roomError={roomError} roomTokens={roomTokens} setActiveRoomId={setActiveRoomId} setActiveToken={setActiveToken} isZenMode={isZenMode} setIsZenMode={setIsZenMode} serverTimeOffset={serverTimeOffset} setIsRightPanelOpen={setIsRightPanelOpen} />} />
                <Route path="/highscores" element={<Highscores />} />
                <Route path="/esports" element={<Esports selectedLeagues={selectedLeagues} socket={globalSocket} />} />
                <Route path="/koala-dashboard" element={<KoalaDashboard />} />
                <Route path="/countdowns" element={<Countdowns user={user} />} />
                <Route path="/global-bets" element={<GlobalBets />} />
                <Route path="/settings" element={<Settings user={user} setUser={setUser} socket={globalSocket} />} />
                <Route path="/api-docs" element={<ApiDocs />} />
                <Route path="/extension-info" element={<ExtensionInfo />} />
                <Route path="/admin" element={<Admin socket={globalSocket} />} />
                <Route path="/features" element={<FeatureRequests />} />
              </Routes>
            </React.Suspense>
          </main>
          {(!isZenMode && (user.preferences?.showNewsTicker ?? (window.innerWidth > 768))) && <NewsTicker socket={globalSocket} />}
        </div>
      </div>
      </>
  );
}

import { AuthProvider } from './context/AuthContext';

function App() {
  return (
    <Router>
      <AuthProvider>
        <InnerApp />
      </AuthProvider>
    </Router>
  );
}

export default App;
