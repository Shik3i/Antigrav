import React from 'react';
import { History, RefreshCcw } from 'lucide-react';

const AuditLogsTab = ({
    auditLogs,
    onFetch,
    formatDate
}) => {
    return (
        <div className="glass-card animate-fade-in" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <History size={24} color="var(--accent-primary)" />
                    Admin Audit Logs ({auditLogs.length})
                </h3>
                <button className="btn-secondary" onClick={onFetch}>
                    <RefreshCcw size={16} style={{ marginRight: '8px' }} /> Refresh
                </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Timestamp</th>
                            <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Admin</th>
                            <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Action</th>
                            <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {auditLogs.map(log => (
                            <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>{formatDate(log.timestamp)}</td>
                                <td style={{ padding: '12px', fontWeight: 600, color: 'var(--accent-primary)' }}>{log.adminName}</td>
                                <td style={{ padding: '12px' }}>
                                    <span style={{ 
                                        padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                                        background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)'
                                    }}>
                                        {log.action}
                                    </span>
                                </td>
                                <td style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                    {typeof log.details === 'string' && log.details.startsWith('{') ? (
                                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                                            {JSON.stringify(JSON.parse(log.details), null, 2)}
                                        </pre>
                                    ) : (
                                        log.details
                                    )}
                                </td>
                            </tr>
                        ))}
                        {auditLogs.length === 0 && (
                            <tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No audit logs found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AuditLogsTab;
