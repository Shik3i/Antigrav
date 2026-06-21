import React from 'react';

const ActivityLogTab = ({ activity, formatDate, onDelete }) => {
    return (
        <div className="glass-card animate-fade-in" style={{ padding: '32px' }}>
            <h3 style={{ marginBottom: '24px' }}>Global Timer Completions ({activity.length})</h3>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Completed At</th>
                            <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>User Name</th>
                            <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Room Name</th>
                            <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Duration</th>
                            <th style={{ padding: '12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500 }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {activity.map(row => (
                            <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '12px' }}>{formatDate(row.completedAt)}</td>
                                <td style={{ padding: '12px', color: 'var(--accent-primary)' }}>{row.displayName || row.username || 'Anonymous'}</td>
                                <td style={{ padding: '12px' }}>{row.roomName || 'Unknown Room'}</td>
                                <td style={{ padding: '12px' }}>{row.durationMinutes || 0} min</td>
                                <td style={{ padding: '12px', textAlign: 'right' }}>
                                    <button className="btn-ghost" style={{ padding: '4px 8px', color: '#ef4444' }} onClick={() => onDelete(row.id)}>Delete</button>
                                </td>
                            </tr>
                        ))}
                        {activity.length === 0 && (
                            <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No completed timers yet.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ActivityLogTab;
