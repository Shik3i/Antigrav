import React from 'react';

const TeamMappingsTab = ({
    mappings,
    originalCode,
    onOriginalCodeChange,
    polymarketCode,
    onPolymarketCodeChange,
    onAddMapping,
    onDeleteMapping,
    polymarketSettings,
    onTogglePolymarketAdd
}) => {
    return (
        <div className="animate-fade-in">
            {/* Polymarket Global Permissions */}
            <div className="glass-card" style={{ padding: '32px', marginBottom: '32px', borderLeft: '4px solid var(--accent-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: '0 0 8px 0' }}>Polymarket Global Permissions</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                            Steuere, wer neue Polymarket-Wetten über einen Link hinzufügen darf.
                        </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.03)', padding: '12px 20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 600, color: polymarketSettings.allowUsersToAdd ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                            {polymarketSettings.allowUsersToAdd ? 'Alle registrierten User' : 'Nur Superadmins'}
                        </span>
                        <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px' }}>
                            <input 
                                type="checkbox" 
                                checked={polymarketSettings.allowUsersToAdd}
                                onChange={onTogglePolymarketAdd}
                                style={{ opacity: 0, width: 0, height: 0 }}
                            />
                            <span className="slider round" style={{
                                position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                                backgroundColor: polymarketSettings.allowUsersToAdd ? 'var(--accent-primary)' : '#444',
                                transition: '.4s', borderRadius: '34px'
                            }}>
                                <span style={{
                                    position: 'absolute', content: '""', height: '18px', width: '18px', left: '4px', bottom: '4px',
                                    backgroundColor: 'white', transition: '.4s', borderRadius: '50%',
                                    transform: polymarketSettings.allowUsersToAdd ? 'translateX(24px)' : 'translateX(0)'
                                }}></span>
                            </span>
                        </label>
                    </div>
                </div>
            </div>

            <div className="glass-card" style={{ padding: '32px' }}>
                <h3 style={{ marginBottom: '24px' }}>Team Mappings</h3>
                <form onSubmit={onAddMapping} style={{ display: 'flex', gap: '16px', marginBottom: '32px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Original Acronym (e.g. T1)</label>
                        <input
                            type="text"
                            className="input-primary"
                            style={{ width: '100%' }}
                            value={originalCode}
                            onChange={(e) => onOriginalCodeChange(e.target.value.toUpperCase())}
                            placeholder="T1"
                            required
                        />
                    </div>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Polymarket Acronym (e.g. SK Telecom T1)</label>
                        <input
                            type="text"
                            className="input-primary"
                            style={{ width: '100%' }}
                            value={polymarketCode}
                            onChange={(e) => onPolymarketCodeChange(e.target.value)}
                            placeholder="SK Telecom T1"
                            required
                        />
                    </div>
                    <button type="submit" className="btn-primary" style={{ padding: '12px 24px' }}>Add Mapping</button>
                </form>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Original</th>
                                <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Polymarket</th>
                                <th style={{ padding: '12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {mappings.map(row => (
                                <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '12px', fontWeight: 600 }}>{row.originalCode}</td>
                                    <td style={{ padding: '12px' }}>{row.polymarketCode}</td>
                                    <td style={{ padding: '12px', textAlign: 'right' }}>
                                        <button className="btn-ghost" style={{ padding: '4px 8px', color: '#ef4444' }} onClick={() => onDeleteMapping(row.id)}>Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TeamMappingsTab;
