import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Home from './pages/Home';
import Login from './pages/Login';

import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import Menu from 'lucide-react/dist/esm/icons/menu.js';
import Clock from 'lucide-react/dist/esm/icons/clock.js';

// Socket Events
import EVENTS from '../socketEvents.json';

// Styling
import './index.css';

// Context & Auth
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { ChipSkinProvider } from './features/casino/ChipSkinContext';
import { PersistentDataProvider } from './context/PersistentDataContext';
import { NewsProvider } from './context/NewsContext';
import ToastContainer from './components/ToastContainer';

// Hooks
import useMediaQuery from './hooks/useMediaQuery';
import { usePageVisibility } from './hooks/usePageVisibility';
import useEsportsNotifications from './hooks/useEsportsNotifications';

// Static Components (Always needed or part of early layout)
import Sidebar from './components/Sidebar';
import RouteErrorBoundary from './components/ErrorBoundary';
import MaintenanceGuard from './components/MaintenanceGuard';
import ClockWidget from './components/ClockWidget';
import KoalaCoinWidget from './components/KoalaCoinWidget';
import GlobalAudioController from './components/GlobalAudioController';
import { FloatingWidgetSkeleton, RouteSkeleton, WidgetPillSkeleton, ViewLoader } from './components/LoadingSkeletons';

// Utilities
import { getNextPokemon } from './utils/pokemonUtils';
import { fetchJson } from './utils/apiClient';
import { AUTH_SESSION_INVALIDATED_EVENT, getStoredValue, setStoredValue } from './utils/clientStorage';
import { scheduleDeferred } from './utils/deferred';
import {
  getExactRemainingMs,
  formatTimerTitle,
  isStaleTimerSnapshot
} from './features/timer/timerSelectors';
import { DEFAULT_LEAGUES, DEFAULT_TITLE, EMPTY_ROOM_TOKENS } from './constants/appConstants';


// Lazy load pages for code splitting

const Room = React.lazy(() => import('./pages/Room'));
const Settings = React.lazy(() => import('./pages/Settings'));
const Countdowns = React.lazy(() => import('./pages/Countdowns'));

const Register = React.lazy(() => import('./pages/Register'));
const NotFound = React.lazy(() => import('./pages/NotFound'));

// Other Lazy Loaded Pages
const Highscores = React.lazy(() => import('./pages/Highscores'));
const ApiDocs = React.lazy(() => import('./pages/ApiDocs'));
const Esports = React.lazy(() => import('./pages/Esports'));
const KoalaDashboard = React.lazy(() => import('./pages/KoalaDashboard'));
const GlobalBets = React.lazy(() => import('./pages/GlobalBets'));
const Admin = React.lazy(() => import('./pages/Admin'));
const AdminAchievements = React.lazy(() => import('./pages/AdminAchievements'));
const FeatureRequests = React.lazy(() => import('./pages/FeatureRequests'));
const KoalaFlap = React.lazy(() => import('./pages/KoalaFlap'));
const SpeedcubeTimer = React.lazy(() => import('./pages/SpeedcubeTimer'));
const GameLeaderboards = React.lazy(() => import('./pages/GameLeaderboards'));
const Changelog = React.lazy(() => import('./pages/Changelog'));
const UserProfile = React.lazy(() => import('./pages/UserProfile'));
const Achievements = React.lazy(() => import('./pages/Achievements'));
const Scratchcards = React.lazy(() => import('./pages/ScratchcardShop'));
const RiftDefense = React.lazy(() => import('./pages/RiftDefense'));
const LoLIdleGame = React.lazy(() => import('./pages/LoLIdleGame'));
const ColorSyncGame = React.lazy(() => import('./pages/ColorSyncGame'));
const SharedCountdown = React.lazy(() => import('./pages/SharedCountdown'));
const LevelingTracker = React.lazy(() => import('./pages/LevelingTracker'));
const Tetris = React.lazy(() => import('./pages/Tetris'));
const PolymarketGeneral = React.lazy(() => import('./pages/PolymarketGeneral'));
const Wordle = React.lazy(() => import('./pages/Wordle'));
const TowerClimb = React.lazy(() => import('./pages/TowerClimb'));
const Blackjack = React.lazy(() => import('./pages/Blackjack'));
const Roulette = React.lazy(() => import('./pages/Roulette'));
const LottoImitat = React.lazy(() => import('./pages/LottoImitat'));
const NewsTicker = React.lazy(() => import('./components/NewsTicker'));
const WeatherWidget = React.lazy(() => import('./components/WeatherWidget'));
const LiveStreamWidget = React.lazy(() => import('./components/LiveStreamWidget'));
const Friends = React.lazy(() => import('./pages/Friends'));
const News = React.lazy(() => import('./pages/News'));
const Impressum = React.lazy(() => import('./pages/Impressum'));
const Datenschutz = React.lazy(() => import('./pages/Datenschutz'));

