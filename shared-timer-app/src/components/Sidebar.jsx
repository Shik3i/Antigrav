import React, { useEffect, useState, useRef, useMemo } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
import EVENTS from '../../socketEvents.json';
import { useAuth } from '../context/AuthContext';
import { usePersistentData } from '../context/PersistentDataContext';
import Avatar from './Avatar';
import { fetchJson } from '../utils/apiClient';
import { prefetchRoute } from '../utils/prefetchRoutes';

const SharedTodo = React.lazy(() => import('./SharedTodo'));
const SharedCanvas = React.lazy(() => import('./SharedCanvas'));

const iconMap = {
    'dashboard': <LucideIcons.LayoutDashboard size={18} />,
    'countdowns': <LucideIcons.Timer size={18} />,
    'speedcube': <LucideIcons.Grid3X3 size={18} />,
    'statistics': <LucideIcons.BarChart3 size={18} />,
    'esports': <LucideIcons.Trophy size={18} color="#3b82f6" />,
    'esports-bets': <LucideIcons.Target size={18} color="#f59e0b" />,
    'polymarket-general': <LucideIcons.TrendingUp size={18} color="#3b82f6" />,
    'financial-dashboard': <LucideIcons.TrendingUp size={18} color="#10b981" />,
    'achievements': <LucideIcons.Trophy size={18} color="#facc15" />,
    'koala-flap': <LucideIcons.Gamepad2 size={18} color="#ec4899" />,
    'scratch-cards': <LucideIcons.Grid3X3 size={18} color="#fbbf24" />,
    'rift-defense': <LucideIcons.Shield size={18} color="#10b981" />,
    'lol-idle': <LucideIcons.Trophy size={18} color="#6366f1" />,
    'colorsync': <LucideIcons.Palette size={18} color="var(--accent-primary)" />,
    'game-leaderboards': <LucideIcons.Trophy size={18} color="#f59e0b" />,
    'tower-climb': <LucideIcons.Shield size={18} color="#3b82f6" />,
    'blackjack': <LucideIcons.Crown size={18} color="#f59e0b" />,
    'settings': <LucideIcons.Settings size={18} />,
    'roadmap': <LucideIcons.Lightbulb size={18} color="#fbbf24" />,
    'changelog': <LucideIcons.History size={18} color="#94a3b8" />,
    'admin': <LucideIcons.Shield size={18} color="var(--accent-primary)" />,
    'tetris': <LucideIcons.Gamepad2 size={18} color="#ec4899" />,
    'wordle': <LucideIcons.Maximize2 size={18} color="#10b981" />,
    'news': <LucideIcons.Rss size={18} color="var(--accent-primary)" />,
};

const CATEGORIES = ['Timers', 'Esports', 'Games', 'Social', 'Tools', 'System'];

