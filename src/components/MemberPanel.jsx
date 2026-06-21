import React, { useState, useEffect } from 'react';
import { Users, Link, X, Clock, Timer, History, Settings as SettingsIcon, UserPlus, UserCheck, ChevronDown, Gamepad2, Swords, Coins } from 'lucide-react';
import EVENTS from '../../socketEvents.json';
import Avatar from './Avatar';
import UserContextMenu from './UserContextMenu';
import { fetchJson } from '../utils/apiClient';
import { getTimerToken } from '../utils/clientStorage';

const CONNECTION_STATUS_META = {
    connected: {
        label: 'Room connection OK',
        color: '#10b981',
        background: 'rgba(16, 185, 129, 0.12)',
        border: 'rgba(16, 185, 129, 0.24)'
    },
    unstable: {
        label: 'Room connection unstable',
        color: '#f59e0b',
        background: 'rgba(245, 158, 11, 0.12)',
        border: 'rgba(245, 158, 11, 0.24)'
    },
    connecting: {
        label: 'Connecting to room',
        color: '#60a5fa',
        background: 'rgba(96, 165, 250, 0.12)',
        border: 'rgba(96, 165, 250, 0.24)'
    },
    offline: {
        label: 'Room connection lost',
        color: '#ef4444',
        background: 'rgba(239, 68, 68, 0.12)',
        border: 'rgba(239, 68, 68, 0.24)'
    },
    idle: {
        label: 'No active room',
        color: 'var(--text-muted)',
        background: 'rgba(148, 163, 184, 0.10)',
        border: 'rgba(148, 163, 184, 0.18)'
    }
};

