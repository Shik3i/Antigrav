import React, { useState } from 'react';
import { Users, Link, ChevronRight, ChevronDown, Clock, Timer } from 'lucide-react';
import EVENTS from '../socketEvents';

const MemberPanel = ({ roomState, userRole, isMembersCollapsed, setIsMembersCollapsed, togglePomodoro, copyInviteLink, roomTokens, socket, roomId }) => {
    const currentMinutes = roomState.config.durationMs / 60000;
    const [durationInput, setDurationInput] = useState(currentMinutes);

    // Sync local input with server state if changed elsewhere
    React.useEffect(() => {
        setDurationInput(currentMinutes);
    }, [currentMinutes]);

    const handleDurationChange = () => {
        const mins = parseFloat(durationInput);
        if (!isNaN(mins) && mins > 0 && mins <= 180 && mins !== currentMinutes) {
            socket.emit(EVENTS.TIMER_ACTION, { roomId, action: 'SET_DURATION', payload: mins });
        } else if (mins !== currentMinutes) {
            // Reset to current if invalid
            setDurationInput(currentMinutes);
        }
    };

    return (
        <div className={`glass-panel ${isMembersCollapsed ? 'collapsed' : ''}`} style={{
            width: isMembersCollapsed ? '70px' : '300px',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            borderRight: 'none',
            transition: 'width 0.3s ease'
        }}>
            <div>
                <h3
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '1.1rem', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => setIsMembersCollapsed(!isMembersCollapsed)}
                >
                    <Users size={18} color="var(--accent-primary)" />
                    {!isMembersCollapsed && <span>Active Members ({roomState.users.length})</span>}
                    {isMembersCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                </h3>

                {!isMembersCollapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {roomState.users.map((u, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                    {u.displayName.charAt(0).toUpperCase()}
                                </div>
                                <span style={{ fontSize: '0.9rem', flex: 1 }}>{u.displayName}</span>
                                {u.role === 'write' && <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', padding: '2px 6px', background: 'rgba(59,130,246,0.1)', borderRadius: '4px' }}>Admin</span>}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {!isMembersCollapsed && userRole === 'write' && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Room Controls</h3>

                    {/* Duration Picker */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
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

                    <button
                        className={`btn-ghost ${roomState.state.isPomodoro ? 'active' : ''}`}
                        style={{ width: '100%', justifyContent: 'flex-start', marginBottom: '8px' }}
                        onClick={togglePomodoro}
                    >
                        <Clock size={18} />
                        {roomState.state.isPomodoro ? 'Disable Pomodoro' : 'Enable Pomodoro'}
                    </button>
                </div>
            )}

            {!isMembersCollapsed && userRole === 'write' && (
                <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>Invite others:</p>

                    <button className="btn-ghost" style={{ width: '100%', justifyContent: 'center', marginBottom: '8px', background: 'rgba(255,255,255,0.05)' }} onClick={() => copyInviteLink('read')} disabled={!roomTokens.readToken}>
                        <Link size={16} /> Copy "Read-Only" Link
                    </button>

                    <button className="btn-ghost" style={{ width: '100%', justifyContent: 'center', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)' }} onClick={() => copyInviteLink('write')} disabled={!roomTokens.writeToken}>
                        <Link size={16} /> Copy "Admin" Link
                    </button>
                </div>
            )}
        </div>
    );
};

export default MemberPanel;
