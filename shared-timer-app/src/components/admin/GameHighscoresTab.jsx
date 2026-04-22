import React from 'react';
import { Gamepad2, Trash2 } from 'lucide-react';

const GameHighscoresTab = ({
    gameScores,
    onFetch,
    onDelete,
    formatDate
}) => {
    return (
        <div className="glass-card animate-fade-in" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Gamepad2 size={24} color="var(--accent-primary)" />
                    Game Highscores (KoalaFlap)
                </h3>
                <button className="btn-secondary" onClick={onFetch}>Refresh</button>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '12px', color: 'var(--text-muted)' }}>User</th>
                            <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Score (Pipes)</th>
                            <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Coins Earned</th>
                            <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Date</th>
                            <th style={{ padding: '12px', textAlign: 'right', color: 'var(--text-muted)' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {gameScores.map(gs => (
                            <tr key={gs.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '12px' }}>
                                    <div style={{ fontWeight: 600 }}>{gs.displayName}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{gs.username}</div>
                                </td>
                                <td style={{ padding: '12px', fontWeight: 700, color: 'var(--accent-primary)' }}>{gs.score}</td>
                                <td style={{ padding: '12px' }}>{(gs.coinsEarned / 100).toFixed(2)} K</td>
                                <td style={{ padding: '12px' }}>{formatDate(gs.createdAt)}</td>
                                <td style={{ padding: '12px', textAlign: 'right' }}>
                                    <button className="btn-ghost" style={{ color: '#ef4444' }} onClick={() => onDelete(gs.id)}>
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {gameScores.length === 0 && (
                            <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No game scores found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default GameHighscoresTab;
