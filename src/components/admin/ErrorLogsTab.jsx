import React from 'react';
import { Trash2 } from 'lucide-react';

const ErrorLogsTab = ({ errorLogs, onFetch, onClear, onDelete, formatDate }) => {
    return (
        <div className="glass-card animate-fade-in" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ margin: 0 }}>Server Error Logs ({errorLogs.length})</h3>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn-secondary" onClick={onFetch}>Refresh</button>
                    <button className="btn-ghost" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)' }} onClick={onClear}>
                        Clear All Logs
                    </button>
                </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Timestamp</th>
                            <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Error</th>
                            <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Context</th>
                            <th style={{ padding: '12px', textAlign: 'right', color: 'var(--text-muted)' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {errorLogs.map(log => (
                            <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>{formatDate(log.timestamp)}</td>
                                <td style={{ padding: '12px' }}>
                                    <div style={{ fontWeight: 600, color: '#ef4444', marginBottom: '4px' }}>{log.message}</div>
                                    {log.stack && (
                                        <details style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            <summary style={{ cursor: 'pointer' }}>Show Stack</summary>
                                            <pre style={{ whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '8px', marginTop: '4px', borderRadius: '4px' }}>
                                                {log.stack}
                                            </pre>
                                        </details>
                                    )}
                                </td>
                                <td style={{ padding: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{log.context}</td>
                                <td style={{ padding: '12px', textAlign: 'right' }}>
                                    <button className="btn-ghost" style={{ color: '#ef4444' }} onClick={() => onDelete(log.id)}>
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {errorLogs.length === 0 && (
                            <tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No error logs found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ErrorLogsTab;
