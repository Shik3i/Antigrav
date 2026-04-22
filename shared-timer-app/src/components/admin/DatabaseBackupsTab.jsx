import React, { useState } from 'react';
import { Database, Plus, RefreshCw, Shield, Clock, FileText, Info, Trash2 } from 'lucide-react';

/**
 * Dumb Component: DatabaseBackupsTab
 * Displays separate tables for automatic rotated backups and manual persistent snapshots.
 */
const DatabaseBackupsTab = ({ 
  automaticBackups,
  manualBackups,
  autoBackupEnabled, 
  onTriggerBackup, 
  onToggleAutoBackup, 
  onDeleteBackup,
  onRefresh, 
  formatDate,
  isLoading 
}) => {
  const [backupNote, setBackupNote] = useState('');
  
  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleManualBackup = () => {
    onTriggerBackup(backupNote);
    setBackupNote('');
  };

  const renderTable = (data, emptyMessage, isManual = false) => (
    <div className="custom-table-container">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Creation Date</th>
            <th>Filename</th>
            <th>Size</th>
            <th style={{ textAlign: 'right' }}>{isManual ? 'Actions' : 'Status'}</th>
          </tr>
        </thead>
        <tbody>
          {data && data.length > 0 ? (
            data.map((backup, idx) => (
              <tr key={backup.filename || idx}>
                <td style={{ fontWeight: 600 }}>{formatDate(backup.createdAt)}</td>
                <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={14} />
                      {backup.filename}
                    </div>
                    {backup.note && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-primary)', fontStyle: 'italic', fontSize: '0.8rem', paddingLeft: '22px' }}>
                        <Info size={12} />
                        {backup.note}
                      </div>
                    )}
                  </div>
                </td>
                <td>{formatSize(backup.size)}</td>
                <td style={{ textAlign: 'right' }}>
                  {isManual ? (
                    <button 
                      className="btn-ghost" 
                      onClick={() => onDeleteBackup(backup.filename)}
                      style={{ color: '#ef4444', padding: '8px' }}
                      title="Delete Snapshot"
                    >
                      <Trash2 size={18} />
                    </button>
                  ) : (
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
                  )}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="4" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="admin-tab-content animate-fade-in">
      {/* Hero Section / Summary */}
      <div className="glass-card" style={{ padding: '32px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Database size={28} color="var(--accent-primary)" />
              Enterprise Database Backups
            </h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '8px', maxWidth: '600px' }}>
              Multi-tiered backup system. Automatic backups are managed via GFS rotation, 
              while Manual snapshots are persistent and never pruned.
            </p>
          </div>
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
        </div>

        <div style={{ display: 'flex', gap: '12px', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '16px', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block', fontWeight: 600, textTransform: 'uppercase' }}>Manual Snapshot Note (Optional)</label>
            <input 
              type="text" 
              placeholder="e.g. Before Large Data Import" 
              value={backupNote}
              onChange={(e) => setBackupNote(e.target.value)}
              style={{ width: '100%', background: 'transparent', border: 'none', color: 'white', fontSize: '1rem', outline: 'none' }}
            />
          </div>
          <button 
            className="btn-primary" 
            onClick={handleManualBackup} 
            disabled={isLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', whiteSpace: 'nowrap' }}
          >
            {isLoading ? <RefreshCw className="animate-spin" size={18} /> : <Plus size={18} />}
            Manual Snapshot
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button className="btn-ghost" onClick={onRefresh} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={16} />
          Refresh All Tiers
        </button>
      </div>

      {/* Manual Table */}
      <div className="glass-card" style={{ padding: '32px', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 24px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Shield size={22} color="var(--accent-primary)" />
          Manual Snapshots (Persistent)
        </h3>
        {renderTable(manualBackups, "No manual snapshots found. Create one with a note to secure your data state.", true)}
      </div>

      {/* Automatic Table */}
      <div className="glass-card" style={{ padding: '32px' }}>
        <h3 style={{ margin: '0 0 24px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Clock size={22} color="var(--accent-secondary)" />
          Automatic History (Rotated)
        </h3>
        {renderTable(automaticBackups, "Automatic backups will appear here based on your rotation schedule.")}
      </div>

      <div style={{ marginTop: '24px', padding: '16px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <Info size={16} style={{ marginTop: '2px', flexShrink: 0, color: 'var(--accent-primary)' }} />
          <span>
            <strong>Retention Policy:</strong> Automatic backups follow GFS (Daily/Weekly/Monthly) rotation and are pruned periodically. 
            Manual snapshots are <strong>excluded</strong> from pruning and will persist until deleted from the filesystem.
          </span>
        </p>
      </div>
    </div>
  );
};

export default DatabaseBackupsTab;
