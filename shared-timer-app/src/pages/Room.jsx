import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Maximize2, ChevronDown } from 'lucide-react';
import Timer from '../components/Timer';
import ReactionBar from '../components/ReactionBar';
import MemberPanel from '../components/MemberPanel';
import EVENTS from '../socketEvents';

const Room = ({ user, socket, roomState, roomError, roomTokens, setActiveRoomId, setActiveToken, isZenMode, setIsZenMode }) => {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();
    const [isMembersCollapsed, setIsMembersCollapsed] = useState(false);
    const [activeReactions, setActiveReactions] = useState([]);

    // Compute role early so hooks can reference it
    const myUser = roomState?.users?.find(u => u.userId === user.id);
    const userRole = myUser ? myUser.role : 'read';

    // Sync URL ID with App's global active room
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
        };
    }, [id, token, setActiveRoomId, setActiveToken, setIsZenMode]);

    // Handle reactions
    useEffect(() => {
        if (!socket) return;
        const handleReaction = (data) => {
            const rid = Math.random().toString(36).substr(2, 9);
            setActiveReactions(prev => [...prev, { ...data, id: rid }]);
            setTimeout(() => {
                setActiveReactions(prev => prev.filter(r => r.id !== rid));
            }, 3000);
        };
        socket.on(EVENTS.REACTION, handleReaction);
        return () => socket.off(EVENTS.REACTION, handleReaction);
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
        <div style={{ maxWidth: '1200px', margin: '0 auto', height: '100%', display: 'flex', gap: '32px' }}>

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
                    <h1 style={{ position: 'absolute', top: '32px', fontSize: '2rem', transition: 'opacity 0.3s' }}>
                        {roomState.config.name || 'Timer Room'}
                    </h1>
                )}

                <div style={{ transform: isZenMode ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.5s' }}>
                    <Timer roomState={roomState} socket={socket} roomId={id} userRole={userRole} user={user} isZenMode={isZenMode} />
                </div>

                <ReactionBar activeReactions={activeReactions} sendReaction={sendReaction} isZenMode={isZenMode} />

                <button
                    className="btn-ghost"
                    onClick={() => setIsZenMode(!isZenMode)}
                    title="Toggle Zen Mode (Z)"
                    style={{ position: 'absolute', top: '24px', right: '24px', borderRadius: '50%', width: '40px', height: '40px', padding: 0, justifyContent: 'center' }}
                >
                    {isZenMode ? <ChevronDown size={20} /> : <Maximize2 size={18} />}
                </button>
            </div>

            {/* Context Sidebar */}
            {!isZenMode && (
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
                />
            )}

        </div>
    );
};

export default Room;
