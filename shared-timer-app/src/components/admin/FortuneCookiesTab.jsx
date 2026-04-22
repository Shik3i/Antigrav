import React from 'react';
import * as LucideIcons from 'lucide-react';

const FortuneCookiesTab = ({
    fortunesDictionary,
    onFetch,
    fortunesBulkInput,
    onSetBulkInput,
    onBulkImport,
    isImportingFortunes,
    fortuneFilterUsed,
    onSetFilterUsed,
    fortuneFilterUnused,
    onSetFilterUnused,
    fortuneSearch,
    onSetSearch,
    onDelete,
    fortuneDisplayLimit,
    onSetDisplayLimit
}) => {
    const filtered = fortunesDictionary
        .filter(f => !fortuneSearch || f.text.toLowerCase().includes(fortuneSearch.toLowerCase()))
        .filter(f => !fortuneFilterUsed || f.usage_count > 0)
        .filter(f => !fortuneFilterUnused || f.usage_count === 0);
    
    const displayed = filtered.slice(0, fortuneDisplayLimit);

    return (
        <div className="animate-fade-in">
            <div className="glass-card" style={{ padding: '32px', marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '10px', borderRadius: '12px', display: 'flex' }}>
                                <LucideIcons.Cookie size={24} color="#f59e0b" />
                            </div>
                            Daily Fortune Cookie Management ({fortunesDictionary.length})
                        </h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '6px' }}>
                            Import and manage sarcastic slogans for the daily login feature.
                        </p>
                    </div>
                    <button className="btn-secondary" onClick={onFetch}>
                        <LucideIcons.RefreshCcw size={16} style={{ marginRight: '8px' }} /> Refresh
                    </button>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', marginBottom: '32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px' }}>
                        <div style={{ flex: 1 }}>
                            <h4 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', fontWeight: 600 }}>Bulk Import (AI Generated JSON)</h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                                Paste the JSON array from the Python script here. New entries will be added instantly.
                            </p>
                            <textarea 
                                className="input-primary"
                                style={{ width: '100%', minHeight: '100px', fontFamily: 'monospace', fontSize: '0.85rem', marginBottom: '12px', resize: 'vertical' }}
                                placeholder='["Spruch 1", "Spruch 2", ...]'
                                value={fortunesBulkInput}
                                onChange={(e) => onSetBulkInput(e.target.value)}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button 
                                    className="btn-primary" 
                                    onClick={onBulkImport}
                                    disabled={isImportingFortunes || !fortunesBulkInput.trim()}
                                    style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', padding: '10px 24px', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.2)' }}
                                >
                                    {isImportingFortunes ? 'Importing...' : 'Start Bulk Import'}
                                </button>
                            </div>
                        </div>
                        <div style={{ width: '280px', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <h5 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Inventory Stats</h5>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Total Pool:</span>
                                    <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{fortunesDictionary.length}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Ever Opened:</span>
                                    <span style={{ fontWeight: 700, color: '#3b82f6' }}>{fortunesDictionary.filter(f => f.usage_count > 0).length}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Never Used:</span>
                                    <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{fortunesDictionary.filter(f => f.usage_count === 0).length}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '20px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px', gap: '4px' }}>
                            <button 
                                className={!fortuneFilterUsed && !fortuneFilterUnused ? 'btn-primary' : 'btn-ghost'} 
                                style={{ fontSize: '0.75rem', padding: '6px 12px', borderRadius: '6px' }}
                                onClick={() => { onSetFilterUsed(false); onSetFilterUnused(false); }}
                            >
                                All
                            </button>
                            <button 
                                className={fortuneFilterUsed ? 'btn-primary' : 'btn-ghost'} 
                                style={{ fontSize: '0.75rem', padding: '6px 12px', borderRadius: '6px' }}
                                onClick={() => { onSetFilterUsed(true); onSetFilterUnused(false); }}
                            >
                                Used
                            </button>
                            <button 
                                className={fortuneFilterUnused ? 'btn-primary' : 'btn-ghost'} 
                                style={{ fontSize: '0.75rem', padding: '6px 12px', borderRadius: '6px' }}
                                onClick={() => { onSetFilterUnused(true); onSetFilterUsed(false); }}
                            >
                                Unused
                            </button>
                        </div>
                    </div>

                    <div style={{ position: 'relative', width: '350px' }}>
                        <LucideIcons.Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                        <input 
                            type="text" 
                            className="input-primary" 
                            placeholder="Suche Sprüche oder Keywords..." 
                            style={{ width: '100%', paddingLeft: '44px', borderRadius: '10px' }}
                            value={fortuneSearch}
                            onChange={(e) => onSetSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div style={{ width: '100%', overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)' }}>
                    <table className="admin-table" style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <th style={{ width: '80px', padding: '16px', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>ID</th>
                                <th style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>Slogan Text</th>
                                <th style={{ width: '140px', padding: '16px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Öffnungen</th>
                                <th style={{ width: '100px', padding: '16px', borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayed.map(f => (
                                <tr key={f.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                    <td style={{ padding: '16px', opacity: 0.4, fontSize: '0.8rem', fontFamily: 'monospace' }}>#{f.id}</td>
                                    <td style={{ padding: '16px', fontWeight: 500, fontSize: '0.95rem', lineHeight: 1.5, color: '#f1f5f9' }}>{f.text}</td>
                                    <td style={{ padding: '16px', textAlign: 'center' }}>
                                        <span style={{ 
                                            padding: '4px 12px', 
                                            borderRadius: '20px', 
                                            fontSize: '0.75rem',
                                            fontWeight: 800,
                                            letterSpacing: '0.02em',
                                            background: f.usage_count > 0 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.03)',
                                            color: f.usage_count > 0 ? '#3b82f6' : 'var(--text-muted)',
                                            border: f.usage_count > 0 ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid transparent'
                                        }}>
                                            {f.usage_count} Openings
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'right' }}>
                                        <button 
                                            className="btn-ghost" 
                                            style={{ color: '#ef4444', padding: '8px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.05)' }}
                                            title="Delete Slogan"
                                            onClick={() => onDelete(f.id)}
                                        >
                                            <LucideIcons.Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length > fortuneDisplayLimit && (
                                <tr>
                                    <td colSpan="4" style={{ padding: '24px', textAlign: 'center', background: 'rgba(255,255,255,0.01)' }}>
                                        <div style={{ marginBottom: '12px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                            Zeige {fortuneDisplayLimit} von {filtered.length} Ergebnissen
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                                            <button 
                                                className="btn-secondary" 
                                                style={{ padding: '8px 24px' }}
                                                onClick={() => onSetDisplayLimit(prev => prev + 100)}
                                            >
                                                + 100 weitere laden
                                            </button>
                                            <button 
                                                className="btn-ghost" 
                                                style={{ padding: '8px 24px', color: 'var(--accent-primary)' }}
                                                onClick={() => onSetDisplayLimit(filtered.length)}
                                            >
                                                Alle anzeigen
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan="4" style={{ padding: '64px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        <div style={{ opacity: 0.1, marginBottom: '16px' }}>
                                            <LucideIcons.Cookie size={64} />
                                        </div>
                                        <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>Keine passenden Sprüche gefunden.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default FortuneCookiesTab;
