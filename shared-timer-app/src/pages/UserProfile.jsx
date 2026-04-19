import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, History, Trophy, Clock, Calendar, Coins, Medal } from 'lucide-react';
import Avatar from '../components/Avatar';
import { useAuth } from '../context/AuthContext';

const formatCoins = (cents) => (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatLastActive = (timestamp) => {
    if (!timestamp) return 'Unbekannt';
    
    // SQLite CURRENT_TIMESTAMP is 'YYYY-MM-DD HH:MM:SS' (UTC)
    const utcTimestamp = timestamp.includes('Z') || timestamp.includes('+') 
        ? timestamp 
        : timestamp.replace(' ', 'T') + 'Z';
    
    const now = new Date();
    const lastActive = new Date(utcTimestamp);
    const diffInSeconds = Math.floor((now.getTime() - lastActive.getTime()) / 1000);


    if (diffInSeconds < 60) return 'Gerade online';
    if (diffInSeconds < 3600) return `Vor ${Math.floor(diffInSeconds / 60)} Min.`;
    if (diffInSeconds < 86400) return `Vor ${Math.floor(diffInSeconds / 3600)} Std.`;
    if (diffInSeconds < 172800) return 'Gestern';
    return lastActive.toLocaleDateString();
};

const UserProfile = () => {
    const { user: authUser } = useAuth();
    const { username } = useParams();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                setLoading(true);
                const res = await fetch(`/api/users/profile/${username}`);
                if (!res.ok) {
                    if (res.status === 404) throw new Error('User not found');
                    throw new Error('Failed to load profile');
                }
                const data = await res.json();
                setProfile(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [username]);

    if (loading) return <div className="flex-center" style={{ height: '60vh' }}>Loading...</div>;
    if (error) return <div className="flex-center" style={{ height: '60vh', color: '#ef4444' }}>{error}</div>;

    const { user, recentBets, recentTransactions } = profile;

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <button className="btn-ghost" onClick={() => navigate(-1)} style={{ alignSelf: 'flex-start', padding: '8px 16px', background: 'rgba(255,255,255,0.05)' }}>
                <ArrowLeft size={16} /> Back
            </button>

            {/* Profile Header */}
            <div className="glass-panel animate-fade-in" style={{ padding: '40px', borderRadius: '24px', display: 'flex', gap: '32px', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Avatar user={user} size={100} style={{ border: '4px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} />
                <div>
                    <h1 style={{ margin: '0 0 12px 0', fontSize: '2.5rem', display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {user.displayName}
                        <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', fontWeight: 500 }}>@{user.username}</span>
                    </h1>
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Calendar size={14} /> Angemeldet: {new Date(user.joinedAt).toLocaleDateString()}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: 600 }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: (new Date() - new Date(user.lastActive) < 60000) ? '#10b981' : '#71717a', boxShadow: (new Date() - new Date(user.lastActive) < 60000) ? '0 0 10px #10b981' : 'none' }}></div>
                            Zuletzt online: {formatLastActive(user.lastActive)}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontWeight: 600, background: 'rgba(245, 158, 11, 0.1)', padding: '2px 10px', borderRadius: '10px' }}>
                            <Coins size={14} /> {formatCoins(user.koala_balance || 0)} KC
                        </span>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
                {/* Bets */}
                <div style={{ flex: 1, minWidth: '340px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontSize: '1.25rem' }}><Trophy size={20} color="#3b82f6" /> Recent Bets</h3>
                    <div className="glass-panel" style={{ padding: '0', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                        {recentBets.length === 0 ? (
                            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px' }}>No recent bets.</div>
                        ) : (
                            recentBets.slice(0, 10).map((bet, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', borderBottom: i < 9 ? '1px solid rgba(255,255,255,0.05)' : 'none', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{bet.matchName}</span>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Chosen: {bet.chosenTeam}</span>
                                    </div>
                                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontWeight: 700, color: bet.status === 'won' ? '#10b981' : bet.status === 'lost' ? '#ef4444' : '#f59e0b', textTransform: 'uppercase', fontSize: '0.85rem' }}>{bet.status}</span>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{formatCoins(bet.stake || 0)} KC</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Coin History */}
                <div style={{ flex: 1, minWidth: '340px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontSize: '1.25rem' }}><History size={20} color="#10b981" /> Coin History</h3>
                    <div className="glass-panel" style={{ padding: '0', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                        {recentTransactions.length === 0 ? (
                            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px' }}>No transactions.</div>
                        ) : (
                            recentTransactions.map((tx, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: i < recentTransactions.length-1 ? '1px solid rgba(255,255,255,0.05)' : 'none', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-main)' }}>{tx.reason}</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} />{new Date(tx.created_at).toLocaleString()}</span>
                                    </div>
                                    <span style={{ fontWeight: 700, fontSize: '1.1rem', color: tx.amount > 0 ? '#10b981' : '#ef4444', background: tx.amount > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', padding: '4px 12px', borderRadius: '8px' }}>
                                        {tx.amount > 0 ? '+' : ''}{formatCoins(tx.amount || 0)}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Achievements Section (Only for self or Admins) */}
            {(authUser?.username === username || authUser?.is_superadmin) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontSize: '1.25rem' }}>
                        <Medal size={20} color="#ec4899" /> Abgeschlossene Achievements
                    </h3>
                    <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', border: '1px solid rgba(236, 72, 153, 0.2)', background: 'rgba(236, 72, 153, 0.02)' }}>
                        {profile.claimedAchievements && profile.claimedAchievements.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                                {profile.claimedAchievements.map((ach, i) => (
                                    <div key={i} style={{ 
                                        display: 'flex', alignItems: 'center', gap: '12px', 
                                        padding: '12px', background: 'rgba(255,255,255,0.03)', 
                                        borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' 
                                    }}>
                                        <div style={{ color: '#ec4899', background: 'rgba(236, 72, 153, 0.1)', padding: '8px', borderRadius: '8px' }}>
                                            <Trophy size={18} />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{ach.title}</span>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                {new Date(ach.claimedAt).toLocaleDateString()} {new Date(ach.claimedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px' }}>
                                Noch keine Achievements abgeschlossen. 🐨
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserProfile;
