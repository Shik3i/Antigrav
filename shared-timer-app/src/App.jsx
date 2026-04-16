import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import EVENTS from './socketEvents';
import Sidebar from './components/Sidebar';
// Page imports
const Home = React.lazy(() => import('./pages/Home'));
const Room = React.lazy(() => import('./pages/Room'));
const Settings = React.lazy(() => import('./pages/Settings'));
const Countdowns = React.lazy(() => import('./pages/Countdowns'));
const Login = React.lazy(() => import('./pages/Login'));
const Register = React.lazy(() => import('./pages/Register'));

// Lazy load pages that are less frequently used or have heavy dependencies
const Highscores = React.lazy(() => import('./pages/Highscores'));
const ApiDocs = React.lazy(() => import('./pages/ApiDocs'));
const ExtensionInfo = React.lazy(() => import('./pages/ExtensionInfo'));
const Esports = React.lazy(() => import('./pages/Esports'));
const KoalaDashboard = React.lazy(() => import('./pages/KoalaDashboard'));
const GlobalBets = React.lazy(() => import('./pages/GlobalBets'));
const Admin = React.lazy(() => import('./pages/Admin'));
const FeatureRequests = React.lazy(() => import('./pages/FeatureRequests'));
const KoalaFlap = React.lazy(() => import('./pages/KoalaFlap'));
const SpeedcubeTimer = React.lazy(() => import('./pages/SpeedcubeTimer'));
const GameLeaderboards = React.lazy(() => import('./pages/GameLeaderboards'));
const Changelog = React.lazy(() => import('./pages/Changelog'));
const UserProfile = React.lazy(() => import('./pages/UserProfile'));
const Achievements = React.lazy(() => import('./pages/Achievements'));
const AdminAchievements = React.lazy(() => import('./pages/AdminAchievements'));
const Scratchcards = React.lazy(() => import('./pages/ScratchcardShop'));
const RiftDefense = React.lazy(() => import('./pages/RiftDefense'));
const LoLIdleGame = React.lazy(() => import('./pages/LoLIdleGame'));
const ColorSyncGame = React.lazy(() => import('./pages/ColorSyncGame'));
const SharedCountdown = React.lazy(() => import('./pages/SharedCountdown'));
const LevelingTracker = React.lazy(() => import('./pages/LevelingTracker'));
const Tetris = React.lazy(() => import('./pages/Tetris'));
const PolymarketGeneral = React.lazy(() => import('./pages/PolymarketGeneral'));
const Wordle = React.lazy(() => import('./pages/Wordle'));
const NewsTicker = React.lazy(() => import('./components/NewsTicker'));
const WeatherWidget = React.lazy(() => import('./components/WeatherWidget'));
const LiveStreamWidget = React.lazy(() => import('./components/LiveStreamWidget'));
const Friends = React.lazy(() => import('./pages/Friends'));
import ClockWidget from './components/ClockWidget';
import KoalaCoinWidget from './components/KoalaCoinWidget';
import useEsportsNotifications from './hooks/useEsportsNotifications';
import GlobalAudioController from './components/GlobalAudioController';
import './index.css';
import { User, Settings as SettingsIcon, LogOut, Menu, X, Timer as TimerIcon, BarChart3, Bell, Shield, Heart, Sparkles, RefreshCw, ChevronRight, Clock } from 'lucide-react';
import { getNextPokemon } from './utils/pokemonUtils';
import { useAuth } from './context/AuthContext';
import { fetchJson } from './utils/apiClient';
import { getStoredValue, setStoredValue } from './utils/clientStorage';
import { scheduleDeferred } from './utils/deferred';
import { usePageVisibility } from './hooks/usePageVisibility';
import { FloatingWidgetSkeleton, RouteSkeleton, WidgetPillSkeleton, ViewLoader } from './components/LoadingSkeletons';
import { ToastProvider } from './context/ToastContext';
import ToastContainer from './components/ToastContainer';

// Global styles for the app container
const appStyle = {
  display: 'flex',
  width: '100%',
  height: '100%',
};

// Flex flow replaces contentStyle

