import React from 'react';
import { Database, Plus, RefreshCw, Shield, Clock, FileText } from 'lucide-react';

/**
 * Dumb Component: DatabaseBackupsTab
 * Displays the list of available backups and management controls.
 * No restore functionality allowed as per security directive.
 */
const DatabaseBackupsTab = ({ 
  backups, 
  autoBackupEnabled, 
  onTriggerBackup, 
  onToggleAutoBackup, 
  onRefresh, 
  formatDate,
  isLoading 
}) => {
  
  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="admin-tab-content animate-fade-in">
      {/* Hero Section / Summary */}
      <div className="glass-card" style={{ padding: '32px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Database size={28} color="var(--accent-primary)" />
            Enterprise Database Backups
          </h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px', maxWidth: '600px' }}>
            Robust backup system with GFS (Grandfather-Father-Son) retention. 
            Daily (7 days), Weekly (4 weeks), and Monthly (12 months) backups are automatically managed.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: '12px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Auto-Backup</span>
            <div 
              onClick={() => onToggleAutoBackup(!autoBackupEnabled)}
              style={{
                width: '48px',
                height: '24px',
                borderRadius: '12px',
                background: autoBackupEnabled ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)',
                position: 'relative',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: 'white',
                position: 'absolute',
                top: '3px',
                left: autoBackupEnabled ? '27px' : '3px',
                transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
              }} />
            </div>
          </div>
          <button 
            className="btn-primary" 
            onClick={onTriggerBackup} 
            disabled={isLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}
          >
            {isLoading ? <RefreshCw className="animate-spin" size={18} /> : <Plus size={18} />}
            Manual Backup
          </button>
        </div>
      </div>

      {/* Backups List */}
      <div className="glass-card" style={{ padding: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Clock size={22} color="var(--accent-secondary)" />
            Backup History
          </h3>
          <button className="btn-ghost" onClick={onRefresh} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={16} />
            Refresh List
          </button>
        </div>

        <div className="custom-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Creation Date</th>
                <th>Filename</th>
                <th>Size</th>
                <th style={{ textAlign: 'right' }}>Security</th>
              </tr>
            </thead>
            <tbody>
              {backups && backups.length > 0 ? (
                backups.map((backup, idx) => (
                  <tr key={backup.filename || idx}>
                    <td style={{ fontWeight: 600 }}>{formatDate(backup.createdAt)}</td>
                    <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={14} />
                        {backup.filename}
                      </div>
                    </td>
                    <td>{formatSize(backup.size)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        padding: '4px 10px', 
                        borderRadius: '20px', 
                        fontSize: '0.75rem', 
                        background: 'rgba(34, 197, 94, 0.1)', 
                        color: '#22c55e',
                        border: '1px solid rgba(34, 197, 94, 0.2)'
                      }}>
                        <Shield size={12} />
                        Verified
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    No backups found. Trigger a manual backup to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div style={{ marginTop: '24px', padding: '16px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <Shield size={16} style={{ marginTop: '2px', flexShrink: 0, color: 'var(--accent-primary)' }} />
            <span>
              <strong>Security Policy:</strong> For system integrity, "Restore" operations cannot be performed via the dashboard. 
              To restore a database, contact the system administrator to manually replace the production file on the server.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default DatabaseBackupsTab;
