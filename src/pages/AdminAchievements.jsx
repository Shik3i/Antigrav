import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Save, Info, Trophy, Medal, Award, Crown, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CHAIN_META = {
    timer:     { label: '⏱️ Timer-Abschlüsse',     color: '#3b82f6' },
    esports:   { label: '⚔️ Esports-Wetten',        color: '#a855f7' },
    koalaflap: { label: '🎮 KoalaFlap Minigame',    color: '#f59e0b' },
    casino:    { label: '🎰 Casino & Minigames',    color: '#10b981' },
    social:    { label: '🤝 Soziales',              color: '#6366f1' },
    economy:   { label: '💰 Wirtschaft',            color: '#f59e0b' },
    special:   { label: '🌟 Spezial-Erfolge',        color: '#ec4899' },
};

const AdminAchievements = () => {
    const { token, user } = useAuth();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [multipliers, setMultipliers] = useState({}); // id -> multiplier
    const [message, setMessage] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/admin/achievements/settings', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Failed to load settings');
                const json = await res.json();
                setData(json);
                const initial = {};
                json.milestones.forEach(m => { initial[m.id] = m.multiplier; });
                setMultipliers(initial);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [token]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = Object.entries(multipliers).map(([id, multiplier]) => ({ id, multiplier: parseFloat(multiplier) }));
            const res = await fetch('/api/admin/achievements/settings', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ multipliers: payload })
            });
            if (!res.ok) throw new Error('Update failed');
            setMessage({ type: 'success', text: '✅ Multiplikatoren erfolgreich gespeichert!' });
            setTimeout(() => setMessage(null), 3000);
        } catch (err) {
            setMessage({ type: 'error', text: '❌ Fehler beim Speichern: ' + err.message });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex-center" style={{ height: '60vh' }}>Lade Einstellungen...</div>;
    if (!data) return <div className="flex-center">Fehler beim Laden der Daten.</div>;

    // Grouping logic for Admin (Show all tiers)
    const grouped = {};
    data.milestones.forEach(m => {
        const cat = m.chain.includes('_') ? m.chain.split('_')[0] : m.chain;
        if (!grouped[cat]) grouped[cat] = {};
        if (!grouped[cat][m.chain]) grouped[cat][m.chain] = [];
        grouped[cat][m.chain].push(m);
    });

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '100px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button className="btn-ghost" onClick={() => navigate('/achievements')} style={{ padding: '8px' }}><ArrowLeft /></button>
                    <h1 style={{ margin: 0, fontSize: '2rem' }}>Achievement Management</h1>
                </div>
                <button 
                    className="btn-primary" 
                    onClick={handleSave} 
                    disabled={saving}
                    style={{ background: '#10b981', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}
                >
                    <Save size={20} /> {saving ? 'Speichere...' : 'Alle Änderungen speichern'}
                </button>
            </div>

            {message && (
                <div style={{ 
                    padding: '1rem', borderRadius: '12px', textAlign: 'center', fontWeight: 600,
                    background: message.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: message.type === 'success' ? '#10b981' : '#fca5a5',
                    border: `1px solid ${message.type === 'success' ? '#10b98150' : '#ef444450'}`
                }}>
                    {message.text}
                </div>
            )}

            <div className="glass-panel" style={{ border: '1px solid #3b82f650', background: 'rgba(59, 130, 246, 0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#3b82f6' }}>
                    <Info size={24} />
                    <div>
                        <p style={{ margin: 0, fontWeight: 700 }}>Admin Hinweis</p>
                        <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.8 }}>
                            Der Reward berechnet sich aus: <strong>Basis (1000 KC) × Individueller Multiplikator</strong>. 
                            Der globale Standard-Multiplikator liegt aktuell bei <strong>{data.globalMultiplier}</strong>.
                        </p>
                    </div>
                </div>
            </div>

            {/* Render Categories */}
            {Object.entries(CHAIN_META).map(([catKey, meta]) => {
                const categoryChains = grouped[catKey];
                if (!categoryChains) return null;

                return (
                    <div key={catKey} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <h2 style={{ margin: 0, color: meta.color, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem' }}>
                            {meta.label}
                        </h2>

                        {Object.entries(categoryChains).map(([chainId, milestones]) => {
                            const isStandalone = milestones.length === 1;
                            
                            return (
                                <div key={chainId} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {!isStandalone && (
                                        <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', opacity: 0.5, fontWeight: 700, letterSpacing: '0.1em' }}>
                                            Kette: {chainId}
                                        </div>
                                    )}
                                    
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                                        {milestones.map(m => (
                                            <div key={m.id} style={{ 
                                                flex: isStandalone ? '1' : '0 0 auto',
                                                minWidth: '280px',
                                                background: 'rgba(255,255,255,0.03)',
                                                padding: '16px',
                                                borderRadius: '12px',
                                                border: '1px solid rgba(255,255,255,0.05)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '12px'
                                            }}>
                                                <div style={{ display: 'flex', gap: '12px' }}>
                                                    <div style={{ color: meta.color, background: `${meta.color}15`, padding: '8px', borderRadius: '8px', height: 'fit-content' }}>
                                                        <Trophy size={20} />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{m.title}</div>
                                                        <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>Req: {m.requiredCount} | ID: {m.id}</div>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    <label style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.7 }}>Reward Multiplikator:</label>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <input 
                                                            type="number" 
                                                            step="0.1"
                                                            min="0"
                                                            value={multipliers[m.id]} 
                                                            onChange={(e) => setMultipliers({...multipliers, [m.id]: e.target.value})}
                                                            style={{ 
                                                                background: 'rgba(0,0,0,0.3)', 
                                                                border: '1px solid rgba(255,255,255,0.1)',
                                                                color: 'white',
                                                                padding: '8px 12px',
                                                                borderRadius: '8px',
                                                                width: '80px',
                                                                textAlign: 'center',
                                                                fontSize: '1rem',
                                                                fontWeight: 700
                                                            }}
                                                        />
                                                        <span style={{ fontSize: '0.85rem', opacity: 0.5 }}>× 1000 KC = </span>
                                                        <span style={{ fontWeight: 700, color: '#f59e0b' }}>
                                                            {Math.round(1000 * (multipliers[m.id] || 0)).toLocaleString()} KC
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );
            })}

            {/* Floating Save Button Mobile? No, just the one at the top is fine for now per user visual Identical request usually means clean top button */}
        </div>
    );
};

export default AdminAchievements;
