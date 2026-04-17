import React, { useEffect, useState, useRef } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { Clock, Users, Trophy, Settings, LayoutDashboard, Play, Pause, Maximize2, LogIn, LogOut, BarChart3, Timer, TrendingUp, Target, ChevronDown, ChevronRight, ListTodo, Palette, Lightbulb, Gamepad2, History, Grid3X3, Shield } from 'lucide-react';
import EVENTS from '../../socketEvents.json';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import { fetchJson } from '../utils/apiClient';
import { prefetchRoute } from '../utils/prefetchRoutes';

const SharedTodo = React.lazy(() => import('./SharedTodo'));
const SharedCanvas = React.lazy(() => import('./SharedCanvas'));

const Sidebar = ({ user, roomState, socket, activeToken, isOpen, onClose }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { isGuest, logout } = useAuth();
    const isRoomRoute = location.pathname.startsWith('/room/');
    const [openGroup, setOpenGroup] = useState(() => {
        try {
            const saved = localStorage.getItem('sidebar_open_group');
            if (saved) {
                // If it looks like legacy JSON (object or array), ignore it
                if (saved.startsWith('{') || saved.startsWith('[')) {
                    return null;
                }
                return saved;
            }
        } catch (e) { }
        return null;
    });

    useEffect(() => {
        if (openGroup) localStorage.setItem('sidebar_open_group', openGroup);
        else localStorage.removeItem('sidebar_open_group');
    }, [openGroup]);

    const containerStyle = {
        width: '260px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 16px',
        gap: '32px',
        overflowY: 'auto'
    };

    const navStyle = {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    };

    const UserInfoStyle = {
        marginTop: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
    };

    const AvatarStyle = {
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        background: 'var(--accent-gradient)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        color: '#fff',
    };

    // Mini timer logic
    const [localRemainingMs, setLocalRemainingMs] = useState(0);
    const animationRef = useRef(null);

    useEffect(() => {
        if (!roomState) return;
        setLocalRemainingMs(roomState.state.remainingMs);
    }, [roomState?.state.remainingMs, roomState?.config.durationMs]);

    useEffect(() => {
        if (!roomState) return;
        if (roomState.state.isRunning) {
            let lastTime = performance.now();
            const updateTimer = (currentTime) => {
                const delta = currentTime - lastTime;
                lastTime = currentTime;
                setLocalRemainingMs(prev => prev > delta ? prev - delta : 0);
                animationRef.current = requestAnimationFrame(updateTimer);
            };
            animationRef.current = requestAnimationFrame(updateTimer);
        } else {
            setLocalRemainingMs(roomState.state.remainingMs);
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        }
        return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
    }, [roomState?.state.isRunning, roomState?.state.remainingMs]);

    const formatTime = (ms) => {
        const totalSeconds = Math.ceil(ms / 1000);
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleAction = (e, action) => {
        e.stopPropagation();
        if (roomState) {
            socket.emit(EVENTS.TIMER_ACTION, { roomId: roomState.id, action });
        }
    };

    const myUser = roomState?.users?.find(u => u.userId === user.id);
    const isWrite = myUser?.role === 'write';

    const [navSettings, setNavSettings] = useState([]);
    const [loadingNav, setLoadingNav] = useState(true);

    // --- Tägliche Badges (Pure LocalStorage Logik) ---
    const [lastVisits, setLastVisits] = useState({});
    
    useEffect(() => {
        const fetchNav = async () => {
            try {
                const data = await fetchJson('/api/navbar-settings', { token: '' });
                setNavSettings(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('Failed to fetch navbar settings:', err);
            } finally {
                setLoadingNav(false);
            }
        };
        fetchNav();
    }, []);

    useEffect(() => {
        const visits = {};
        navSettings.forEach(item => {
            if (item.has_daily_badge) {
                const val = localStorage.getItem(`last_visit_${item.key}`);
                if (val) visits[item.key] = parseInt(val);
            }
        });
        setLastVisits(visits);
    }, [navSettings]);

    const markAsVisited = (key) => {
        const now = Date.now();
        localStorage.setItem(`last_visit_${key}`, now.toString());
        setLastVisits(prev => ({ ...prev, [key]: now }));
    };

    const isBadgeVisible = (key) => {
        const item = navSettings.find(n => n.key === key);
        if (!item || !item.has_daily_badge) return false;
        
        const startOfToday = new Date();
        startOfToday.setUTCHours(0, 0, 0, 0);
        const lastVisit = lastVisits[key];
        
        return !lastVisit || lastVisit < startOfToday.getTime();
    };

    const iconMap = {
        'dashboard': <LayoutDashboard size={18} />,
        'countdowns': <Timer size={18} />,
        'speedcube': <Grid3X3 size={18} />,
        'statistics': <BarChart3 size={18} />,
        'esports': <Trophy size={18} color="#3b82f6" />,
        'esports-bets': <Target size={18} color="#f59e0b" />,
        'polymarket-general': <TrendingUp size={18} color="#3b82f6" />,
        'financial-dashboard': <TrendingUp size={18} color="#10b981" />,
        'achievements': <Trophy size={18} color="#facc15" />,
        'koala-flap': <Gamepad2 size={18} color="#ec4899" />,
        'scratch-cards': <Grid3X3 size={18} color="#fbbf24" />,
        'rift-defense': <Shield size={18} color="#10b981" />,
        'lol-idle': <Trophy size={18} color="#6366f1" />,
        'colorsync': <Palette size={18} color="var(--accent-primary)" />,
        'game-leaderboards': <Trophy size={18} color="#f59e0b" />,
        'settings': <Settings size={18} />,
        'roadmap': <Lightbulb size={18} color="#fbbf24" />,
        'changelog': <History size={18} color="#94a3b8" />,
        'admin': <Shield size={18} color="var(--accent-primary)" />,
        'tetris': <Gamepad2 size={18} color="#ec4899" />,
        'wordle': <Maximize2 size={18} color="#10b981" />,
    };

    const categories = ['Timers', 'Esports', 'Games', 'System'];
    const groupedNav = navSettings.reduce((acc, curr) => {
        if (!acc[curr.category]) acc[curr.category] = [];
        acc[curr.category].push(curr);
        return acc;
    }, {});

    return (
        <aside className={`glass-panel sidebar-drawer ${isOpen ? 'open' : ''}`} style={containerStyle}>
            <Link to="/" onClick={onClose} style={{ padding: '0 8px', display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: 'inherit' }}>
                <Clock className="animate-glow" color="var(--accent-primary)" size={28} />
                <h2 style={{ fontSize: '1.25rem', margin: 0, background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    KoalaSync
                </h2>
            </Link>

            <nav style={navStyle}>
                {categories.map((cat) => {
                    const items = groupedNav[cat] || [];
                    const sectionKey = cat.toLowerCase();
                    if (items.length === 0) return null;

                    const hasBadge = items.some(item => isBadgeVisible(item.key));

                    return (
                        <div key={cat} className="nav-section" style={{ marginTop: cat === 'Timers' ? '0' : '12px' }}>
                            <button 
                                className="btn-ghost section-header" 
                                onClick={() => setOpenGroup(p => p === sectionKey ? null : sectionKey)}
                                style={{ 
                                    width: '100%', 
                                    justifyContent: 'space-between', 
                                    opacity: 0.7, 
                                    fontSize: '0.75rem', 
                                    fontWeight: 700, 
                                    letterSpacing: '0.05em', 
                                    textTransform: 'uppercase', 
                                    marginBottom: '4px',
                                    position: 'relative'
                                }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {cat}
                                    {hasBadge && (
                                        <span style={{
                                            width: '6px',
                                            height: '6px',
                                            background: '#ef4444',
                                            borderRadius: '50%',
                                            boxShadow: '0 0 6px rgba(239, 68, 68, 0.4)'
                                        }}></span>
                                    )}
                                </span>
                                {openGroup === sectionKey ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            {openGroup === sectionKey && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '8px' }}>
                                    {items.map(item => {
                                        // Safety check: only superadmins can see the Admin Panel link
                                        if (item.key === 'admin' && !user?.is_superadmin) return null;
                                        
                                        const showBadge = isBadgeVisible(item.key);

                                        return (
                                            <NavLink 
                                                key={item.key} 
                                                to={item.path} 
                                                onMouseEnter={() => prefetchRoute(item.path)}
                                                onFocus={() => prefetchRoute(item.path)}
                                                onClick={() => {
                                                    markAsVisited(item.key);
                                                    onClose();
                                                }} 
                                                className={({ isActive }) => `btn-ghost ${isActive ? 'active' : ''}`} 
                                                style={{ justifyContent: 'flex-start', position: 'relative' }}
                                            >
                                                {iconMap[item.key] || <ListTodo size={18} />}
                                                {item.label}
                                                {showBadge && (
                                                    <span style={{
                                                        position: 'absolute',
                                                        right: '8px',
                                                        top: '50%',
                                                        transform: 'translateY(-50%)',
                                                        width: '8px',
                                                        height: '8px',
                                                        background: '#ef4444',
                                                        borderRadius: '50%',
                                                        boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)'
                                                    }}></span>
                                                )}
                                            </NavLink>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </nav>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', paddingRight: '4px', marginTop: '16px' }}>
                {roomState && isRoomRoute && (
                    <>
                        <div style={{ flex: 1, minHeight: '200px' }}>
                            <React.Suspense fallback={null}>
                                <SharedTodo roomState={roomState} socket={socket} />
                            </React.Suspense>
                        </div>
                        <div style={{ flex: 1, minHeight: '200px' }}>
                            <React.Suspense fallback={null}>
                                <SharedCanvas roomState={roomState} socket={socket} />
                            </React.Suspense>
                        </div>
                    </>
                )}
            </div>

            {roomState && !isRoomRoute && (
                <div
                    className="glass-panel"
                    style={{ padding: '16px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', cursor: 'pointer', marginBottom: '16px' }}
                    onMouseEnter={() => prefetchRoute('/c')}
                    onClick={() => navigate(`/room/${roomState.id}${activeToken ? `?token=${activeToken}` : ''}`)}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-primary)' }}>Active Session</span>
                        <Maximize2 size={14} color="var(--text-muted)" />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: '"Outfit", sans-serif', textAlign: 'center', marginBottom: '8px' }}>
                        {formatTime(localRemainingMs)}
                    </div>
                    {user.preferences?.timerVisual === 'bar' && (
                        <div style={{ height: '4px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', marginBottom: '12px' }}>
                            <div style={{
                                height: '100%',
                                width: `${(localRemainingMs / (roomState.config.durationMs || 1)) * 100}%`,
                                background: 'var(--accent-primary)',
                                transition: roomState.state.isRunning ? 'none' : 'width 0.3s ease'
                            }}></div>
                        </div>
                    )}
                    {isWrite && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {!roomState.state.isRunning ? (
                                <button className="btn-primary" style={{ flex: 1, padding: '8px', fontSize: '0.8rem', borderRadius: '8px' }} onClick={(e) => handleAction(e, 'START')}>
                                    <Play size={14} /> Start
                                </button>
                            ) : (
                                <button className="btn-primary" style={{ flex: 1, padding: '8px', fontSize: '0.8rem', borderRadius: '8px', background: 'rgba(255,255,255,0.1)' }} onClick={(e) => handleAction(e, 'PAUSE')}>
                                    <Pause size={14} /> Pause
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {isGuest ? (
                <div style={{ ...UserInfoStyle, marginTop: 0, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                        <Avatar user={user} size={36} />
                        <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.displayName} (Guest)</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Progress not saved</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <Link to="/login" onClick={onClose} className="btn-primary" style={{ flex: 1, padding: '6px', fontSize: '0.8rem', textAlign: 'center', borderRadius: '6px' }}><LogIn size={14} style={{ marginRight: '4px', display: 'inline-block', verticalAlign: 'middle' }} /> Login</Link>
                    </div>
                </div>
            ) : (
                <div style={{ ...UserInfoStyle, marginTop: 0, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <NavLink to="/settings" onClick={onClose} className="user-profile-link" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
                        <Avatar user={user} size={36} />
                        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                {user.displayName}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Logged In</span>
                        </div>
                    </NavLink>
                    <button onClick={() => { logout(); navigate('/'); }} className="btn-ghost" style={{ padding: '6px', fontSize: '0.8rem', borderRadius: '6px', background: 'rgba(255,0,0,0.1)', color: '#ef4444' }}>
                        <LogOut size={14} style={{ marginRight: '4px', display: 'inline-block', verticalAlign: 'middle' }} /> Logout
                    </button>
                </div>
            )}
        </aside>
    );
};

export default Sidebar;
