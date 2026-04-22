import React from 'react';
import { Dices } from 'lucide-react';

const BetsManagementTab = ({
    betsList,
    onFetch,
    onTriggerResolver,
    onUpdateStatus,
    formatDate
}) => {
    return (
        <div className="glass-card animate-fade-in" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Dices size={24} color="#fbbf24" />
                        Wett-Verwaltung ({betsList.length})
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '8px', maxWidth: '600px' }}>
                        Hier kannst du alle getätigten Wetten einsehen, und bei Bedarf manuell das Ergebnis überschreiben. 
                        Das Ändern eines Status korrigiert den Kontostand des Users automatisch.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn-secondary" onClick={onFetch}>Aktualisieren</button>
                    <button className="btn-primary" style={{ background: '#a855f7', color: 'white' }} onClick={onTriggerResolver}>
                        Resolver manuell starten
                    </button>
                </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '12px', color: 'var(--text-muted)' }}>User</th>
                            <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Match / Team</th>
                            <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Stake / Odds</th>
                            <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Status</th>
                            <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Date</th>
                            <th style={{ padding: '12px', textAlign: 'right', color: 'var(--text-muted)' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {betsList.map(bet => {
                            let statusColor = '#9ca3af';
                            let statusBg = 'rgba(255,255,255,0.05)';
                            let statusLabel = 'Offen';
                            if (bet.status === 'won') {
                                statusColor = '#22c55e';
                                statusBg = 'rgba(34,197,94,0.1)';
                                statusLabel = 'Gewonnen';
                            } else if (bet.status === 'lost') {
                                statusColor = '#ef4444';
                                statusBg = 'rgba(239,68,68,0.1)';
                                statusLabel = 'Verloren';
                            } else if (bet.status === 'canceled') {
                                statusColor = '#fbbf24';
                                statusBg = 'rgba(251,191,36,0.1)';
                                statusLabel = 'Storniert';
                            }

                            return (
                                <tr key={bet.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '12px' }}>
                                        <div style={{ fontWeight: 600 }}>{bet.userName || 'Unknown'}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {bet.userId}</div>
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        <div style={{ fontWeight: 600 }}>{bet.chosenTeam}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{bet.matchName}</div>
                                        {bet.polymarketTeam && <div style={{ fontSize: '0.7rem', color: '#a855f7' }}>Exact: {bet.polymarketTeam}</div>}
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span style={{ fontWeight: 600, color: '#22c55e' }}>{bet.stake}</span>
                                            <span style={{ color: 'var(--text-muted)' }}>@</span>
                                            <span style={{ fontWeight: 600, color: '#3b82f6' }}>{bet.odds.toFixed(2)}</span>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            Payout: <span style={{ color: '#fbbf24' }}>{Math.floor(bet.stake * bet.odds)}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        <span style={{
                                            padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                                            color: statusColor, background: statusBg, border: `1px solid ${statusColor}40`
                                        }}>
                                            {statusLabel}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>{formatDate(bet.createdAt)}</td>
                                    <td style={{ padding: '12px', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                            {bet.status !== 'open' && (
                                                <button className="btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem' }} onClick={() => onUpdateStatus(bet.id, 'open')} title="Revert to Open">
                                                    Zurücksetzen
                                                </button>
                                            )}
                                            {bet.status !== 'won' && (
                                                <button className="btn-ghost" style={{ padding: '6px 10px', fontSize: '0.75rem', background: 'rgba(34,197,94,0.1)', color: '#22c55e' }} onClick={() => onUpdateStatus(bet.id, 'won')} title="Mark as Won">
                                                    Gewonnen
                                                </button>
                                            )}
                                            {bet.status !== 'lost' && (
                                                <button className="btn-ghost" style={{ padding: '6px 10px', fontSize: '0.75rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444' }} onClick={() => onUpdateStatus(bet.id, 'lost')} title="Mark as Lost">
                                                    Verloren
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {betsList.length === 0 && (
                            <tr><td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Keine Wetten gefunden.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default BetsManagementTab;
