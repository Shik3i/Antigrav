import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import EVENTS from './socketEvents';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Room from './pages/Room';
import Highscores from './pages/Highscores';
import Settings from './pages/Settings';
import ApiDocs from './pages/ApiDocs';
import './index.css';

// Global styles for the app container
const appStyle = {
  display: 'flex',
  width: '100%',
  height: '100%',
};

const contentStyle = {
  flex: 1,
  overflowY: 'auto',
  padding: '2rem',
  position: 'relative',
};

// We will instantiate the socket inside App to control its lifecycle

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('timerUser');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure preferences exist (migration for existing users)
      if (!parsed.preferences) {
        parsed.preferences = { timerVisual: 'circle' };
      }
      return parsed;
    }

    // Generate random name
    const verbs = ['Jumping', 'Flying', 'Sneaky', 'Happy', 'Focusing', 'Running', 'Sleeping', 'Dancing', 'Coding', 'Singing'];
    const nouns = ['Panda', 'Koala', 'Tiger', 'Lion', 'Eagle', 'Shark', 'Wolf', 'Bear', 'Fox', 'Owl'];
    const randomVerb = verbs[Math.floor(Math.random() * verbs.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];

    return {
      id: 'user_' + Math.random().toString(36).substr(2, 9),
      displayName: `${randomVerb} ${randomNoun}`,
      preferences: { timerVisual: 'circle' }
    };
  });

  const [activeRoomId, setActiveRoomId] = useState(null);
  const [activeToken, setActiveToken] = useState(null);
  const [roomState, setRoomState] = useState(null);
  const [roomError, setRoomError] = useState(null);
  const [roomTokens, setRoomTokens] = useState({ readToken: null, writeToken: null });
  const [globalSocket, setGlobalSocket] = useState(null);
  const [isZenMode, setIsZenMode] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newSocket = io('/', { autoConnect: true });
    setGlobalSocket(newSocket);
    newSocket.on(EVENTS.CONNECT, () => {
      console.log('[App] globalSocket connected! ID:', newSocket.id);
      setIsConnected(true);
    });
    newSocket.on(EVENTS.DISCONNECT, () => setIsConnected(false));
    return () => newSocket.disconnect();
  }, []);

  useEffect(() => {
    localStorage.setItem('timerUser', JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    if (!activeRoomId || !user || !globalSocket) return;

    // Ensure socket is connected before emitting
    const join = () => {
      console.log('[App] Joining room:', activeRoomId, 'with user:', user.displayName, 'token:', activeToken);
      setRoomError(null);
      globalSocket.emit(EVENTS.JOIN_ROOM, {
        roomId: activeRoomId,
        userId: user.id,
        displayName: user.displayName,
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
      console.log('[App] Received sync_state:', state);
      setRoomState(state);

      // Auto-fetch tokens if we are a writer
      const myUser = state.users.find(u => u.userId === user.id);
      if (myUser && myUser.role === 'write' && globalSocket) {
        globalSocket.emit(EVENTS.GET_INVITE_TOKENS, { roomId: state.id });
      }
    };
    const handleError = (msg) => {
      console.error('[App] Received room error:', msg);
      setRoomError(msg);
    };
    const handleTokens = (data) => setRoomTokens(data);

    globalSocket.on(EVENTS.SYNC_STATE, handleSync);
    globalSocket.on(EVENTS.ERROR, handleError);
    globalSocket.on(EVENTS.INVITE_TOKENS, handleTokens);

    return () => {
      console.log('[App] Leaving room cleanup for:', activeRoomId);
      globalSocket.off(EVENTS.CONNECT, handleConnect);
      globalSocket.off(EVENTS.SYNC_STATE, handleSync);
      globalSocket.off(EVENTS.ERROR, handleError);
      globalSocket.off(EVENTS.INVITE_TOKENS, handleTokens);
      // Removed globalSocket.emit('leave_room'); from here because React StrictMode triggers Mount -> Unmount -> Mount instantly, 
      // causing us to leave the room right after joining.
    };
  }, [activeRoomId, activeToken, user.id, user.displayName]);

  if (!globalSocket) return null;

  return (
    <Router>
      <div style={appStyle}>
        {!isConnected && (
          <div style={{
            position: 'fixed',
            top: 0,
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
        {!isZenMode && <Sidebar user={user} roomState={roomState} socket={globalSocket} activeToken={activeToken} />}
        <main className="main-content" style={{ ...contentStyle, padding: isZenMode ? '0' : '2rem' }}>
          <Routes>
            <Route path="/" element={<Home user={user} globalSocket={globalSocket} />} />
            <Route path="/room/:id" element={<Room user={user} socket={globalSocket} roomState={roomState} roomError={roomError} roomTokens={roomTokens} setActiveRoomId={setActiveRoomId} setActiveToken={setActiveToken} isZenMode={isZenMode} setIsZenMode={setIsZenMode} />} />
            <Route path="/highscores" element={<Highscores />} />
            <Route path="/settings" element={<Settings user={user} setUser={setUser} />} />
            <Route path="/api-docs" element={<ApiDocs />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
