import React, { useEffect, useState, useRef } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { Clock, Users, Trophy, Settings, LayoutDashboard, Play, Pause, Maximize2 } from 'lucide-react';
import EVENTS from '../socketEvents';

const Sidebar = ({ user, roomState, socket, activeToken }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const isRoomRoute = location.pathname.startsWith('/room/');

    const containerStyle = {
        width: '260px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 16px',
        gap: '32px',
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

    return (
        <aside className="glass-panel" style={containerStyle}>
            <Link to="/" style={{ padding: '0 8px', display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: 'inherit' }}>
                <Clock className="animate-glow" color="var(--accent-primary)" size={28} />
                <h2 style={{ fontSize: '1.25rem', margin: 0, background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    SyncTimer
                </h2>
            </Link>

            <nav style={navStyle}>
                <NavLink to="/" className={({ isActive }) => `btn-ghost ${isActive ? 'active' : ''}`} style={{ justifyContent: 'flex-start' }}>
                    <LayoutDashboard size={20} />
                    Public Rooms
                </NavLink>
                <NavLink to="/highscores" className={({ isActive }) => `btn-ghost ${isActive ? 'active' : ''}`} style={{ justifyContent: 'flex-start' }}>
                    <Trophy size={20} />
                    Highscores
                </NavLink>
                <NavLink to="/settings" className={({ isActive }) => `btn-ghost ${isActive ? 'active' : ''}`} style={{ justifyContent: 'flex-start' }}>
                    <Settings size={20} />
                    Settings
                </NavLink>
            </nav>

            <div style={{ flex: 1 }}></div>

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

            <NavLink to="/settings" style={{ ...UserInfoStyle, textDecoration: 'none', marginTop: 0 }} className="user-profile-link">
                <div style={AvatarStyle}>
                    {user.displayName.charAt(0).toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {user.displayName}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click to change name</span>
                </div>
            </NavLink>
        </aside>
    );
};

export default Sidebar;
