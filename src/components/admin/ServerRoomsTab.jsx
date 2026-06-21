import React from 'react';

const ServerRoomsTab = ({ rooms, formatDate, onEdit, onDelete }) => {
    return (
        <div className="glass-card animate-fade-in" style={{ padding: '32px' }}>
            <h3 style={{ marginBottom: '24px' }}>Server Rooms ({rooms.length})</h3>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Created</th>
                            <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Room Name</th>
                            <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Active Users</th>
                            <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Owner</th>
                            <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Vis</th>
                            <th style={{ padding: '12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500 }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rooms.map(row => (
                            <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '12px' }}>{formatDate(row.createdAt)}</td>
                                <td style={{ padding: '12px', fontWeight: 600 }}>{row.name}</td>
                                <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: row.activeUsers > 0 ? '#10b981' : '#ef4444' }} />
                                        {row.activeUsers} Users
                                    </div>
                                </td>
                                <td style={{ padding: '12px', color: 'var(--accent-primary)' }}>{row.ownerName || 'Public'}</td>
                                <td style={{ padding: '12px' }}>
                                    <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, background: row.isPublic ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: row.isPublic ? '#22c55e' : '#ef4444' }}>
                                        {row.isPublic ? 'Public' : 'Private'}
                                    </span>
                                </td>
                                <td style={{ padding: '12px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                    <button className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => onEdit(row.id, row.name)}>Edit</button>
                                    <button className="btn-ghost" style={{ padding: '4px 8px', color: '#ef4444' }} onClick={() => onDelete(row.id)}>Delete</button>
                                </td>
                            </tr>
                        ))}
                        {rooms.length === 0 && (
                            <tr><td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No active rooms in memory.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ServerRoomsTab;