// We will instantiate the socket inside App to control its lifecycle
const DEFAULT_LEAGUES = ['LEC', 'LCS', 'LCK', 'LPL', 'VCT_LOCK_IN', 'VCT_EMEA', 'VCT_AMERICAS', 'VCT_PACIFIC'];

const POKEMON_TYPES_MAP = {
  normal: '#A8A878', fire: '#F08030', water: '#6890F0', grass: '#78C850',
  electric: '#F8D030', ice: '#98D8D8', fighting: '#C03028', poison: '#A040A0',
  ground: '#E0C068', flying: '#A890F0', psychic: '#F85888', bug: '#A8B820',
  rock: '#B8A038', ghost: '#705898', dragon: '#7038F8', dark: '#705848',
  steel: '#B8B8D0', fairy: '#EE99AC'
};

const DEFAULT_TITLE = 'KoalaSync';
const EMPTY_ROOM_TOKENS = { readToken: null, writeToken: null };

function getExactRemainingMs(roomState, serverTimeOffset = 0) {
  if (!roomState?.state) return 0;
  if (!roomState.state.isRunning || !roomState.state.lastTickTime) {
    return roomState.state.remainingMs || 0;
  }

  const trueServerTime = Date.now() + serverTimeOffset;
  const elapsedSinceTick = trueServerTime - roomState.state.lastTickTime;
  return Math.max(0, (roomState.state.remainingMs || 0) - elapsedSinceTick);
}

