import React, { useEffect, useState } from 'react';
import { Trophy, Medal, Award } from 'lucide-react';

const Highscores = () => {
    const [scores, setScores] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/highscores')
            .then((res) => res.json())
            .then((data) => {
                setScores(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error('Failed to fetch highscores', err);
                setLoading(false);
            });
    }, []);

    const getRankIcon = (index) => {
        switch (index) {
            case 0: return <Trophy color="#fbbf24" size={24} />; // Gold
            case 1: return <Medal color="#9ca3af" size={24} />; // Silver
            case 2: return <Award color="#b45309" size={24} />; // Bronze
            default: return <span style={{ width: '24px', display: 'inline-block', textAlign: 'center', fontWeight: 'bold', color: 'var(--text-muted)' }}>{index + 1}</span>;
        }
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 0' }}>

            <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                <h1 style={{ fontSize: '3rem', marginBottom: '16px', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-flex', alignItems: 'center', gap: '16px' }}>
                    <Trophy color="var(--accent-secondary)" size={40} />
                    Global Highscores
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
                    The most disciplined and focused users on the server.
                    <br />Calculated by total number of completed timers.
                </p>
            </div>

            <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading top ranks...</div>
                ) : scores.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No completed timers yet across the server!</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)' }}>
                                <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600, width: '80px' }}>Rank</th>
                                <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600 }}>Name</th>
                                <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Sessions Completed</th>
                            </tr>
                        </thead>
                        <tbody>
                            {scores.map((score, index) => {
                                const maxScore = scores[0]?.totalCompleted || 1;
                                const barWidth = (score.totalCompleted / maxScore) * 100;

                                return (
                                    <tr key={index} style={{ borderBottom: index < scores.length - 1 ? '1px solid var(--border-color)' : 'none', transition: 'background 0.2s' }}>
                                        <td style={{ padding: '16px 24px', display: 'flex', alignItems: 'center' }}>
                                            {getRankIcon(index)}
                                        </td>
                                        <td style={{ padding: '16px 24px' }}>
                                            <div style={{ fontWeight: 500, marginBottom: '4px' }}>{score.displayName}</div>
                                            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                                <div style={{ width: `${barWidth}%`, height: '100%', background: 'var(--accent-gradient)', borderRadius: '2px' }}></div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 700, fontSize: '1.1rem', color: 'var(--accent-primary)' }}>
                                            {score.totalCompleted}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

        </div>
    );
};

export default Highscores;