const InviteFriendsDropdown = ({ socket, roomId, friends, isOpen, setIsOpen }) => {
    const [inviteNotice, setInviteNotice] = useState('');
    if (!getTimerToken()) return null;

    return (
        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <button
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => setIsOpen(!isOpen)}
            >
                <UserPlus size={16} />
                {isOpen ? 'Close Friends List' : 'Invite a Friend'}
            </button>
            {isOpen && (
                <div className="animate-fade-in" style={{ marginTop: '12px', padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                    {friends.length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', margin: '8px 0' }}>No friends available to invite.</p>
                    ) : (
                        friends.map(f => (
                            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 4px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{f.displayName}</span>
                                </div>
                                <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => {
                                    socket.emit(EVENTS.INVITE_FRIEND, { friendId: f.id, roomId });
                                    setInviteNotice(`Invite sent to ${f.displayName}.`);
                                    setIsOpen(false);
                                }}>
                                    Invite
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}
            {inviteNotice && (
                <div style={{ marginTop: '10px', fontSize: '0.8rem', color: 'var(--accent-primary)' }}>
                    {inviteNotice}
                </div>
            )}
        </div>
    );
};

const MemberPanel = ({ roomState, userRole, isMembersCollapsed, setIsMembersCollapsed, togglePomodoro, copyInviteLink, roomTokens, socket, roomId, eventHistory, serverTimeOffset, showCounter, toggleCounter, onLeaveRoom, roomConnectionState }) => {
    const currentMinutes = roomState.config.durationMs / 60000;
    const [durationInput, setDurationInput] = useState(currentMinutes);
    const [pauseInput, setPauseInput] = useState(roomState?.config?.pomodoro?.pauseMinutes || 5);
    const [workNameInput, setWorkNameInput] = useState(roomState?.config?.pomodoro?.workName || 'Work');
    const [breakNameInput, setBreakNameInput] = useState(roomState?.config?.pomodoro?.breakName || 'Break');
    const [activeTab, setActiveTab] = useState('controls');

    // Friends state lifted here
    const [friends, setFriends] = useState([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [selectedPvPMemberId, setSelectedPvPMemberId] = useState(null);
    const connectionMeta = CONNECTION_STATUS_META[roomConnectionState?.level] || CONNECTION_STATUS_META.idle;

    useEffect(() => {
        const tk = getTimerToken();
        if (!tk) return;
        fetchJson('/api/friends', { token: tk })
            .then(data => {
                if (Array.isArray(data)) setFriends(data.filter(f => f.status === 'accepted'));
            }).catch(console.error);
    }, []);

    useEffect(() => {
        setDurationInput(currentMinutes);
    }, [currentMinutes]);

    const handleDurationChange = () => {
        const mins = parseFloat(durationInput);
        if (!isNaN(mins) && mins > 0 && mins <= 180 && mins !== currentMinutes) {
            socket.emit(EVENTS.TIMER_ACTION, { roomId, action: 'SET_DURATION', payload: mins });
        } else if (mins !== currentMinutes) {
            setDurationInput(currentMinutes);
        }
    };

    if (isMembersCollapsed) return null;

    return (
        <div className="member-panel glass-panel animate-fade-in" style={{
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            overflowY: 'auto'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1.1rem' }}>
                    <Users size={18} color="var(--accent-primary)" />
                    <span>Settings & Members ({roomState.users.length})</span>
                </h3>
                <button className="btn-ghost" style={{ padding: '6px', width: '30px', height: '30px', justifyContent: 'center', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} onClick={() => setIsMembersCollapsed(true)}>
                    <X size={16} />
                </button>
            </div>

            <div
                title={roomConnectionState?.detail || connectionMeta.label}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: connectionMeta.background,
                    border: `1px solid ${connectionMeta.border}`
                }}
            >
                <span style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: connectionMeta.color,
                    boxShadow: `0 0 0 4px ${connectionMeta.background}`
                }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: connectionMeta.color }}>
                        {connectionMeta.label}
                    </span>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        {roomConnectionState?.detail || 'Live room sync status unavailable.'}
                    </span>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                {roomState.users.map((u, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <UserContextMenu username={u.username || u.name || u.displayName} userId={u.userId}>
                            <Avatar user={u} size={28} style={{ background: 'var(--bg-card)', fontSize: '0.8rem' }} />
                            <span style={{ fontSize: '0.9rem', flex: 1, display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '12px' }}>
                                {u.displayName}
                            {friends.some(f => f.username === u.username) && <UserCheck size={14} color="#10b981" title="Mutual Friend" />}
                            {(u.metrics || u.userId === userRole?.id) && (
                                <span
                                    title={`Ping: ${u.metrics?.ping || 0}ms | Sync-Offset: ${u.metrics?.offset || 0}ms`}
                                    style={{
                                        display: 'inline-block',
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        background: (u.metrics?.ping || 0) < 50 ? '#10b981' : (u.metrics?.ping || 0) < 150 ? '#f59e0b' : '#ef4444',
                                        cursor: 'help'
                                    }}
                                />
                            )}
                        </span>
                        </UserContextMenu>
                        {u.role === 'write' ? (
                            <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', padding: '2px 6px', background: 'rgba(59,130,246,0.1)', borderRadius: '4px' }}>Admin</span>
                        ) : (
                            userRole === 'write' && (
                                <button className="btn-ghost" style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(255,255,255,0.05)', height: '22px' }} onClick={() => socket.emit(EVENTS.PROMOTE_USER, { roomId, targetSocketId: u.socketId })}>
                                    Promote
                                </button>
                            )
                        )}
                    </div>
                ))}
            </div>

            {/* Minigames & PvP Accordion */}
            <details style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <summary style={{ 
                    cursor: 'pointer', color: 'var(--text-main)', fontSize: '1rem', 
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0',
                    outline: 'none', listStyle: 'none'
                }}>
                    <Gamepad2 size={18} color="#f59e0b" />
                    <span style={{ fontWeight: 600 }}>Minigames & PvP</span>
                    <ChevronDown size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                </summary>
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                    <button 
                        type="button"
                        className="btn-primary" 
                        style={{ fontSize: '0.85rem', padding: '10px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)' }} 
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const cleanRoomId = String(roomId);
                            socket.emit(EVENTS.ROOM_COINFLIP, { roomId: cleanRoomId });
                        }}
                    >
                        <Coins size={16} /> Münze werfen
                    </button>
                    <button 
                        type="button"
                        className="btn-primary" 
                        style={{ fontSize: '0.85rem', padding: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }} 
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const cleanRoomId = String(roomId);
                            socket.emit(EVENTS.START_DEATHROLL, { roomId: cleanRoomId });
                        }}
                        disabled={roomState.state.activeDeathroll != null}
                    >
                        <Swords size={16} /> Deathroll starten
                    </button>
                </div>
            </details>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
                {userRole === 'write' && (
                    <button
                        className={`btn-ghost ${activeTab === 'controls' ? 'active' : ''}`}
                        style={{ flex: 1, padding: '6px', fontSize: '0.85rem' }}
                        onClick={() => setActiveTab('controls')}
                    >
                        <SettingsIcon size={14} /> Controls
                    </button>
                )}
                <button
                    className={`btn-ghost ${activeTab === 'history' || userRole !== 'write' ? 'active' : ''}`}
                    style={{ flex: 1, padding: '6px', fontSize: '0.85rem' }}
                    onClick={() => setActiveTab('history')}
                >
                    <History size={14} /> History
                </button>
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {(activeTab === 'controls' && userRole === 'write') && (
                    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <h3 style={{ fontSize: '1rem', margin: 0 }}>Room Controls</h3>

                        {/* Room Rename */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                                type="text"
                                className="input-primary"
                                defaultValue={roomState.config.name}
                                maxLength={40}
                                placeholder="Room name..."
                                onBlur={(e) => {
                                    const val = e.target.value.trim();
                                    if (val && val !== roomState.config.name) {
                                        socket.emit(EVENTS.RENAME_ROOM, { roomId, newName: val });
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.target.blur();
                                    }
                                }}
                                style={{ flex: 1, padding: '6px 10px', fontSize: '0.85rem' }}
                            />
                        </div>

                        {/* Duration Picker */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Timer size={16} color="var(--text-muted)" />
                            <input
                                type="number"
                                min="0.01"
                                step="any"
                                max="180"
                                value={durationInput}
                                onChange={(e) => setDurationInput(e.target.value)}
                                onBlur={handleDurationChange}
                                onKeyDown={(e) => e.key === 'Enter' && handleDurationChange()}
                                className="input-primary"
                                style={{ width: '70px', padding: '6px 10px', fontSize: '0.85rem', textAlign: 'center' }}
                            />
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>min</span>
                        </div>

                        {/* Pomodoro Toggle & Input */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px' }}>
                            <button
                                className={`btn-ghost ${roomState.state.isPomodoro ? 'active' : ''}`}
                                style={{ width: '100%', justifyContent: 'flex-start' }}
                                onClick={() => {
                                    const enabled = !roomState.state.isPomodoro;
                                    const pMins = parseFloat(pauseInput);
                                    if (enabled && pMins >= parseFloat(durationInput)) {
                                        alert("Validierung: Die Pausenzeit muss kleiner als die Gesamtzeit sein.");
                                        return;
                                    }
                                    socket.emit(EVENTS.SET_POMODORO, { roomId, enabled, pauseMinutes: pMins, workName: workNameInput, breakName: breakNameInput });
                                }}
                            >
                                <Clock size={16} />
                                {roomState.state.isPomodoro ? 'Disable Phase-Timer' : 'Enable Phase-Timer'}
                            </button>
                            
                            {roomState.state.isPomodoro && (
                                <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '8px' }}>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', flex: 1 }}>Pause Time:</span>
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="any"
                                        max="180"
                                        value={pauseInput}
                                        onChange={(e) => setPauseInput(e.target.value)}
                                        onBlur={() => {
                                            const pMins = parseFloat(pauseInput);
                                            if (!isNaN(pMins) && pMins > 0) {
                                                if (pMins >= parseFloat(durationInput)) {
                                                    alert("Validierung: Die Pausenzeit muss kleiner als die Gesamtzeit sein.");
                                                    setPauseInput(roomState.config.pomodoro?.pauseMinutes || 5);
                                                } else {
                                                    socket.emit(EVENTS.SET_POMODORO, { roomId, enabled: true, pauseMinutes: pMins, workName: workNameInput, breakName: breakNameInput });
                                                }
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.target.blur();
                                            }
                                        }}
                                        className="input-primary"
                                        style={{ width: '70px', padding: '6px 10px', fontSize: '0.85rem', textAlign: 'center' }}
                                    />
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>min</span>
                                </div>
                            )}

                            {roomState.state.isPomodoro && (
                                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '8px', marginTop: '4px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', flex: 1 }}>Work Name:</span>
                                        <input
                                            type="text"
                                            value={workNameInput}
                                            onChange={(e) => setWorkNameInput(e.target.value)}
                                            onBlur={() => {
                                                const pMins = parseFloat(pauseInput) || 5;
                                                socket.emit(EVENTS.SET_POMODORO, { roomId, enabled: true, pauseMinutes: pMins, workName: workNameInput, breakName: breakNameInput });
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') e.target.blur();
                                            }}
                                            className="input-primary"
                                            style={{ width: '120px', padding: '6px 10px', fontSize: '0.85rem' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', flex: 1 }}>Break Name:</span>
                                        <input
                                            type="text"
                                            value={breakNameInput}
                                            onChange={(e) => setBreakNameInput(e.target.value)}
                                            onBlur={() => {
                                                const pMins = parseFloat(pauseInput) || 5;
                                                socket.emit(EVENTS.SET_POMODORO, { roomId, enabled: true, pauseMinutes: pMins, workName: workNameInput, breakName: breakNameInput });
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') e.target.blur();
                                            }}
                                            className="input-primary"
                                            style={{ width: '120px', padding: '6px 10px', fontSize: '0.85rem' }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Personal Widgets */}
                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '8px' }}>
                            <h4 style={{ fontSize: '0.9rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>Personal Widgets</h4>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <input
                                    type="checkbox"
                                    checked={showCounter}
                                    onChange={toggleCounter}
                                    style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }}
                                />
                                <span style={{ fontSize: '0.85rem' }}>Show Personal Activity Counter</span>
                            </label>
                        </div>
                    </div>
                )}

                {(activeTab === 'history' || userRole !== 'write') && (
                    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <h3 style={{ fontSize: '1rem', margin: 0 }}>Event History</h3>
                        {(!eventHistory || eventHistory.length === 0) ? (
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No events yet.</p>
                        ) : (
                            eventHistory.map(event => (
                                <div key={event.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{event.message}</span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {userRole === 'write' && (
                <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                    
                    <details style={{ marginBottom: '8px' }}>
                        <summary style={{ 
                            cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.8rem', 
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0',
                            outline: 'none', listStyle: 'none'
                        }}>
                            <UserPlus size={16} color="var(--accent-primary)" />
                            <span style={{ fontWeight: 600 }}>Invite others</span>
                            <ChevronDown size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                        </summary>
                        
                        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                            <button className="btn-ghost" style={{ width: '100%', border: '1px solid rgba(255,255,255,0.05)', justifyContent: 'center', background: 'rgba(255,255,255,0.03)' }} onClick={() => copyInviteLink('read')} disabled={!roomTokens.readToken}>
                                <Link size={14} /> Copy "Read-Only" Link
                            </button>

                            <button className="btn-ghost" style={{ width: '100%', border: '1px solid rgba(59, 130, 246, 0.2)', justifyContent: 'center', background: 'rgba(59, 130, 246, 0.05)', color: 'var(--accent-primary)' }} onClick={() => copyInviteLink('write')} disabled={!roomTokens.writeToken}>
                                <Link size={14} /> Copy "Admin" Link
                            </button>

                            <InviteFriendsDropdown socket={socket} roomId={roomId} />
                        </div>
                    </details>

                    <button className="btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }} onClick={() => onLeaveRoom?.()}>
                        Leave Room
                    </button>
                </div>
            )}
            {userRole === 'read' && (
                <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                    <button className="btn-ghost" style={{ width: '100%', justifyContent: 'center', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }} onClick={() => onLeaveRoom?.()}>
                        Leave Room
                    </button>
                </div>
            )}
        </div >
    );
};

export default MemberPanel;
