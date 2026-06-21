import React from 'react';
import { Activity, Trash2 } from 'lucide-react';

const SystemLogsTab = ({ systemLogs, onFetch, onClear, formatDate }) => {
    return (
        <div className="glass-card animate-fade-in" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Activity size={24} color="var(--accent-primary)" />
                    System Logs (24h Retention)
                </h3>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn-secondary" onClick={onFetch}>Refresh</button>
                    <button 
                        className="btn-ghost" 
                        style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', gap: '8px' }} 
                        onClick={onClear}
                    >
                        <Trash2 size={16} />
                        Logs löschen
                    </button>
                </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Timestamp</th>
                            <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Level</th>
                            <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Context</th>
                            <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Message</th>
                        </tr>
                    </thead>
                    <tbody>
                        {systemLogs && systemLogs.map(log => (
                            <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>{formatDate(log.createdAt)}</td>
                                <td style={{ padding: '12px' }}>
                                    <span style={{ 
                                        padding: '2px 8px', 
                                        borderRadius: '4px', 
                                        fontSize: '0.75rem', 
                                        fontWeight: 'bold',
                                        background: log.level === 'warn' ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)',
                                        color: log.level === 'warn' ? '#f59e0b' : '#3b82f6'
                                    }}>
                                        {log.level?.toUpperCase()}
                                    </span>
                                </td>
                                <td style={{ padding: '12px', fontWeight: 600 }}>{log.context}</td>
                                <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{log.message}</td>
                            </tr>
                        ))}
                        {(!systemLogs || systemLogs.length === 0) && (
                            <tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No system logs found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SystemLogsTab;
