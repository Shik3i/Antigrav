import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Maximize2, ChevronDown, Settings } from 'lucide-react';
import Timer from '../components/Timer';
import ReactionBar from '../components/ReactionBar';
import MemberPanel from '../components/MemberPanel';
import PersonalCounter from '../components/PersonalCounter';
import EVENTS from '../socketEvents';
import { ALARM_SOUNDS, playAlarmSound } from '../utils/soundGenerator';
import ClockWidget from '../components/ClockWidget';
import WeatherWidget from '../components/WeatherWidget';

const Room = ({ user, socket, roomState, roomError, roomTokens, setActiveRoomId, setActiveToken, isZenMode, setIsZenMode, serverTimeOffset, setIsRightPanelOpen }) => {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();
    const [isMembersCollapsed, setIsMembersCollapsed] = useState(true);
    const [activeReactions, setActiveReactions] = useState([]);
    const [toasts, setToasts] = useState([]);
    const [eventHistory, setEventHistory] = useState([]);
    const [showCounter, setShowCounter] = useState(() => localStorage.getItem('showPersonalCounter') === 'true');

    const toggleCounter = () => {
        setShowCounter(prev => {
            const next = !prev;
            localStorage.setItem('showPersonalCounter', String(next));
            return next;
        });
    };

    // Compute role early so hooks can reference it
    const myUser = roomState?.users?.find(u =>
        u.userId === user.id ||
        u.id === user.id ||
        u.socketId === socket?.id
    );
    const userRole = myUser?.role || 'read';

    // Sync URL ID with App's global active room
    useEffect(() => {
        setIsRightPanelOpen(!isMembersCollapsed);
    }, [isMembersCollapsed, setIsRightPanelOpen]);

    useEffect(() => {
        if (id) {
            setActiveRoomId(prev => {
                if (prev !== id) return id;
                return prev;
            });

            if (token) {
                setActiveToken(prev => {
                    if (prev !== token) return token;
                    return prev;
                });
            }
        }
        return () => {
            setIsZenMode(false);
            setIsRightPanelOpen(false); // Reset on unmount
        };
    }, [id, token, setActiveRoomId, setActiveToken, setIsZenMode]);

    // Handle reactions and events
    useEffect(() => {
        if (!socket) return;
        const handleReaction = (data) => {
            const rid = Math.random().toString(36).substr(2, 9);
            setActiveReactions(prev => [...prev, { ...data, id: rid }]);
            setTimeout(() => {
                setActiveReactions(prev => prev.filter(r => r.id !== rid));
            }, 3000);
        };

        const handleRoomEvent = (data) => {
            const eventId = Math.random().toString(36).substr(2, 9);
            const newEvent = { ...data, id: eventId };

            // Always add to history
            setEventHistory(prev => [newEvent, ...prev]);

            // Only add to toasts if the event wasn't triggered by this user
            if (data.userId !== socket.id) {
                setToasts(prev => [...prev, newEvent]);
                setTimeout(() => {
                    setToasts(prev => prev.filter(t => t.id !== eventId));
                }, 4000);
            }
        };

        const handleRoomEventSync = (history) => {
            // Server provides an array of { id, type, message, timestamp, userId }
            // Ensure each has an ID for React keys if not provided
            const historyWithIds = history.map(ev => ev.id ? ev : { ...ev, id: Math.random().toString(36).substr(2, 9) });
            // The history from server is chronologically sorted (oldest first). 
            // We want newest first in state for the UI, so we reverse it.
            setEventHistory(historyWithIds.reverse());
        };

        socket.on(EVENTS.REACTION, handleReaction);

        socket.on(EVENTS.ROOM_EVENT, handleRoomEvent);
        socket.on(EVENTS.ROOM_EVENT_SYNC, handleRoomEventSync);
        console.log('Listening to EVENTS.ROOM_EVENT:', EVENTS.ROOM_EVENT);

        if (id) {
            socket.emit('REQUEST_ROOM_EVENT_SYNC', { roomId: id });
        }

        return () => {
            socket.off(EVENTS.REACTION, handleReaction);

            socket.off(EVENTS.ROOM_EVENT, handleRoomEvent);
            socket.off(EVENTS.ROOM_EVENT_SYNC, handleRoomEventSync);
        };
    }, [socket]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.code === 'Space') {
                e.preventDefault();
                if (userRole === 'write' && roomState) {
                    const action = roomState.state.isRunning ? 'PAUSE' : 'START';
                    socket.emit(EVENTS.TIMER_ACTION, { roomId: id, action });
                }
            }

            if (e.key.toLowerCase() === 'z') {
                setIsZenMode(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [socket, id, userRole, roomState, setIsZenMode]);

    const sendReaction = (emoji) => {
        socket.emit(EVENTS.SEND_REACTION, { roomId: id, emoji });
    };

    const togglePomodoro = () => {
        socket.emit(EVENTS.SET_POMODORO, { roomId: id, enabled: !roomState.state.isPomodoro });
    };

    const copyInviteLink = (role) => {
        const tokenToUse = role === 'write' ? roomTokens.writeToken : roomTokens.readToken;
        const url = new URL(window.location.href);
        url.searchParams.set('token', tokenToUse);
        navigator.clipboard.writeText(url.toString());
        alert(`Invite link with ${role.toUpperCase()} rights copied to clipboard!`);
    };

    if (roomError) {
        return (
            <div style={{ textAlign: 'center', marginTop: '100px', color: '#ef4444' }}>
                <h2>Error</h2>
                <p>{roomError}</p>
            </div>
        );
    }

    if (!roomState || roomState.id !== id) {
        return <div style={{ textAlign: 'center', marginTop: '100px', color: 'var(--text-muted)' }}>Synching room state...</div>;
    }


    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', gap: '0' }}>

            {/* Main Timer Area */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                transition: 'all 0.5s ease-in-out'
            }}>
                {!isZenMode && (
                    <div className="room-header-bar">
                        <h1 style={{ fontSize: '2rem', margin: 0, transition: 'opacity 0.3s', textAlign: 'center' }}>
                            {roomState.config.name || 'Timer Room'}
                        </h1>

                        {/* Top-right button group: Portal to App.jsx header */}
                        {createPortal(
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <button
                                    className="btn-ghost desktop-only animate-fade-in"
                                    onClick={() => setIsZenMode(!isZenMode)}
                                    title="Toggle Zen Mode (Z)"
                                    style={{ borderRadius: '50%', width: '40px', height: '40px', padding: 0, justifyContent: 'center' }}
                                >
                                    <Maximize2 size={18} />
                                </button>

                                {isMembersCollapsed && (
                                    <button
                                        className="btn-ghost animate-fade-in"
                                        onClick={() => setIsMembersCollapsed(false)}
                                        title="Open Room Settings"
                                        style={{ position: 'relative', borderRadius: '50%', width: '40px', height: '40px', padding: 0, justifyContent: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    >
                                        <Settings size={20} color="var(--text-main)" />
                                        <span style={{
                                            position: 'absolute', top: '-4px', right: '-4px', background: 'var(--accent-primary)', color: 'white', fontSize: '0.65rem', fontWeight: 700, width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(59,130,246,0.4)'
                                        }}>
                                            {roomState.users.length}
                                        </span>
                                    </button>
                                )}
                            </div>,
                            document.getElementById('desktop-room-actions')
                        )}
                    </div>
                )}

                {isZenMode && (
                    <button
                        className="btn-ghost"
                        onClick={() => setIsZenMode(false)}
                        title="Exit Zen Mode (Z)"
                        style={{ position: 'absolute', top: '24px', right: '24px', borderRadius: '50%', width: '40px', height: '40px', padding: 0, justifyContent: 'center' }}
                    >
                        <ChevronDown size={20} />
                    </button>
                )}

                <div style={{ transform: isZenMode ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.5s' }}>
                    <Timer roomState={roomState} socket={socket} roomId={id} userRole={userRole} user={user} isZenMode={isZenMode} serverTimeOffset={serverTimeOffset} />
                </div>

                {/* Statistics display */}
                {!isZenMode && roomState.state.stats && (
                    <div className="animate-fade-in" style={{
                        marginTop: '32px',
                        display: 'flex',
                        gap: '24px',
                        background: 'rgba(20, 24, 30, 0.4)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid var(--border-color)',
                        padding: '12px 24px',
                        borderRadius: '50px',
                        fontSize: '0.9rem',
                        color: 'var(--text-muted)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '1.2rem' }}>🎯</span>
                            <span>Room Completions: <strong style={{ color: 'var(--text-main)', marginLeft: '4px' }}>{roomState.state.stats.totalCompletions || 0}</strong></span>
                        </div>
                        <div style={{ width: '1px', background: 'var(--border-color)' }}></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '1.2rem' }}>⭐</span>
                            <span>Your Completions: <strong style={{ color: 'var(--accent-primary)', marginLeft: '4px' }}>{roomState.state.stats.userCompletions?.[user.id] || 0}</strong></span>
                        </div>
                    </div>
                )}

                {user.preferences?.showReactions && (
                    <ReactionBar activeReactions={activeReactions} sendReaction={sendReaction} isZenMode={isZenMode} />
                )}

                {/* Toasts Container */}
                <div style={{
                    position: 'absolute',
                    bottom: '24px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    pointerEvents: 'none',
                    alignItems: 'center',
                    zIndex: 100
                }}>
                    {toasts.map(toast => (
                        <div key={toast.id} className="glass-card animate-fade-in" style={{
                            padding: '10px 20px',
                            borderRadius: '24px',
                            background: 'rgba(20, 24, 30, 0.85)',
                            color: 'var(--text-main)',
                            fontSize: '0.9rem',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
                        }}>
                            {toast.message}
                        </div>
                    ))}
                </div>

                {!isZenMode && showCounter && (
                    <div className="desktop-only">
                        <PersonalCounter totalCompletions={roomState.state.stats?.totalCompletions || 0} />
                    </div>
                )}
            </div>

            {/* Context Sidebar */}
            {
                !isZenMode && (
                    <MemberPanel
                        roomState={roomState}
                        userRole={userRole}
                        isMembersCollapsed={isMembersCollapsed}
                        setIsMembersCollapsed={setIsMembersCollapsed}
                        togglePomodoro={togglePomodoro}
                        copyInviteLink={copyInviteLink}
                        roomTokens={roomTokens}
                        socket={socket}
                        roomId={id}
                        eventHistory={eventHistory}
                        serverTimeOffset={serverTimeOffset}
                        showCounter={showCounter}
                        toggleCounter={toggleCounter}
                    />
                )
            }

        </div >
    );
};

export default Room;
