import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trophy, Coins, TrendingUp, ShieldCheck } from 'lucide-react';

const GameLeaderboards = () => {
    const [leaderboards, setLeaderboards] = useState({ highscores: [], cumulative: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchLeaderboards = async () => {
            try {
                const res = await axios.get('/api/games/leaderboard?gameId=koala_flap');
                setLeaderboards(res.data);
                setLoading(false);
            } catch (err) {
                console.error('Failed to fetch leaderboards:', err);
                setError('Failed to load leaderboards. Please try again later.');
                setLoading(false);
            }
        };

        fetchLeaderboards();
    }, []);

    if (loading) return <div className="flex-center" style={{ height: '60vh' }}>Loading Leaderboards...</div>;
    if (error) return <div className="flex-center" style={{ height: '60vh', color: '#ef4444' }}>{error}</div>;

    const renderTable = (data, title, icon, type) => (
        <div className="glass-panel" style={{ flex: 1, padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)' }}>
                    {icon}
                </div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>{title}</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {data.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5 }}>No entries yet. Be the first!</div>
                ) : (
                    data.map((row, index) => (
                        <div key={index} className="flex-between" style={{ 
                            padding: '12px 16px', 
                            background: index === 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255,255,255,0.03)',
                            borderRadius: '10px',
                            border: index === 0 ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid rgba(255,255,255,0.05)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ 
                                    width: '24px', 
                                    height: '24px', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    borderRadius: '50%',
                                    background: index < 3 ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.1)',
                                    fontSize: '0.75rem',
                                    fontWeight: 700
                                }}>
                                    {index + 1}
                                </span>
                                <span style={{ fontWeight: 500 }}>{row.displayName}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: index === 0 ? '#f59e0b' : 'inherit' }}>
                                {type === 'score' ? row.highscore : row.totalEarned.toLocaleString()}
                                {type === 'coins' && <Coins size={14} />}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <h1 style={{ fontSize: '2.5rem', marginBottom: '12px', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Game Leaderboards
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
                    The absolute legends of KoalaFlap.
                </p>
            </div>

            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                {renderTable(leaderboards.highscores, "Highest Streak", <TrendingUp size={20} color="#3b82f6" />, 'score')}
                {renderTable(leaderboards.cumulative, "Total Coins Earned", <Trophy size={20} color="#f59e0b" />, 'coins')}
            </div>

            <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid rgba(16, 185, 129, 0.2)', background: 'rgba(16, 185, 129, 0.05)' }}>
                <ShieldCheck size={24} color="#10b981" />
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    <strong>Fair Play Guaranteed:</strong> All game results are verified server-side. Highscores are only saved for registered users.
                </p>
            </div>
        </div>
    );
};

export default GameLeaderboards;
