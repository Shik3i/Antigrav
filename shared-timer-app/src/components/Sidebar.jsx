import React, { useEffect, useState, useRef } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { Clock, Users, Trophy, Settings, LayoutDashboard, Play, Pause, Maximize2, LogIn, LogOut, BarChart3, Timer, TrendingUp, Target, ChevronDown, ChevronRight, ListTodo, Palette, Lightbulb, Gamepad2, History } from 'lucide-react';
import EVENTS from '../socketEvents';
import { useAuth } from '../context/AuthContext';
import SharedTodo from './SharedTodo';
import SharedCanvas from './SharedCanvas';
import Avatar from './Avatar';

const Sidebar = ({ user, roomState, socket, activeToken, isOpen, onClose }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { isGuest, logout } = useAuth();
    const isRoomRoute = location.pathname.startsWith('/room/');
    const [expandedSections, setExpandedSections] = useState({
        timers: true,
        esports: true,
        games: true,
        tools: false
    });

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

    useEffect(() => {
        if (!roomState) {
            document.title = 'KoalaSync';
            return;
        }
        const timeStr = formatTime(localRemainingMs);
        document.title = `${timeStr} - ${roomState.name || 'KoalaSync'}`;
    }, [localRemainingMs, roomState]);

    const handleAction = (e, action) => {
        e.stopPropagation();
        if (roomState) {
            socket.emit(EVENTS.TIMER_ACTION, { roomId: roomState.id, action });
        }
    };

    const myUser = roomState?.users?.find(u => u.userId === user.id);
    const isWrite = myUser?.role === 'write';

    return (
        <aside className={`glass-panel sidebar-drawer ${isOpen ? 'open' : ''}`} style={containerStyle}>
            <Link to="/" onClick={onClose} style={{ padding: '0 8px', display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: 'inherit' }}>
                <Clock className="animate-glow" color="var(--accent-primary)" size={28} />
                <h2 style={{ fontSize: '1.25rem', margin: 0, background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    KoalaSync
                </h2>
            </Link>

            <nav style={navStyle}>
                {/* --- Timers Section --- */}
                <div className="nav-section">
                    <button 
                        className="btn-ghost section-header" 
                        onClick={() => setExpandedSections(p => ({ ...p, timers: !p.timers }))}
                        style={{ width: '100%', justifyContent: 'space-between', opacity: 0.7, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '4px' }}
                    >
                        <span>Timers & Countdowns</span>
                        {expandedSections.timers ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    {expandedSections.timers && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '8px' }}>
                            <NavLink to="/" onClick={onClose} className={({ isActive }) => `btn-ghost ${isActive ? 'active' : ''}`} style={{ justifyContent: 'flex-start' }}>
                                <LayoutDashboard size={18} />
                                Sync Timers
                            </NavLink>
                            <NavLink to="/countdowns" onClick={onClose} className={({ isActive }) => `btn-ghost ${isActive ? 'active' : ''}`} style={{ justifyContent: 'flex-start' }}>
                                <Timer size={18} />
                                Countdowns
                            </NavLink>
                            <NavLink to="/highscores" onClick={onClose} className={({ isActive }) => `btn-ghost ${isActive ? 'active' : ''}`} style={{ justifyContent: 'flex-start' }}>
                                <BarChart3 size={18} />
                                Statistics
                            </NavLink>
                        </div>
                    )}
                </div>

                {/* --- Esports Section --- */}
                <div className="nav-section" style={{ marginTop: '12px' }}>
                    <button 
                        className="btn-ghost section-header" 
                        onClick={() => setExpandedSections(p => ({ ...p, esports: !p.esports }))}
                        style={{ width: '100%', justifyContent: 'space-between', opacity: 0.7, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '4px' }}
                    >
                        <span>Esports & Bets</span>
                        {expandedSections.esports ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    {expandedSections.esports && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '8px' }}>
                            <NavLink to="/esports" onClick={onClose} className={({ isActive }) => `btn-ghost ${isActive ? 'active' : ''}`} style={{ justifyContent: 'flex-start' }}>
                                <Trophy size={18} color="#3b82f6" />
                                Esports
                            </NavLink>
                            <NavLink to="/global-bets" onClick={onClose} className={({ isActive }) => `btn-ghost ${isActive ? 'active' : ''}`} style={{ justifyContent: 'flex-start' }}>
                                <Target size={18} color="#f59e0b" />
                                Community Bets
                            </NavLink>
                            <NavLink to="/koala-dashboard" onClick={onClose} className={({ isActive }) => `btn-ghost ${isActive ? 'active' : ''}`} style={{ justifyContent: 'flex-start' }}>
                                <TrendingUp size={18} color="#10b981" />
                                Financial Dashboard
                            </NavLink>
                        </div>
                    )}
                </div>

                {/* --- Games Section --- */}
                <div className="nav-section" style={{ marginTop: '12px' }}>
                    <button 
                        className="btn-ghost section-header" 
                        onClick={() => setExpandedSections(p => ({ ...p, games: !p.games }))}
                        style={{ width: '100%', justifyContent: 'space-between', opacity: 0.7, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '4px' }}
                    >
                        <span>Games</span>
                        {expandedSections.games ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    {expandedSections.games && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '8px' }}>
                            <NavLink to="/games/koalaflap" onClick={onClose} className={({ isActive }) => `btn-ghost ${isActive ? 'active' : ''}`} style={{ justifyContent: 'flex-start' }}>
                                <Gamepad2 size={18} color="#ec4899" />
                                KoalaFlap
                            </NavLink>
                            <NavLink to="/games/leaderboard" onClick={onClose} className={({ isActive }) => `btn-ghost ${isActive ? 'active' : ''}`} style={{ justifyContent: 'flex-start' }}>
                                <Trophy size={18} color="#f59e0b" />
                                Game Leaderboards
                            </NavLink>
                        </div>
                    )}
                </div>

                {/* --- Tools & Misc --- */}
                <div className="nav-section" style={{ marginTop: '12px' }}>
                    <button 
                        className="btn-ghost section-header" 
                        onClick={() => setExpandedSections(p => ({ ...p, tools: !p.tools }))}
                        style={{ width: '100%', justifyContent: 'space-between', opacity: 0.7, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '4px' }}
                    >
                        <span>System</span>
                        {expandedSections.tools ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    {expandedSections.tools && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '8px' }}>
                            <NavLink to="/settings" onClick={onClose} className={({ isActive }) => `btn-ghost ${isActive ? 'active' : ''}`} style={{ justifyContent: 'flex-start' }}>
                                <Settings size={18} />
                                Settings
                            </NavLink>
                            <NavLink to="/features" onClick={onClose} className={({ isActive }) => `btn-ghost ${isActive ? 'active' : ''}`} style={{ justifyContent: 'flex-start' }}>
                                <Lightbulb size={18} color="#fbbf24" />
                                Feature Roadmap
                            </NavLink>
                            <NavLink to="/changelog" onClick={onClose} className={({ isActive }) => `btn-ghost ${isActive ? 'active' : ''}`} style={{ justifyContent: 'flex-start' }}>
                                <History size={18} color="#94a3b8" />
                                Changelog
                            </NavLink>
                            {user?.is_superadmin && (
                                <NavLink to="/admin" onClick={onClose} className={({ isActive }) => `btn-ghost ${isActive ? 'active' : ''}`} style={{ justifyContent: 'flex-start' }}>
                                    <Users size={18} color="var(--accent-primary)" />
                                    Admin Panel
                                </NavLink>
                            )}
                        </div>
                    )}
                </div>
            </nav>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', paddingRight: '4px', marginTop: '16px' }}>
                {roomState && isRoomRoute && (
                    <>
                        <div style={{ flex: 1, minHeight: '200px' }}>
                            <SharedTodo roomState={roomState} socket={socket} />
                        </div>
                        <div style={{ flex: 1, minHeight: '200px' }}>
                            <SharedCanvas roomState={roomState} socket={socket} />
                        </div>
                    </>
                )}
            </div>

            {roomState && !isRoomRoute && (
                <div
                    className="glass-panel"
                    style={{ padding: '16px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', cursor: 'pointer', marginBottom: '16px' }}
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
