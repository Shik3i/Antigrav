import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useRiftDefense, TOWER_ROLES } from '../../context/RiftDefenseContext';
import { RefreshCw, Trash2, ArrowUpCircle, Info, X } from 'lucide-react';
import { playCoinJingle } from '../../utils/soundGenerator';

const Inventory = ({ refreshTrigger }) => {
    const { token, setUser } = useAuth();
    const { calculateTowerStats, getRarityColor } = useRiftDefense();
    const [towers, setTowers] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [combining, setCombining] = useState(false);
    const [selectedTowerGroup, setSelectedTowerGroup] = useState(null); // { teamCode, starLevel, count, sampleTower }

    useEffect(() => {
        fetchInventory();
    }, [refreshTrigger, token]);

    const fetchInventory = async () => {
        try {
            const [res, teamsRes] = await Promise.all([
                axios.get('/api/rift-defense/inventory', { headers: { 'Authorization': `Bearer ${token}` } }),
                axios.get('/api/esports/teams')
            ]);
            setTowers(res.data.towers || []);
            setTeams(teamsRes.data);
        } catch (err) {
            setError('Inventar konnte nicht geladen werden.');
        } finally {
            setLoading(false);
        }
    };

    const handleCombine = async (teamCode, starLevel) => {
        setCombining(true);
        try {
            await axios.post('/api/rift-defense/combine', { teamCode, starLevel }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setSelectedTowerGroup(null);
            await fetchInventory();
        } catch (err) {
            alert(err.response?.data?.error || 'Fehler beim Kombinieren');
        } finally {
            setCombining(false);
        }
    };

    const handleCombineAll = async () => {
        setCombining(true);
        try {
            const res = await axios.post('/api/rift-defense/combine-all', {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            alert(`Erfolgreich kombiniert: ${res.data.combinedCount} Upgrades!`);
            await fetchInventory();
        } catch (err) {
            alert(err.response?.data?.error || 'Fehler beim Kombinieren');
        } finally {
            setCombining(false);
        }
    };

    const handleScrap = async (towerId) => {
        if (!window.confirm('Möchtest du diesen Turm wirklich verschrotten? Du erhältst 20% des Kapselpreises zurück.')) return;
        try {
            const res = await axios.post('/api/rift-defense/scrap', { towerId }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            playCoinJingle();
            setUser(prev => ({ ...prev, koala_balance: res.data.newBalance }));
            setSelectedTowerGroup(null);
            await fetchInventory();
        } catch (err) {
            alert(err.response?.data?.error || 'Fehler beim Verschrotten');
        }
    };

    // Group inventory: { "G2": { 1: [tower, ...], 2: [...], 3: [...] } }
    const grouped = towers.reduce((acc, t) => {
        if (!acc[t.teamCode]) acc[t.teamCode] = { 1: [], 2: [], 3: [] };
        acc[t.teamCode][t.starLevel].push(t);
        return acc;
    }, {});

    const findTeamImage = (code) => {
        const team = teams.find(t => t.code === code);
        return team ? team.image : null;
    };

    const styles = {
        container: { padding: '24px 0' },
        header: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '32px'
        },
        combineAllBtn: {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            background: 'rgba(59, 130, 246, 0.1)',
            color: '#3b82f6',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontSize: '0.9rem'
        },
        grid: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
            gap: '24px'
        },
        towerIconWrapper: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
        },
        avatarContainer: (rarityColor) => ({
            position: 'relative',
            width: '84px',
            height: '84px',
            borderRadius: '50%',
            padding: '4px',
            background: `linear-gradient(135deg, ${rarityColor}44, transparent)`,
            border: `2.5px solid ${rarityColor}`,
            boxShadow: `0 0 20px ${rarityColor}33`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
        }),
        avatarImg: {
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            objectFit: 'contain',
            background: 'rgba(15, 23, 42, 0.6)',
            padding: '10px'
        },
        starBadge: {
            position: 'absolute',
            top: '-5px',
            right: '-5px',
            background: '#1e293b',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            padding: '2px 6px',
            fontSize: '10px',
            color: '#fbbf24',
            fontWeight: 800,
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
        },
        countBadge: {
            position: 'absolute',
            bottom: '-5px',
            right: '-5px',
            background: '#3b82f6',
            color: 'white',
            borderRadius: '10px',
            padding: '2px 8px',
            fontSize: '11px',
            fontWeight: 900,
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.2)'
        },
        teamLabel: {
            fontSize: '0.85rem',
            fontWeight: 700,
            color: '#f8fafc',
            textAlign: 'center'
        },
        // Modal Styles
        modalOverlay: {
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
        },
        modalContent: (rarityColor) => ({
            background: '#1e293b',
            border: `1px solid ${rarityColor}66`,
            borderRadius: '24px',
            width: '400px',
            maxWidth: '100%',
            padding: '32px',
            boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px ${rarityColor}22`,
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            position: 'relative',
            animation: 'modalEntrance 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }),
        modalHeader: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
        },
        statsGrid: {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '12px',
            background: 'rgba(255,255,255,0.03)',
            padding: '16px',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.05)'
        },
        statItem: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px'
        },
        statLabel: { fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 },
        statValue: { fontSize: '1rem', fontWeight: 800, color: '#f8fafc' },
        modalActions: {
            display: 'flex',
            gap: '12px'
        },
        modalBtn: (color, flex = 1) => ({
            flex,
            padding: '12px',
            borderRadius: '12px',
            border: 'none',
            background: color,
            color: 'white',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s'
        })
    };

    if (loading) return <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>Lade Inventar...</div>;
    if (error) return <div style={{ color: '#ef4444', padding: '24px' }}>{error}</div>;

    const renderGrid = () => {
        const icons = [];
        for (const teamCode in grouped) {
            for (let star = 1; star <= 3; star++) {
                const count = grouped[teamCode][star].length;
                if (count > 0) {
                    const sample = grouped[teamCode][star][0];
                    const rColor = getRarityColor(sample.rarityTier);
                    
                    icons.push(
                        <div 
                            key={`${teamCode}-${star}`} 
                            style={styles.towerIconWrapper}
                            className="tower-grid-item"
                            onClick={() => setSelectedTowerGroup({ teamCode, starLevel: star, count, sample })}
                        >
                            <div style={styles.avatarContainer(rColor)}>
                                <div style={styles.starBadge}>{'⭐'.repeat(star)}</div>
                                <img src={findTeamImage(teamCode)} alt={teamCode} style={styles.avatarImg} />
                                <div style={styles.countBadge}>x{count}</div>
                            </div>
                            <div style={styles.teamLabel}>{teamCode}</div>
                        </div>
                    );
                }
            }
        }
        return icons;
    };

    return (
        <div style={styles.container}>
            <style>{`
                @keyframes modalEntrance {
                    from { transform: scale(0.9); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .tower-grid-item:hover { transform: scale(1.08); }
                .tower-grid-item:hover > div { box-shadow: 0 0 30px currentColor; }
            `}</style>

            <div style={styles.header}>
                <div>
                    <h2 style={{ fontSize: '1.75rem', margin: 0, fontWeight: 800 }}>Dein Turm-Deck</h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: '#94a3b8' }}>Verwalte und kombiniere deine Teams für das Spielfeld.</p>
                </div>
                <button style={styles.combineAllBtn} onClick={handleCombineAll} disabled={combining}>
                    <RefreshCw size={18} /> Alle Kombinieren
                </button>
            </div>

            {towers.length === 0 ? (
                <div className="glass-panel" style={{ padding: '80px 24px', textAlign: 'center', color: '#94a3b8', borderRadius: '24px' }}>
                    <p style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Dein Inventar ist aktuell leer.</p>
                    <p style={{ fontSize: '0.9rem' }}>Besuche den Gacha-Shop, um neue Teams freizuschalten!</p>
                </div>
            ) : (
                <div style={styles.grid}>
                    {renderGrid()}
                </div>
            )}

            {/* Stats Modal */}
            {selectedTowerGroup && (() => {
                const { teamCode, starLevel, count, sample } = selectedTowerGroup;
                const rColor = getRarityColor(sample.rarityTier);
                const stats = calculateTowerStats({ ...sample, role: 'ADC' });
                const canCombine = count >= 3 && starLevel < 3;

                return (
                    <div style={styles.modalOverlay} onClick={() => setSelectedTowerGroup(null)}>
                        <div style={styles.modalContent(rColor)} onClick={e => e.stopPropagation()}>
                            <div style={styles.modalHeader}>
                                <div style={{...styles.avatarContainer(rColor), width: '120px', height: '120px'}}>
                                    <img src={findTeamImage(teamCode)} alt="" style={styles.avatarImg} />
                                </div>
                                <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900 }}>{teamCode}</h3>
                                <div style={{ color: '#fbbf24', fontSize: '1.2rem' }}>{'⭐'.repeat(starLevel)}</div>
                                <div style={{ 
                                    background: `${rColor}22`, 
                                    color: rColor, 
                                    padding: '4px 12px', 
                                    borderRadius: '8px', 
                                    fontSize: '0.75rem', 
                                    fontWeight: 800,
                                    textTransform: 'uppercase',
                                    border: `1px solid ${rColor}44`
                                }}>
                                    {sample.rarityTier >= 8 ? 'Legendär' : sample.rarityTier >= 5 ? 'Episch' : 'Selten'} (Tier {sample.rarityTier})
                                </div>
                            </div>

                            <div style={styles.statsGrid}>
                                <div style={styles.statItem}>
                                    <span style={styles.statLabel}>Schaden</span>
                                    <span style={{...styles.statValue, color: '#ef4444'}}>{stats.damage}</span>
                                </div>
                                <div style={styles.statItem}>
                                    <span style={styles.statLabel}>Angriff/s</span>
                                    <span style={{...styles.statValue, color: '#3b82f6'}}>{(1000/stats.speed).toFixed(1)}</span>
                                </div>
                                <div style={styles.statItem}>
                                    <span style={styles.statLabel}>Range</span>
                                    <span style={{...styles.statValue, color: '#10b981'}}>{stats.range}</span>
                                </div>
                            </div>

                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', fontStyle: 'italic' }}>
                                Stats basierend auf der ADC-Rolle. Andere Rollen verändern Reichweite und Schaden.
                            </p>

                            <div style={styles.modalActions}>
                                {canCombine && (
                                    <button 
                                        style={styles.modalBtn('#3b82f6', 2)} 
                                        onClick={() => handleCombine(teamCode, starLevel)}
                                        disabled={combining}
                                    >
                                        <ArrowUpCircle size={20} /> Upgrade (3 zu 1)
                                    </button>
                                )}
                                <button 
                                    style={styles.modalBtn('#ef4444')} 
                                    onClick={() => handleScrap(sample.id)}
                                >
                                    <Trash2 size={20} /> Verschrotten
                                </button>
                            </div>
                            
                            <button 
                                onClick={() => setSelectedTowerGroup(null)}
                                style={{
                                    position: 'absolute', top: '16px', right: '16px',
                                    background: 'none', border: 'none', color: '#94a3b8',
                                    cursor: 'pointer', padding: '4px'
                                }}
                            >
                                <X size={24} />
                            </button>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default Inventory;