// Constants moved to src/constants/appConstants.js


// Global styles for the app container
const appStyle = {
  display: 'flex',
  width: '100%',
  height: '100%',
};

/**
 * Notes: Remaining ms and title formatting moved to src/utils/timerUtils.js
 */


const EsportsNotificationHandler = ({ selectedLeagues, socket, enabled }) => {
  useEsportsNotifications(selectedLeagues, socket, { enabled });
  return null;
};

function InnerApp() {
  const { user, setUser, token } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const isVisible = usePageVisibility();
  const isDesktop = useMediaQuery('(min-width: 769px)');

  // Local sync states
  const [pokemonConfigs, setPokemonConfigs] = useState(null);
  const [activeRoomId, setActiveRoomId] = useState(() => getStoredValue('activeRoomId', null));
  const [activeToken, setActiveToken] = useState(() => getStoredValue('activeToken', null));
  const [roomState, setRoomState] = useState(null);
  const [roomError, setRoomError] = useState(null);
  const [roomTokens, setRoomTokens] = useState(EMPTY_ROOM_TOKENS);
  const [deferredFeaturesReady, setDeferredFeaturesReady] = useState(false);
  const [lastRoomSyncAt, setLastRoomSyncAt] = useState(null);

  // Global Sync Hooks Reference
  const [globalSocket, setGlobalSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [lastPongAt, setLastPongAt] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [globalAnnouncement, setGlobalAnnouncement] = useState('');
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [pendingInvite, setPendingInvite] = useState(null);

  // --- Local Persistence ---
  useEffect(() => {
    setStoredValue('activeRoomId', activeRoomId);
    setStoredValue('activeToken', activeToken);
  }, [activeRoomId, activeToken]);

  
  useEffect(() => {
    if (!token) {
      setActiveRoomId(null);
      setActiveToken(null);
    }
  }, [token]);

  // --- Authentication Alerts ---
  useEffect(() => {
    let lastNoticeAt = 0;
    const handleInvalidSession = (event) => {
      const now = Date.now();
      if (now - lastNoticeAt < 1500) return;
      lastNoticeAt = now;
      showToast(event?.detail?.message || 'Deine Sitzung ist ungueltig. Bitte login.', 'warning', 6500);
    };

    window.addEventListener(AUTH_SESSION_INVALIDATED_EVENT, handleInvalidSession);
    return () => window.removeEventListener(AUTH_SESSION_INVALIDATED_EVENT, handleInvalidSession);
  }, [showToast]);

  const [hasInstance, setHasInstance] = useState(false);

  // --- Socket Initialization ---
  useEffect(() => {
    setHasInstance(false);
    const newSocket = io('/', { transports: ['websocket'], autoConnect: true, auth: { token } });
    setGlobalSocket(newSocket);
    setHasInstance(true);

    const onConnect = () => {
      setIsConnected(true);
      setLastPongAt(Date.now());
    };
    const onDisconnect = () => setIsConnected(false);
    const onAnnouncement = (data) => {
      if (data?.message) {
        setGlobalAnnouncement(data.message);
        showToast(data.message, 'info', 15000);
        setTimeout(() => setGlobalAnnouncement(prev => prev === data.message ? '' : prev), 15000);
      }
    };
    const onCoinUpdate = ({ balance }) => setUser(p => p ? ({ ...p, koala_balance: balance }) : p);

    newSocket.on(EVENTS.CONNECT, onConnect);
    newSocket.on(EVENTS.DISCONNECT, onDisconnect);
    newSocket.on(EVENTS.GLOBAL_ANNOUNCEMENT, onAnnouncement);
    newSocket.on(EVENTS.COIN_BALANCE_UPDATE, onCoinUpdate);

    return () => {
      newSocket.off(EVENTS.CONNECT, onConnect);
      newSocket.off(EVENTS.DISCONNECT, onDisconnect);
      newSocket.off(EVENTS.GLOBAL_ANNOUNCEMENT, onAnnouncement);
      newSocket.off(EVENTS.COIN_BALANCE_UPDATE, onCoinUpdate);
      newSocket.disconnect();
      setGlobalSocket(null);
      setHasInstance(false);
    };
  }, [token, setUser, showToast]);

  // --- Room Join & Synchronization Lifecycle ---
  useEffect(() => {
    const socket = globalSocket;
    if (!activeRoomId || !user?.id || !socket) {
      if (!activeRoomId) { setRoomState(null); setRoomError(null); setRoomTokens(EMPTY_ROOM_TOKENS); setLastRoomSyncAt(null); }
      return undefined;
    }

    const joinRoom = () => {
      setRoomError(null);
      socket.emit(EVENTS.JOIN_ROOM, { roomId: activeRoomId, userId: user.id, displayName: user.displayName, preferences: user.preferences, token: activeToken });
    };

    const handleSync = (state) => {
      setRoomState(current => (isStaleTimerSnapshot(current, state) ? current : state));
      setLastRoomSyncAt(Date.now());
      const myUser = state.users.find(u => u.userId === user.id || u.socketId === socket.id);
      if (myUser?.role === 'write' && socket.connected) {
        socket.emit(EVENTS.GET_INVITE_TOKENS, { roomId: state.id });
      }
    };

    const handleError = (msg) => {
      if (msg.includes('Room not found') && !location.pathname.startsWith('/room/')) {
        setActiveRoomId(null); setActiveToken(null); setRoomState(null); setLastRoomSyncAt(null);
        return;
      }
      setRoomError(msg);
    };

    if (socket.connected) joinRoom();
    socket.on(EVENTS.CONNECT, joinRoom);
    socket.on(EVENTS.SYNC_STATE, handleSync);
    socket.on(EVENTS.ERROR, handleError);
    socket.on(EVENTS.ROOM_INVITE, setPendingInvite);
    socket.on(EVENTS.INVITE_TOKENS, setRoomTokens);

    return () => {
      socket.off(EVENTS.CONNECT, joinRoom);
      socket.off(EVENTS.SYNC_STATE, handleSync);
      socket.off(EVENTS.ERROR, handleError);
      socket.off(EVENTS.ROOM_INVITE, setPendingInvite);
      socket.off(EVENTS.INVITE_TOKENS, setRoomTokens);
    };
  }, [activeRoomId, activeToken, user?.id, isConnected, location.pathname, globalSocket]);

  // --- Invite UX: 30s Auto-Dismiss ---
  useEffect(() => {
    if (!pendingInvite) return undefined;
    const timer = setTimeout(() => setPendingInvite(null), 30000);
    return () => clearTimeout(timer);
  }, [pendingInvite]);

  // --- App Theme & Pokemon Preferences ---
  useEffect(() => {
    const theme = user?.preferences?.theme || 'neon';
    document.documentElement.dataset.theme = theme;
    const pkTheme = user?.preferences?.pokemonTheme;
    if (pkTheme?.active && pkTheme?.id && pokemonConfigs) {
      document.documentElement.dataset.pokemonMode = "true";
      if (parseFloat(pkTheme.threshold) > 0.6) document.documentElement.classList.add('pokemon-light-mode');
      else document.documentElement.classList.remove('pokemon-light-mode');

      const colors = pkTheme.types?.map(t => pokemonConfigs.colors?.[t] || '#333') || ['#3b82f6'];
      document.documentElement.style.setProperty('--accent-primary', colors[0]);
      document.documentElement.style.setProperty('--accent-secondary', colors[1] || colors[0]);
    } else {
      document.documentElement.dataset.pokemonMode = "false";
      document.documentElement.classList.remove('pokemon-light-mode');
    }
  }, [user?.preferences, pokemonConfigs]);

  // --- Pokémon Config Fetch & Latency Reporting ---
  useEffect(() => {
    if (user?.preferences?.pokemonTheme?.active && !pokemonConfigs) {
      fetchJson('/api/pokemon/configs', { token: '' }).then(setPokemonConfigs).catch(e => console.error('Pokemon config failed:', e));
    }
  }, [user?.preferences?.pokemonTheme?.active, pokemonConfigs]);

  useEffect(() => {
    const socket = globalSocket;
    if (!socket || !isConnected) return undefined;
    const handlePong = ({ clientTime, serverTime }) => {
      const now = Date.now();
      const ping = Math.round((now - clientTime) / 2);
      const offset = (serverTime + ping) - now;
      setServerTimeOffset(offset);
      setLastPongAt(now);
      socket.emit(EVENTS.REPORT_METRICS, { ping, offset });
    };
    socket.on(EVENTS.PONG, handlePong);
    const interval = setInterval(() => { if (socket.connected) socket.emit(EVENTS.PING, { clientTime: Date.now() }); }, isVisible ? 5000 : 30000);
    return () => { socket.off(EVENTS.PONG, handlePong); clearInterval(interval); };
  }, [isConnected, isVisible, globalSocket]);

  // --- Tab Title Maintenance ---
  useEffect(() => {
    if (!roomState) { document.title = DEFAULT_TITLE; return undefined; }
    const updateTitle = () => {
      const roomName = roomState.config?.name || roomState.name || DEFAULT_TITLE;
      const t = formatTimerTitle(getExactRemainingMs(roomState, serverTimeOffset));
      document.title = `${t} - ${roomName}`;
    };
    updateTitle();
    const iv = setInterval(updateTitle, 1000);
    return () => clearInterval(iv);
  }, [roomState, serverTimeOffset]);

  // Features Readiness
  useEffect(() => { return scheduleDeferred(() => setDeferredFeaturesReady(true), 1200); }, []);

  const leaveActiveRoom = useCallback(({ navigateTo = '/' } = {}) => {
    const s = globalSocket;
    if (s?.connected && activeRoomId) s.emit(EVENTS.LEAVE_ROOM);
    setActiveRoomId(null); setActiveToken(null); setRoomState(null); setPendingInvite(null); setIsZenMode(false);
    if (navigateTo) navigate(navigateTo);
  }, [activeRoomId, navigate, globalSocket]);

  const selectedLeagues = useMemo(() => user?.preferences?.esportsLeagues || DEFAULT_LEAGUES, [user?.preferences?.esportsLeagues]);
  const esportsEnabled = deferredFeaturesReady && selectedLeagues.length > 0;
  const [isZenMode, setIsZenMode] = useState(false);
  const roomConnectionState = useMemo(() => {
    if (!activeRoomId) {
      return { level: 'idle', label: 'No room connection', detail: 'You are currently not in a room.' };
    }

    if (!isConnected) {
      return { level: 'offline', label: 'Connection lost', detail: 'Socket connection to the server is currently offline.' };
    }

    if (!lastRoomSyncAt) {
      return { level: 'connecting', label: 'Connecting', detail: 'Joining the room and waiting for the first sync.' };
    }

    const now = Date.now();
    const syncAgeMs = now - lastRoomSyncAt;
    const pongAgeMs = lastPongAt ? now - lastPongAt : 0;
    const maxHealthyPongAgeMs = isVisible ? 20000 : 75000;
    if (lastPongAt && pongAgeMs > maxHealthyPongAgeMs) {
      return { level: 'unstable', label: 'Unstable', detail: `No recent socket heartbeat for ${Math.round(pongAgeMs / 1000)}s.` };
    }

    const amIInRoom = roomState?.users?.some(u => u.userId === user?.id || u.id === user?.id || u.socketId === globalSocket?.id);
    if (roomState && !amIInRoom && syncAgeMs > 5000) {
      return { level: 'unstable', label: 'Unstable', detail: 'Room state is active, but this client is missing from the current member list.' };
    }

    return { level: 'connected', label: 'Connected', detail: 'Room socket and live sync are healthy.' };
  }, [activeRoomId, globalSocket?.id, isConnected, isVisible, lastPongAt, lastRoomSyncAt, roomState, user?.id]);

  // --- THE INITIALIZATION GUARD ---
  if (!hasInstance || (!isConnected && !user?.id)) return <ViewLoader />;
  
  const activeSocket = globalSocket;

  return (
    <>
      <ToastContainer />
      <PersistentDataProvider socket={activeSocket}>
        <NewsProvider>
        <EsportsNotificationHandler selectedLeagues={selectedLeagues} socket={activeSocket} enabled={esportsEnabled} />
        <GlobalAudioController socket={activeSocket} roomState={roomState} />

        {user?.preferences?.pokemonTheme?.active && (
          <div style={{ position: 'fixed', inset: 0, backgroundImage: `url('/assets/pokemon/${user?.preferences?.pokemonTheme?.id}.jpg')`, backgroundColor: user?.preferences?.pokemonTheme?.backgroundColor || '#000', backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', zIndex: -10, pointerEvents: 'none' }} />
        )}

        <div className={`app-container ${globalAnnouncement ? 'has-banner' : ''}`} style={appStyle}>
          {globalAnnouncement && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, background: '#ef4444', color: 'white', padding: '12px 24px', textAlign: 'center', fontWeight: 'bold', display: 'flex', boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}>
              <span style={{ flex: 1 }}>{globalAnnouncement}</span>
              <button onClick={() => setGlobalAnnouncement('')} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>
          )}

          {pendingInvite && (
            <div style={{ position: 'fixed', top: globalAnnouncement ? '62px' : '12px', right: '12px', zIndex: 10001, width: 'min(360px, calc(100vw - 24px))', background: 'rgba(15, 23, 42, 0.96)', color: 'white', padding: '16px', borderRadius: '14px', border: '1px solid rgba(59, 130, 246, 0.35)', boxShadow: '0 18px 50px rgba(0,0,0,0.35)' }}>
              <div style={{ fontWeight: 700, marginBottom: '6px' }}>Raumeinladung</div>
              <div style={{ fontSize: '0.92rem', color: 'rgba(255,255,255,0.82)', marginBottom: '14px' }}>{pendingInvite.inviterName} lädt dich ein: "{pendingInvite.roomName}".</div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn-primary" style={{ flex: 1 }} onClick={() => { const inv = pendingInvite; setPendingInvite(null); navigate(`/room/${inv.roomId}`); }}>Beitreten</button>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setPendingInvite(null)}>Schließen</button>
              </div>
            </div>
          )}

          {!isConnected && (
            <div style={{ position: 'fixed', top: globalAnnouncement ? '50px' : '0', left: 0, right: 0, zIndex: 1000, background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', textAlign: 'center', padding: '10px 16px', fontSize: '0.85rem', fontWeight: 600, animation: 'pulse 2s infinite' }}>
              ⚡ Verbindung unterbrochen — wird wiederhergestellt...
            </div>
          )}

          {!isZenMode && (
            <>
              <div className="mobile-header">
                <button className="btn-ghost" onClick={() => setIsMobileMenuOpen(true)}><Menu size={24} color="var(--text-main)" /></button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'center' }}>
                  <Clock className="animate-glow" color="var(--accent-primary)" size={24} /><h2 style={{ fontSize: '1.2rem', margin: 0, background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>KoalaWeb</h2>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {(user?.preferences?.showClock ?? true) && <div className="mobile-hide"><ClockWidget /></div>}
                  {user?.id && (user?.preferences?.showKoalaCoins ?? true) && <KoalaCoinWidget balance={user?.koala_balance || 0} />}
                  {(deferredFeaturesReady && (user?.preferences?.showWeather ?? false)) && <div className="mobile-hide"><React.Suspense fallback={<WidgetPillSkeleton width={96} />}><WeatherWidget /></React.Suspense></div>}
                </div>
              </div>

              <div className="desktop-only" style={{ position: 'absolute', top: '32px', right: isRightPanelOpen ? '352px' : '32px', display: 'flex', gap: '12px', alignItems: 'center', zIndex: 50, transition: 'right 0.4s' }}>
                {(user?.preferences?.showClock ?? true) && <ClockWidget />}
                {user?.id && (user?.preferences?.showKoalaCoins ?? true) && <KoalaCoinWidget balance={user?.koala_balance || 0} />}
                {(deferredFeaturesReady && (user?.preferences?.showWeather ?? false)) && <React.Suspense fallback={<WidgetPillSkeleton width={110} />}><WeatherWidget /></React.Suspense>}
                <div id="desktop-room-actions"></div>
              </div>

              <div className={`sidebar-overlay ${isMobileMenuOpen ? 'open' : ''}`} onClick={() => setIsMobileMenuOpen(false)} />
              <Sidebar user={user} roomState={roomState} socket={activeSocket} activeToken={activeToken} isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
              {deferredFeaturesReady && <React.Suspense fallback={<FloatingWidgetSkeleton />}><LiveStreamWidget /></React.Suspense>}
            </>
          )}

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <main className="main-content" style={{ flex: 1, overflowY: 'auto', padding: isZenMode ? '0' : '2rem', position: 'relative' }}>
              <React.Suspense fallback={<ViewLoader />}>
                <RouteErrorBoundary>
                  <MaintenanceGuard>
                    <Routes>
                      <Route path="/" element={<Home user={user} globalSocket={activeSocket} />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/register" element={<Register />} />
                      <Route path="/room/:id" element={<Room user={user} socket={activeSocket} roomState={roomState} roomError={roomError} roomTokens={roomTokens} setActiveRoomId={setActiveRoomId} setActiveToken={setActiveToken} isZenMode={isZenMode} setIsZenMode={setIsZenMode} serverTimeOffset={serverTimeOffset} setIsRightPanelOpen={setIsRightPanelOpen} onLeaveRoom={leaveActiveRoom} roomConnectionState={roomConnectionState} />} />
                      <Route path="/esports" element={<Esports selectedLeagues={selectedLeagues} socket={activeSocket} />} />
                      <Route path="/settings" element={<Settings user={user} setUser={setUser} socket={activeSocket} />} />
                      <Route path="/admin" element={<Admin socket={activeSocket} />} />
                      
                      {/* Sub-pages and secondary routes */}
                      <Route path="/highscores" element={<Highscores />} />
                      <Route path="/koala-dashboard" element={<KoalaDashboard />} />
                      <Route path="/achievements" element={<Achievements />} />
                      <Route path="/countdowns" element={<Countdowns user={user} />} />
                      <Route path="/global-bets" element={<GlobalBets />} />
                      <Route path="/api-docs" element={<ApiDocs />} />
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
                      <Route path="/profile/:username" element={<UserProfile />} />
                      <Route path="/tetris" element={<Tetris />} />
                      <Route path="/polymarket-general" element={<PolymarketGeneral />} />
                      <Route path="/wordle" element={<Wordle user={user} token={token} />} />
                      <Route path="/games/tower-climb" element={<TowerClimb />} />
                      <Route path="/games/blackjack" element={<Blackjack socket={activeSocket} />} />
                      <Route path="/games/roulette" element={<Roulette socket={activeSocket} />} />
                      <Route path="/lotto" element={<LottoImitat />} />
                      <Route path="/news" element={<News socket={activeSocket} />} />
                      <Route path="/friends" element={<Friends />} />
                      <Route path="/c" element={<SharedCountdown />} />
                      <Route path="/impressum" element={<Impressum />} />
                      <Route path="/datenschutz" element={<Datenschutz />} />
                      <Route path="*" element={<ProtectedNotFound />} />
                    </Routes>
                  </MaintenanceGuard>
                </RouteErrorBoundary>
              </React.Suspense>
            </main>
            {(!isZenMode && deferredFeaturesReady && (user?.preferences?.showNewsTicker ?? isDesktop)) && (
              <RouteErrorBoundary>
                <React.Suspense fallback={<div style={{ padding: '0 16px 16px' }}><WidgetPillSkeleton width={220} /></div>}>
                  <NewsTicker socket={activeSocket} />
                </React.Suspense>
              </RouteErrorBoundary>
            )}
          </div>
        </div>
      </NewsProvider>
      </PersistentDataProvider>
    </>
  );
}

const ProtectedNotFound = () => (
  <RouteErrorBoundary>
    <NotFound />
  </RouteErrorBoundary>
);

function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <ChipSkinProvider>
            <InnerApp />
          </ChipSkinProvider>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