const Sidebar = ({ user, roomState, socket, activeToken, isOpen, onClose }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { isGuest, logout } = useAuth();
    const isRoomRoute = location.pathname.startsWith('/room/');
    const [openGroup, setOpenGroup] = useState(() => {
        try {
            const saved = localStorage.getItem('sidebar_open_group');
            if (saved) {
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

    // Mini timer logic
    const [localRemainingMs, setLocalRemainingMs] = useState(0);
    const animationRef = useRef(null);

    useEffect(() => {
        if (!roomState?.state) return;
        setLocalRemainingMs(roomState.state.remainingMs || 0);
    }, [roomState?.state?.remainingMs, roomState?.config?.durationMs]);

    useEffect(() => {
        if (!roomState?.state) return;
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
            setLocalRemainingMs(roomState.state.remainingMs || 0);
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        }
        return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
    }, [roomState?.state?.isRunning, roomState?.state?.remainingMs]);

    const formatTime = (ms) => {
        const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleAction = (e, action) => {
        e.stopPropagation();
        const socketInstance = socket;
        if (roomState?.id && socketInstance?.connected) {
            socketInstance.emit(EVENTS.TIMER_ACTION, { roomId: roomState.id, action });
        }
    };

    const myUser = roomState?.users?.find(u => u.userId === user?.id);
    const isWrite = myUser?.role === 'write';

    const { navbarSettings: navSettings, navbarLoaded, loadNavbarSettings } = usePersistentData();

    const [lastVisits, setLastVisits] = useState({});

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

    // Memoized Visibility Map for Badges
    const badgeVisibilityMap = useMemo(() => {
        const startOfToday = new Date();
        startOfToday.setUTCHours(0, 0, 0, 0);
        const todayThreshold = startOfToday.getTime();

        const visibilityMap = new Map();
        navSettings.forEach(item => {
            if (item.has_daily_badge) {
                const lastVisit = lastVisits[item.key];
                visibilityMap.set(item.key, !lastVisit || lastVisit < todayThreshold);
            } else {
                visibilityMap.set(item.key, false);
            }
        });
        return visibilityMap;
    }, [navSettings, lastVisits]);

    const isBadgeVisible = (key) => badgeVisibilityMap.get(key) || false;

    const groupedNav = useMemo(() => {
        return navSettings.reduce((acc, curr) => {
            if (!acc[curr.category]) acc[curr.category] = [];
            acc[curr.category].push(curr);
            return acc;
        }, {});
    }, [navSettings]);

    return (
        <aside className={`glass-panel sidebar-drawer ${isOpen ? 'open' : ''}`} style={containerStyle}>
            <Link to="/" onClick={onClose} style={{ padding: '0 8px', display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: 'inherit' }}>
                <LucideIcons.Clock className="animate-glow" color="var(--accent-primary)" size={28} />
                <h2 style={{ fontSize: '1.25rem', margin: 0, background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    KoalaSync
                </h2>
            </Link>

            <nav style={navStyle}>
                {CATEGORIES.map((cat) => {
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
                                        }} title="Neuigkeiten verfuegbar"></span>
                                    )}
                                </span>
                                {openGroup === sectionKey ? <LucideIcons.ChevronDown size={14} /> : <LucideIcons.ChevronRight size={14} />}
                            </button>
                            {openGroup === sectionKey && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '8px' }}>
                                    {items.map(item => {
                                        if (item.key === 'admin' && !user?.is_superadmin) return null;
                                        const showBadge = isBadgeVisible(item.key);
                                        
                                        let icon = iconMap[item.key];
                                        if (!icon && item.icon) {
                                            const IconComponent = LucideIcons[item.icon];
                                            if (IconComponent) {
                                                icon = <IconComponent size={18} />;
                                            }
                                        }
                                        if (!icon) {
                                            icon = <LucideIcons.ListTodo size={18} />;
                                        }

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
                                                {icon}
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

            {roomState?.state && !isRoomRoute && (
                <div
                    className="glass-panel"
                    style={{ padding: '16px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', cursor: 'pointer', marginBottom: '16px' }}
                    onMouseEnter={() => prefetchRoute('/c')}
                    onClick={() => navigate(`/room/${roomState.id}${activeToken ? `?token=${activeToken}` : ''}`)}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-primary)' }}>Active Session</span>
                        <LucideIcons.Maximize2 size={14} color="var(--text-muted)" />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: '"Outfit", sans-serif', textAlign: 'center', marginBottom: '8px' }}>
                        {formatTime(localRemainingMs)}
                    </div>
                    {user?.preferences?.timerVisual === 'bar' && (
                        <div style={{ height: '4px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', marginBottom: '12px' }}>
                            <div style={{
                                height: '100%',
                                width: `${(localRemainingMs / (roomState.config?.durationMs || 1)) * 100}%`,
                                background: 'var(--accent-primary)',
                                transition: roomState.state.isRunning ? 'none' : 'width 0.3s ease'
                            }}></div>
                        </div>
                    )}
                    {isWrite && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {!roomState.state.isRunning ? (
                                <button className="btn-primary" style={{ flex: 1, padding: '8px', fontSize: '0.8rem', borderRadius: '8px' }} onClick={(e) => handleAction(e, 'START')}>
                                    <LucideIcons.Play size={14} /> Start
                                </button>
                            ) : (
                                <button className="btn-primary" style={{ flex: 1, padding: '8px', fontSize: '0.8rem', borderRadius: '8px', background: 'rgba(255,0,0,0.1)' }} onClick={(e) => handleAction(e, 'PAUSE')}>
                                    <LucideIcons.Pause size={14} /> Pause
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
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.displayName} (Guest)</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Progress not saved</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <Link to="/login" onClick={onClose} className="btn-primary" style={{ flex: 1, padding: '6px', fontSize: '0.8rem', textAlign: 'center', borderRadius: '6px' }}><LucideIcons.LogIn size={14} style={{ marginRight: '4px', display: 'inline-block', verticalAlign: 'middle' }} /> Login</Link>
                    </div>
                </div>
            ) : (
                <div style={{ ...UserInfoStyle, marginTop: 0, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <NavLink to="/settings" onClick={onClose} className="user-profile-link" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
                        <Avatar user={user} size={36} />
                        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                {user?.displayName}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Logged In</span>
                        </div>
                    </NavLink>
                    <button onClick={() => { logout(); navigate('/'); }} className="btn-ghost" style={{ padding: '6px', fontSize: '0.8rem', borderRadius: '6px', background: 'rgba(255,0,0,0.1)', color: '#ef4444' }}>
                        <LucideIcons.LogOut size={14} style={{ marginRight: '4px', display: 'inline-block', verticalAlign: 'middle' }} /> Logout
                    </button>
                </div>
            )}

            {/* Legal Links */}
            <div className="mt-4 flex flex-col gap-1 text-xs text-gray-500 text-center pb-2">
                <Link to="/impressum" onClick={onClose} className="hover:text-gray-300 transition-colors">Impressum</Link>
                <Link to="/datenschutz" onClick={onClose} className="hover:text-gray-300 transition-colors">Datenschutz</Link>
            </div>
        </aside>
    );
};

export default Sidebar;
