import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useSearchParams } from 'react-router-dom';
import { Maximize2, ChevronDown, Settings, Coins, Swords, Dices } from 'lucide-react';
import Timer from '../components/Timer';
import ReactionBar from '../components/ReactionBar';
import MemberPanel from '../components/MemberPanel';
import PersonalCounter from '../components/PersonalCounter';
import EVENTS from '../socketEvents';
import { ALARM_SOUNDS, playAlarmSound } from '../utils/soundGenerator';
import ClockWidget from '../components/ClockWidget';
import WeatherWidget from '../components/WeatherWidget';
import { useToast } from '../context/ToastContext';

const Room = ({ user, socket, roomState, roomError, roomTokens, setActiveRoomId, setActiveToken, isZenMode, setIsZenMode, serverTimeOffset, setIsRightPanelOpen, onLeaveRoom }) => {
    const { showToast } = useToast();
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const [isMembersCollapsed, setIsMembersCollapsed] = useState(true);
    const [activeReactions, setActiveReactions] = useState([]);
    const [toasts, setToasts] = useState([]);
    const [eventHistory, setEventHistory] = useState([]);
    const [showCounter, setShowCounter] = useState(() => localStorage.getItem('showPersonalCounter') === 'true');
    const [coinflipResult, setCoinflipResult] = useState(null);

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

        const handleCoinflipResult = (data) => {
            setCoinflipResult(data);
            setTimeout(() => setCoinflipResult(null), 5000);
        };

        socket.on(EVENTS.ROOM_COINFLIP_RESULT, handleCoinflipResult);
        socket.on(EVENTS.REACTION, handleReaction);

        socket.on(EVENTS.ROOM_EVENT, handleRoomEvent);
        socket.on(EVENTS.ROOM_EVENT_SYNC, handleRoomEventSync);
        console.log('Listening to EVENTS.ROOM_EVENT:', EVENTS.ROOM_EVENT);

        if (id) {
            socket.emit('REQUEST_ROOM_EVENT_SYNC', { roomId: id });
        }

        return () => {
            socket.off(EVENTS.ROOM_COINFLIP_RESULT, handleCoinflipResult);
            socket.off(EVENTS.REACTION, handleReaction);

            socket.off(EVENTS.ROOM_EVENT, handleRoomEvent);
            socket.off(EVENTS.ROOM_EVENT_SYNC, handleRoomEventSync);
        };
    }, [socket]);

    // Use refs for stable event listeners
    const stateRef = useRef(roomState);
    const roleRef = useRef(userRole);
    useEffect(() => { stateRef.current = roomState; }, [roomState]);
    useEffect(() => { roleRef.current = userRole; }, [userRole]);

    // Keyboard Shortcuts
    useEffect(() => {
        if (!socket) return;

        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.code === 'Space') {
                e.preventDefault();
                const currentRole = roleRef.current;
                const currentState = stateRef.current;
                if (currentRole === 'write' && currentState) {
                    const action = currentState.state.isRunning ? 'PAUSE' : 'START';
                    socket.emit(EVENTS.TIMER_ACTION, { roomId: id, action });
                }
            }

            if (e.key.toLowerCase() === 'z') {
                setIsZenMode(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [socket, id, setIsZenMode]);

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
        showToast(`Einladungs-Link für ${role.toUpperCase()} kopiert!`, 'success');
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
                        {document.getElementById('desktop-room-actions') && createPortal(
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

                {/* Minigames: Coinflip Overlay */}
                {coinflipResult && (
                    <div className="coinflip-overlay animate-fade-in" style={{
                        position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', zIndex: 1000, pointerEvents: 'none'
                    }}>
                        <div className="coin-flip-animation" style={{
                            width: '120px', height: '120px', borderRadius: '50%',
                            background: coinflipResult.result === 'KOPF' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.5), inset 0 0 20px rgba(255,255,255,0.5)',
                            display: 'flex', justifyContent: 'center', alignItems: 'center',
                            fontSize: '2rem', fontWeight: 800, color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                            border: '4px solid #fff'
                        }}>
                            {coinflipResult.result === 'KOPF' ? 'KOPF' : 'ZAHL'}
                        </div>
                        <div className="glass-card" style={{ padding: '12px 24px', fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-main)', textAlign: 'center' }}>
                            <span style={{ color: 'var(--accent-primary)' }}>{coinflipResult.userName}</span> wirft eine Münze: {coinflipResult.result}
                        </div>
                    </div>
                )}

                {/* Minigames: Deathroll Widget */}
                {roomState.state.activeDeathroll && !isZenMode && (
                    <div className="glass-card animate-fade-in" style={{
                        marginTop: '24px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
                        border: '1px solid rgba(239, 68, 68, 0.4)', background: 'rgba(20, 24, 30, 0.8)', boxShadow: '0 10px 30px rgba(239, 68, 68, 0.15)',
                        maxWidth: '400px', width: '100%', position: 'relative', overflow: 'hidden'
                    }}>
                        {/* Background subtle pulse */}
                        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, rgba(239, 68, 68, 0.1) 0%, transparent 70%)', zIndex: 0 }} />
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', zIndex: 1 }}>
                            <Swords size={28} color="#ef4444" />
                            <h3 style={{ fontSize: '1.4rem', color: 'var(--text-main)', margin: 0 }}>Deathroll</h3>
                        </div>
                        
                        <div style={{ textAlign: 'center', zIndex: 1 }}>
                            <div style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                <strong style={{ color: 'var(--accent-primary)' }}>{roomState.state.activeDeathroll.lastRoller}</strong> hat gewürfelt:
                            </div>
                            <div className="dice-shake" style={{ fontSize: '3rem', fontWeight: 900, color: roomState.state.activeDeathroll.isComplete ? '#ef4444' : '#fff', textShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>
                                {roomState.state.activeDeathroll.currentMax}
                            </div>
                        </div>

                        {roomState.state.activeDeathroll.isComplete ? (
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ef4444', textAlign: 'center', marginTop: '8px', zIndex: 1, padding: '8px 16px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px' }}>
                                {roomState.state.activeDeathroll.lastRoller} hat verloren!
                            </div>
                        ) : (
                            <button 
                                type="button"
                                className="btn-primary" 
                                style={{ width: '100%', justifyContent: 'center', fontSize: '1.1rem', padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)', zIndex: 1 }}
                                disabled={(roomState.state.activeDeathroll.lastRoller === user.displayName || roomState.state.activeDeathroll.lastRoller === user.username)}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const cleanRoomId = String(id);
                                    socket.emit(EVENTS.ROLL_DEATHROLL, { roomId: cleanRoomId });
                                }}
                            >
                                <Dices size={20} /> {(roomState.state.activeDeathroll.lastRoller === user.displayName || roomState.state.activeDeathroll.lastRoller === user.username) ? 'Warten auf andere...' : `Antworten (1 - ${roomState.state.activeDeathroll.currentMax})`}
                            </button>
                        )}
                    </div>
                )}

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
                        onLeaveRoom={onLeaveRoom}
                    />
                )
            }

        </div >
    );
};

export default Room;
