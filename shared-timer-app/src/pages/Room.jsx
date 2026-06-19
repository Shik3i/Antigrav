import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useSearchParams } from 'react-router-dom';
import { Maximize2, ChevronDown, Settings } from 'lucide-react';
import Timer from '../components/Timer';
import ReactionBar from '../components/ReactionBar';
import MemberPanel from '../components/MemberPanel';
import PersonalCounter from '../components/PersonalCounter';
import DeathrollWidget from '../components/DeathrollWidget';
import EVENTS from '../../socketEvents.json';
import { ALARM_SOUNDS, playAlarmSound } from '../utils/soundGenerator';
import ClockWidget from '../components/ClockWidget';
import WeatherWidget from '../components/WeatherWidget';
import { useToast } from '../context/ToastContext';
import { getCurrentRoomMember } from '../features/timer/timerSelectors';

const COINFLIP_ANIMATION_MS = 1800;
const COINFLIP_RESULT_VISIBLE_MS = 5000;

const Room = ({ user, socket, roomState, roomError, roomTokens, setActiveRoomId, setActiveToken, isZenMode, setIsZenMode, serverTimeOffset, setIsRightPanelOpen, onLeaveRoom, roomConnectionState }) => {
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
    const [coinflipCountdown, setCoinflipCountdown] = useState(0);
    const [coinflipDetailsVisible, setCoinflipDetailsVisible] = useState(false);
    const coinflipHideTimeoutRef = useRef(null);
    const coinflipRevealTimeoutRef = useRef(null);

    const toggleCounter = () => {
        setShowCounter(prev => {
            const next = !prev;
            localStorage.setItem('showPersonalCounter', String(next));
            return next;
        });
    };

    // Compute role early so hooks can reference it
    const myUser = getCurrentRoomMember(roomState, user.id, socket?.id);
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
            if (coinflipHideTimeoutRef.current) {
                clearTimeout(coinflipHideTimeoutRef.current);
                coinflipHideTimeoutRef.current = null;
            }
            if (coinflipRevealTimeoutRef.current) {
                clearTimeout(coinflipRevealTimeoutRef.current);
                coinflipRevealTimeoutRef.current = null;
            }
            setCoinflipResult(data);
            setCoinflipDetailsVisible(false);
            setCoinflipCountdown(0);

            coinflipRevealTimeoutRef.current = setTimeout(() => {
                setCoinflipDetailsVisible(true);
                setCoinflipCountdown(COINFLIP_RESULT_VISIBLE_MS / 1000);
                coinflipRevealTimeoutRef.current = null;

                coinflipHideTimeoutRef.current = setTimeout(() => {
                    setCoinflipResult(null);
                    setCoinflipCountdown(0);
                    setCoinflipDetailsVisible(false);
                    coinflipHideTimeoutRef.current = null;
                }, COINFLIP_RESULT_VISIBLE_MS);
            }, COINFLIP_ANIMATION_MS);
        };

        socket.on(EVENTS.ROOM_COINFLIP_RESULT, handleCoinflipResult);
        socket.on(EVENTS.REACTION, handleReaction);

        socket.on(EVENTS.ROOM_EVENT, handleRoomEvent);
        socket.on(EVENTS.ROOM_EVENT_SYNC, handleRoomEventSync);

        if (id) {
            socket.emit('REQUEST_ROOM_EVENT_SYNC', { roomId: id });
        }

        return () => {
            if (coinflipHideTimeoutRef.current) {
                clearTimeout(coinflipHideTimeoutRef.current);
                coinflipHideTimeoutRef.current = null;
            }
            if (coinflipRevealTimeoutRef.current) {
                clearTimeout(coinflipRevealTimeoutRef.current);
                coinflipRevealTimeoutRef.current = null;
            }
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

    useEffect(() => {
        if (!coinflipResult || !coinflipDetailsVisible || coinflipCountdown <= 0) return undefined;

        const intervalId = window.setInterval(() => {
            setCoinflipCountdown(prev => {
                if (prev <= 1) {
                    window.clearInterval(intervalId);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => window.clearInterval(intervalId);
    }, [coinflipResult, coinflipDetailsVisible, coinflipCountdown]);

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
                {coinflipResult && document.body && createPortal(
                    <div className="coinflip-overlay animate-fade-in" style={{
                        position: 'fixed',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2000,
                        pointerEvents: 'none',
                        background: 'radial-gradient(circle at center, rgba(8, 12, 18, 0.12) 0%, rgba(8, 12, 18, 0.18) 28%, rgba(8, 12, 18, 0.28) 100%)'
                    }}>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '14px',
                            padding: '26px 28px 22px',
                            borderRadius: '28px',
                            background: 'linear-gradient(180deg, rgba(18, 24, 34, 0.76) 0%, rgba(12, 17, 25, 0.68) 100%)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            backdropFilter: 'blur(16px)',
                            boxShadow: '0 24px 80px rgba(0,0,0,0.28)'
                        }}>
                            <div style={{
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '188px',
                                height: '188px'
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    inset: '18px',
                                    borderRadius: '999px',
                                    background: 'radial-gradient(circle, rgba(10, 14, 22, 0.58) 0%, rgba(10, 14, 22, 0.26) 56%, rgba(10, 14, 22, 0) 100%)',
                                    filter: 'blur(10px)'
                                }} />
                                <div className="coin-flip-animation" style={{
                                    width: '120px',
                                    height: '120px',
                                    borderRadius: '50%',
                                    background: coinflipResult.result === 'KOPF' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                                    boxShadow: '0 14px 40px rgba(0,0,0,0.38), inset 0 0 20px rgba(255,255,255,0.5)',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    fontSize: '2rem',
                                    fontWeight: 800,
                                    color: '#fff',
                                    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                                    border: '4px solid rgba(255,255,255,0.95)',
                                    position: 'relative',
                                    zIndex: 1
                                }}>
                                    {coinflipResult.result === 'KOPF' ? 'KOPF' : 'ZAHL'}
                                </div>
                            </div>
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '8px',
                                opacity: coinflipDetailsVisible ? 1 : 0,
                                transform: coinflipDetailsVisible ? 'translateY(0)' : 'translateY(8px)',
                                transition: 'opacity 220ms ease, transform 220ms ease'
                            }}>
                                <div style={{
                                    padding: '10px 18px',
                                    fontSize: '1.02rem',
                                    fontWeight: 600,
                                    color: 'var(--text-main)',
                                    textAlign: 'center',
                                    borderRadius: '999px',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    maxWidth: 'min(80vw, 420px)'
                                }}>
                                    <span style={{ color: 'var(--accent-primary)' }}>{coinflipResult.userName}</span> wirft eine Münze: {coinflipResult.result}
                                </div>
                                <div style={{
                                    fontSize: '0.78rem',
                                    color: 'var(--text-muted)',
                                    letterSpacing: '0.04em',
                                    textTransform: 'uppercase'
                                }}>
                                    Schließt in {coinflipCountdown}s
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {/* Minigames: Deathroll Widget */}
                {roomState.state.activeDeathroll && !isZenMode && (
                    <DeathrollWidget
                        deathroll={roomState.state.activeDeathroll}
                        user={user}
                        roomId={id}
                        socket={socket}
                        rollEvent={EVENTS.ROLL_DEATHROLL}
                    />
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
                        roomConnectionState={roomConnectionState}
                    />
                )
            }

        </div >
    );
};

export default Room;