function formatTimerTitle(ms) {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function InnerApp() {
  const { user, setUser, token } = useAuth();
  const [pokemonConfigs, setPokemonConfigs] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const isRoomRoute = location.pathname.startsWith('/room/');
  const isVisible = usePageVisibility();

  const [activeRoomId, setActiveRoomId] = useState(() => getStoredValue('activeRoomId', null));
  const [activeToken, setActiveToken] = useState(() => getStoredValue('activeToken', null));
  const [roomState, setRoomState] = useState(null);
  const [roomError, setRoomError] = useState(null);
  const [roomTokens, setRoomTokens] = useState(EMPTY_ROOM_TOKENS);
  const [deferredFeaturesReady, setDeferredFeaturesReady] = useState(false);

  // Sync room ID and token to localStorage
  useEffect(() => {
    setStoredValue('activeRoomId', activeRoomId);
  }, [activeRoomId]);

  useEffect(() => {
    setStoredValue('activeToken', activeToken);
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
  const [pendingInvite, setPendingInvite] = useState(null);

  const leaveActiveRoom = useCallback(({ navigateTo = '/' } = {}) => {
    if (globalSocket?.connected && activeRoomId) {
      globalSocket.emit(EVENTS.LEAVE_ROOM);
    }
    setActiveRoomId(null);
    setActiveToken(null);
    setRoomState(null);
    setRoomError(null);
    setRoomTokens(EMPTY_ROOM_TOKENS);
    setPendingInvite(null);
    setIsRightPanelOpen(false);
    setIsZenMode(false);
    if (navigateTo) {
      navigate(navigateTo);
    }
  }, [activeRoomId, globalSocket, navigate]);

  // Esports live match notifications
  const selectedLeagues = user.preferences?.esportsLeagues || DEFAULT_LEAGUES;
  useEsportsNotifications(selectedLeagues, globalSocket, {
    enabled: deferredFeaturesReady && selectedLeagues.length > 0
  });

  useEffect(() => {
    return scheduleDeferred(() => setDeferredFeaturesReady(true), 1200);
  }, []);

  // SOCKET INITIALIZATION: Strictly stable lifecycle
  useEffect(() => {
    const newSocket = io('/', {
      transports: ['websocket'],
      autoConnect: true,
      auth: { token }
    });
    
    setGlobalSocket(newSocket);

    // Common global listeners
    newSocket.on(EVENTS.CONNECT, () => {
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

    // Live coin balance update using functional update
    newSocket.on(EVENTS.COIN_BALANCE_UPDATE, ({ balance }) => {
      setUser(prev => ({ ...prev, koala_balance: balance }));
    });

    newSocket.on(EVENTS.DISCONNECT, (reason) => {
      setIsConnected(false);
    });

    const handleWindowMessage = (event) => {
      if (event.data?.action === 'EXTENSION_PONG') {
        setUser(prev => {
          if (prev.preferences?.hasExtension) return prev;
          return { ...prev, preferences: { ...prev.preferences, hasExtension: true } };
        });
      }
      if (event.data?.type === 'EXTENSION_OUTBOUND') {
        window.dispatchEvent(new CustomEvent('EXTENSION_OUTBOUND_EVENT', {
          detail: event.data.payload
        }));
      }
    };
    window.addEventListener('message', handleWindowMessage);

    return () => {
      window.removeEventListener('message', handleWindowMessage);
      newSocket.disconnect(); 
    };
  }, [token]);

  useEffect(() => {
    return scheduleDeferred(() => {
      window.postMessage({ action: 'EXTENSION_PING' }, '*');
    }, 900);
  }, []);

  // LATENCY & METRICS: Separate lifecycle
  useEffect(() => {
    if (!globalSocket) return;

    const handlePong = ({ clientTime, serverTime }) => {
      const now = Date.now();
      const ping = Math.round((now - clientTime) / 2);
      const offset = (serverTime + ping) - now;
      setServerTimeOffset(offset);
      globalSocket.emit(EVENTS.REPORT_METRICS, { ping, offset });
    };

    globalSocket.on(EVENTS.PONG, handlePong);

    const pingInterval = setInterval(() => {
      if (globalSocket.connected) {
        globalSocket.emit(EVENTS.PING, { clientTime: Date.now() });
      }
    }, isVisible ? 5000 : 30000);

    return () => {
      globalSocket.off(EVENTS.PONG, handlePong);
      clearInterval(pingInterval);
    };
  }, [globalSocket, isVisible]);

  useEffect(() => {
    const pokemonTheme = user?.preferences?.pokemonTheme;
    if (!pokemonTheme?.active || pokemonConfigs) return;

    fetchJson('/api/pokemon/configs', { token: '' })
      .then(setPokemonConfigs)
      .catch(err => console.error('Failed to fetch pokemon configs:', err));
  }, [pokemonConfigs, user?.preferences?.pokemonTheme]);

  useEffect(() => {
    // Apply theme
    const theme = user?.preferences?.theme || 'neon';
    document.documentElement.dataset.theme = theme;

    // Apply Pokemon Theme
    const pokemonTheme = user?.preferences?.pokemonTheme;
    if (pokemonTheme?.active && pokemonTheme?.id) {
      document.documentElement.dataset.pokemonMode = "true";
      
      // Contrast Logic: threshold > 0.6 is LIGHT
      if (parseFloat(pokemonTheme.threshold) > 0.6) {
        document.documentElement.classList.add('pokemon-light-mode');
      } else {
        document.documentElement.classList.remove('pokemon-light-mode');
      }

      const typeColors = pokemonTheme.types?.map(t => pokemonConfigs?.colors?.[t] || '#333') || ['#3b82f6'];
      const primaryColor = typeColors[0];
      const secondaryColor = typeColors[1] || primaryColor;
      
      document.documentElement.style.setProperty('--accent-primary', primaryColor);
      document.documentElement.style.setProperty('--accent-secondary', secondaryColor);
      document.documentElement.style.setProperty('--accent-gradient', `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`);
    } else {
      document.documentElement.dataset.pokemonMode = "false";
      document.documentElement.classList.remove('pokemon-light-mode');
      document.documentElement.style.removeProperty('--accent-primary');
      document.documentElement.style.removeProperty('--accent-secondary');
      document.documentElement.style.removeProperty('--accent-gradient');
    }

    // Notify server of preference change (like hasExtension) if in room
    if (globalSocket?.connected && activeRoomId) {
      globalSocket.emit('UPDATE_PREFERENCES', { roomId: activeRoomId, preferences: user.preferences });
    }
  }, [user, globalSocket, activeRoomId]);

  // Keep tab title in sync independently from the room page lifecycle.
  useEffect(() => {
    if (!roomState) {
      document.title = DEFAULT_TITLE;
      return undefined;
    }

    const roomName = roomState.config?.name || roomState.name || DEFAULT_TITLE;
    const updateTitle = () => {
      const nextTitle = `${formatTimerTitle(getExactRemainingMs(roomState, serverTimeOffset))} - ${roomName}`;
      if (document.title !== nextTitle) {
        document.title = nextTitle;
      }
    };

    updateTitle();
    const intervalId = setInterval(updateTitle, 1000);
    return () => clearInterval(intervalId);
  }, [
    roomState?.id,
    roomState?.config?.name,
    roomState?.name,
    roomState?.state?.isRunning,
    roomState?.state?.remainingMs,
    roomState?.state?.lastTickTime,
    serverTimeOffset
  ]);

  // ROOM JOIN & SYNC: persistent beyond route changes
  useEffect(() => {
    if (!activeRoomId || !user?.id || !globalSocket) {
      if (!activeRoomId) {
        setRoomState(null);
        setRoomError(null);
        setRoomTokens(EMPTY_ROOM_TOKENS);
      }
      return undefined;
    }

    setRoomError(null);
    setRoomTokens(EMPTY_ROOM_TOKENS);
    setRoomState(prev => prev?.id === activeRoomId ? prev : null);

    const join = () => {
      setRoomError(null);
      globalSocket.emit(EVENTS.JOIN_ROOM, {
        roomId: activeRoomId,
        userId: user.id,
        displayName: user.displayName,
        preferences: user.preferences,
        token: activeToken
      });
    };

    const handleConnect = () => join();
    if (globalSocket.connected) join();
    else globalSocket.on(EVENTS.CONNECT, handleConnect);

    const handleSync = (state) => {
      setRoomState(state);
      // Functional approach: compare and emit only if necessary
      const myUser = state.users.find(u => u.userId === user.id || u.socketId === globalSocket.id);
      if (myUser?.role === 'write' && globalSocket.connected) {
        globalSocket.emit(EVENTS.GET_INVITE_TOKENS, { roomId: state.id });
      }
    };

    const handleError = (msg) => {
      if (msg.includes('Room not found') && !location.pathname.startsWith('/room/')) {
        setActiveRoomId(null);
        setActiveToken(null);
        setRoomState(null);
        setRoomTokens(EMPTY_ROOM_TOKENS);
        return;
      }
      setRoomError(msg);
    };

    const handleTokens = (data) => setRoomTokens(data);

    const handleInvite = (data) => {
      setPendingInvite(data);
    };

    const handleMetricsUpdate = ({ socketId, userId, metrics }) => {
      setRoomState(prev => {
        if (!prev?.users?.length) return prev;
        return {
          ...prev,
          users: prev.users.map(currentUser => {
            const matchesSocket = socketId && currentUser.socketId === socketId;
            const matchesUser = userId && currentUser.userId === userId;
            if (!matchesSocket && !matchesUser) return currentUser;
            return { ...currentUser, metrics: { ...(currentUser.metrics || {}), ...metrics } };
          })
        };
      });
    };

    const handleExtensionMessage = (data) => {
      window.postMessage({ type: 'EXTENSION_INBOUND', payload: data.payload, senderName: data.userDisplayName }, '*');
    };

    const handleOutboundSync = (e) => {
      globalSocket.emit(EVENTS.EXTENSION_MESSAGE, { roomId: activeRoomId, payload: e.detail });
    };

    globalSocket.on(EVENTS.SYNC_STATE, handleSync);
    globalSocket.on(EVENTS.ERROR, handleError);
    globalSocket.on(EVENTS.ROOM_INVITE, handleInvite);
    globalSocket.on(EVENTS.INVITE_TOKENS, handleTokens);
    globalSocket.on(EVENTS.EXTENSION_MESSAGE, handleExtensionMessage);
    globalSocket.on(EVENTS.METRICS_UPDATE, handleMetricsUpdate);
    window.addEventListener('EXTENSION_OUTBOUND_EVENT', handleOutboundSync);

    return () => {
      globalSocket.off(EVENTS.CONNECT, handleConnect);
      globalSocket.off(EVENTS.SYNC_STATE, handleSync);
      globalSocket.off(EVENTS.ERROR, handleError);
      globalSocket.off(EVENTS.ROOM_INVITE, handleInvite);
      globalSocket.off(EVENTS.INVITE_TOKENS, handleTokens);
      globalSocket.off(EVENTS.EXTENSION_MESSAGE, handleExtensionMessage);
      globalSocket.off(EVENTS.METRICS_UPDATE, handleMetricsUpdate);
      window.removeEventListener('EXTENSION_OUTBOUND_EVENT', handleOutboundSync);
    };
  }, [activeRoomId, activeToken, user?.id, globalSocket, location.pathname]);

  // Pokémon Slideshow Logic
  useEffect(() => {
    const pokemonTheme = user?.preferences?.pokemonTheme;
    if (!pokemonTheme?.active || !pokemonTheme?.slideshow) return;

    const rotate = () => {
      fetch('/api/pokemon')
        .then(res => res.json())
        .then(list => {
          const nextP = getNextPokemon(list, pokemonTheme);
          if (nextP) {
            setUser(prev => ({
              ...prev,
              preferences: {
                ...prev.preferences,
                pokemonTheme: { 
                  ...prev.preferences.pokemonTheme, 
                  id: nextP.id, 
                  name: nextP.name, 
                  types: nextP.types, 
                  threshold: nextP.threshold,
                  backgroundColor: nextP.backgroundColor
                }
              }
            }));
          }
        });
    };

    const interval = setInterval(rotate, isVisible ? 5 * 60 * 1000 : 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isVisible, user.preferences.pokemonTheme?.active, user.preferences.pokemonTheme?.slideshow, user.preferences.pokemonTheme?.mode, user.preferences.pokemonTheme?.selectedType]);

  if (!globalSocket) return null;

  return (
      <>
      <ToastContainer />
      <GlobalAudioController socket={globalSocket} roomState={roomState} />
      
      {/* Pokemon Background Layer */}
      {user?.preferences?.pokemonTheme?.active && user?.preferences?.pokemonTheme?.id && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundImage: `url('/assets/pokemon/${user.preferences.pokemonTheme.id}.jpg')`,
          backgroundColor: user.preferences.pokemonTheme.backgroundColor || '#000000',
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          zIndex: -10,
          pointerEvents: 'none'
        }} />
      )}

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

        {pendingInvite && (
          <div style={{
            position: 'fixed',
            top: globalAnnouncement ? '62px' : '12px',
            right: '12px',
            zIndex: 10001,
            width: 'min(360px, calc(100vw - 24px))',
            background: 'rgba(15, 23, 42, 0.96)',
            color: 'white',
            padding: '16px',
            borderRadius: '14px',
            border: '1px solid rgba(59, 130, 246, 0.35)',
            boxShadow: '0 18px 50px rgba(0,0,0,0.35)'
          }}>
            <div style={{ fontWeight: 700, marginBottom: '6px' }}>Room Invite</div>
            <div style={{ fontSize: '0.92rem', color: 'rgba(255,255,255,0.82)', marginBottom: '14px' }}>
              {pendingInvite.inviterName} invited you to join "{pendingInvite.roomName}".
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => {
                  const invite = pendingInvite;
                  setPendingInvite(null);
                  navigate(`/room/${invite.roomId}`);
                }}
              >
                Join
              </button>
              <button
                className="btn-ghost"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setPendingInvite(null)}
              >
                Dismiss
              </button>
            </div>
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
                  {(user.preferences?.showClock ?? true) && <div className="mobile-hide"><ClockWidget /></div>}
                  {user?.id && (user.preferences?.showKoalaCoins ?? true) && <KoalaCoinWidget balance={user.koala_balance || 0} />}
                      {(deferredFeaturesReady && (user.preferences?.showWeather ?? false)) && (
                    <div className="mobile-hide">
                      <React.Suspense fallback={<WidgetPillSkeleton width={96} />}>
                        <WeatherWidget />
                      </React.Suspense>
                    </div>
                  )}
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
              {(deferredFeaturesReady && (user.preferences?.showWeather ?? false)) && (
                <React.Suspense fallback={<WidgetPillSkeleton width={110} />}>
                  <WeatherWidget />
                </React.Suspense>
              )}
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
            {deferredFeaturesReady && (
              <React.Suspense fallback={<FloatingWidgetSkeleton />}>
                <LiveStreamWidget />
              </React.Suspense>
            )}
          </>
        )}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <main className="main-content" style={{ flex: 1, overflowY: 'auto', padding: isZenMode ? '0' : '2rem', position: 'relative' }}>
            <React.Suspense fallback={<ViewLoader />}>
              <Routes>
                <Route path="/" element={<Home user={user} globalSocket={globalSocket} />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/room/:id" element={<Room user={user} socket={globalSocket} roomState={roomState} roomError={roomError} roomTokens={roomTokens} setActiveRoomId={setActiveRoomId} setActiveToken={setActiveToken} isZenMode={isZenMode} setIsZenMode={setIsZenMode} serverTimeOffset={serverTimeOffset} setIsRightPanelOpen={setIsRightPanelOpen} onLeaveRoom={leaveActiveRoom} />} />
                <Route path="/highscores" element={<Highscores />} />
                <Route path="/esports" element={<Esports selectedLeagues={selectedLeagues} socket={globalSocket} />} />
                <Route path="/koala-dashboard" element={<KoalaDashboard />} />
                <Route path="/achievements" element={<Achievements />} />
                <Route path="/countdowns" element={<Countdowns user={user} />} />
                <Route path="/global-bets" element={<GlobalBets />} />
                <Route path="/settings" element={<Settings user={user} setUser={setUser} socket={globalSocket} />} />
                <Route path="/api-docs" element={<ApiDocs />} />
                <Route path="/extension-info" element={<ExtensionInfo />} />
                <Route path="/admin" element={<Admin socket={globalSocket} />} />
                <Route path="/admin/achievements" element={<AdminAchievements />} />
                <Route path="/features" element={<FeatureRequests />} />
                <Route path="/changelog" element={<Changelog />} />
                <Route path="/games/koalaflap" element={<KoalaFlap user={user} token={token} />} />
                <Route path="/games/leaderboard" element={<GameLeaderboards />} />
                <Route path="/speedcube" element={<SpeedcubeTimer />} />
                <Route path="/leveling" element={<LevelingTracker user={user} token={token} />} />
                <Route path="/scratchcards" element={<Scratchcards />} />
                <Route path="/games/rift-defense" element={<RiftDefense />} />
                <Route path="/games/lol-idle" element={<LoLIdleGame user={user} token={token} />} />
                <Route path="/color-sync" element={<ColorSyncGame user={user} token={token} />} />
                <Route path="/color-sync/lobby/:uuid" element={<ColorSyncGame user={user} token={token} />} />
                <Route path="/profile/:username" element={<UserProfile />} />
                <Route path="/tetris" element={<Tetris />} />
                <Route path="/polymarket-general" element={<PolymarketGeneral />} />
                <Route path="/wordle" element={<Wordle user={user} token={token} />} />
                <Route path="/c" element={<SharedCountdown />} />
                <Route path="*" element={<div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-main)' }}><h2>404 - Seite nicht gefunden</h2><p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Die gesuchte Seite existiert nicht.</p><a href="/" style={{ padding: '0.75rem 1.5rem', background: 'var(--bg-card)', borderRadius: '8px', color: 'var(--text-main)', textDecoration: 'none', border: '1px solid var(--border-color)' }}>Zurück zur Startseite</a></div>} />
              </Routes>
            </React.Suspense>
          </main>
          {(!isZenMode && deferredFeaturesReady && (user.preferences?.showNewsTicker ?? (window.innerWidth > 768))) && (
            <React.Suspense fallback={<div style={{ padding: '0 16px 16px' }}><WidgetPillSkeleton width={220} /></div>}>
              <NewsTicker socket={globalSocket} />
            </React.Suspense>
          )}
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
        <ToastProvider>
          <InnerApp />
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
