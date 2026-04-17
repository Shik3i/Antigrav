import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useRiftDefense, TOWER_ROLES, ENEMY_PATH, SOCKETS, MAP_WIDTH, MAP_HEIGHT } from '../../context/RiftDefenseContext';
import { Coins, Heart, Skull, Play, Square, Crosshair, Map as MapIcon, RefreshCw, BarChart3 } from 'lucide-react';

const GameMap = ({ onGameOver }) => {
    const { token } = useAuth();
    const { 
        gameState, wave, lives, inGameGold, 
        enemies, projectiles, placedTowers, gameStats,
        startGame, placeTower, calculateTowerStats
    } = useRiftDefense();
    
    const [towers, setTowers] = useState([]); // from inventory
    const [teams, setTeams] = useState([]);
    const [selectedSocket, setSelectedSocket] = useState(null);
    const [hoveredTower, setHoveredTower] = useState(null); // For stats display

    // Fetch user inventory for placing
    useEffect(() => {
        const fetchInv = async () => {
            try {
                const [res, teamsRes] = await Promise.all([
                    axios.get('/api/rift-defense/inventory', { headers: { Authorization: `Bearer ${token}` } }),
                    axios.get('/api/esports/teams')
                ]);
                setTowers(res.data.towers || []);
                setTeams(teamsRes.data);
            } catch (err) { console.error('Failed to load inventory'); }
        };
        fetchInv();
    }, [token, gameState]); // Re-fetch on game state change to get updated towers

    const handlePlaceTower = (tower, role) => {
        if (!selectedSocket) return;
        
        const success = placeTower(selectedSocket.id, { ...tower, role });
        if (success) {
            setSelectedSocket(null);
        } else {
            alert('Nicht genug In-Game Gold!');
        }
    };

    const findTeamImage = (code) => {
        const team = teams.find(t => t.code === code);
        return team ? team.image : null;
    };

    const svgPath = `M ${ENEMY_PATH.map(p => `${p.x} ${p.y}`).join(' L ')}`;

    return (
        <div style={{ display: 'flex', gap: '24px' }}>
            {/* GAME BOARD */}
            <div style={{ flex: 1 }}>
                
                {/* HUD */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', background: 'rgba(0,0,0,0.4)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', gap: '24px' }}>
                        <div style={{ color: '#10b981', fontWeight: 800, fontSize: '1.2rem' }}>WELLE {wave}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontWeight: 700 }}><Heart size={18} /> {lives}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24', fontWeight: 700 }}><Coins size={18} /> {Math.floor(inGameGold)} G</div>
                    </div>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}><Skull size={14}/> {gameStats.minions} / 👹 {gameStats.bosses}</div>
                    </div>
                </div>

                {/* MAP */}
                <div style={{ position: 'relative', width: MAP_WIDTH, height: MAP_HEIGHT, background: '#0f172a', borderRadius: '16px', border: '2px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                    
                    {/* Path SVG */}
                    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                        <path d={svgPath} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="40" strokeLinejoin="round" />
                        <path d={svgPath} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" strokeDasharray="10,10" />
                    </svg>

                    {/* Sockets */}
                    {SOCKETS.map(s => {
                        const pt = placedTowers[s.id];
                        const towerStats = pt ? calculateTowerStats(pt) : null;
                        
                        return (
                            <div 
                                key={s.id}
                                onClick={() => gameState === 'playing' ? setSelectedSocket(s) : null}
                                onMouseEnter={() => pt && setHoveredTower({ ...pt, ...towerStats, socketId: s.id })}
                                onMouseLeave={() => setHoveredTower(null)}
                                style={{
                                    position: 'absolute',
                                    left: s.x, top: s.y,
                                    transform: 'translate(-50%, -50%)',
                                    width: '40px', height: '40px',
                                    borderRadius: '50%',
                                    border: pt ? `2px solid ${TOWER_ROLES[pt.role].color}` : selectedSocket?.id === s.id ? '2px solid #fbbf24' : '2px dashed rgba(255,255,255,0.3)',
                                    background: pt ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer',
                                    zIndex: 10,
                                    transition: 'all 0.2s'
                                }}
                            >
                                {pt ? (
                                    findTeamImage(pt.teamCode) ? (
                                        <img src={findTeamImage(pt.teamCode)} alt={pt.teamCode} width="24" height="24" loading="lazy" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                                    ) : (
                                        <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>{pt.teamCode}</span>
                                    )
                                ) : <Crosshair size={16} opacity={0.5} />}
                                {pt && <div style={{ position: 'absolute', bottom: '-15px', fontSize: '10px' }}>{'⭐'.repeat(pt.starLevel)}</div>}
                                
                                {/* Range Circle on Hover */}
                                {hoveredTower?.socketId === s.id && (
                                    <div style={{
                                        position: 'absolute',
                                        width: towerStats.range * 2,
                                        height: towerStats.range * 2,
                                        border: `1px solid ${TOWER_ROLES[pt.role].color}`,
                                        background: `rgba(${TOWER_ROLES[pt.role].color === '#ef4444' ? '239, 68, 68' : TOWER_ROLES[role]?.color === '#3b82f6' ? '59, 130, 246' : '16, 185, 129'}, 0.05)`, // Simplified color check
                                        borderRadius: '50%',
                                        pointerEvents: 'none',
                                        zIndex: 5
                                    }} />
                                )}
                            </div>
                        );
                    })}

                    {/* Tower Stats Tooltip */}
                    {hoveredTower && (
                        <div style={{
                            position: 'absolute',
                            left: hoveredTower.socketId <= 3 ? '180px' : 'auto',
                            right: hoveredTower.socketId > 3 ? '180px' : 'auto',
                            top: '20px',
                            background: 'rgba(15, 23, 42, 0.95)',
                            padding: '12px',
                            borderRadius: '12px',
                            border: `1px solid ${TOWER_ROLES[hoveredTower.role].color}`,
                            zIndex: 100,
                            minWidth: '150px',
                            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)'
                        }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                 {findTeamImage(hoveredTower.teamCode) && <img src={findTeamImage(hoveredTower.teamCode)} alt="" width="20" height="20" loading="lazy" style={{ width: '20px', height: '20px' }} />}
                                 <span style={{ fontWeight: 800 }}>{hoveredTower.teamCode}</span>
                                 <span style={{ color: '#fbbf24', marginLeft: 'auto' }}>{'⭐'.repeat(hoveredTower.starLevel)}</span>
                             </div>
                             <div style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                 <div style={{ color: TOWER_ROLES[hoveredTower.role].color, fontWeight: 700 }}>Rolle: {hoveredTower.role}</div>
                                 <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Schaden:</span> <span style={{ color: '#ef4444' }}>{hoveredTower.damage}</span></div>
                                 <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Frequenz:</span> <span style={{ color: '#3b82f6' }}>{(1000/hoveredTower.speed).toFixed(1)}/s</span></div>
                                 <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Reichweite:</span> <span style={{ color: '#10b981' }}>{hoveredTower.range}</span></div>
                             </div>
                        </div>
                    )}

                    {/* Enemies */}
                    {enemies.map(e => (
                        <div key={e.id} style={{
                            position: 'absolute',
                            left: e.x, top: e.y,
                            transform: 'translate(-50%, -50%)',
                            width: e.isBoss ? '30px' : '15px',
                            height: e.isBoss ? '30px' : '15px',
                            background: e.isBoss ? '#ef4444' : '#8b5cf6',
                            borderRadius: e.isBoss ? '4px' : '50%',
                            transition: 'left 0.1s linear, top 0.1s linear',
                            boxShadow: `0 0 10px ${e.isBoss ? '#ef4444' : '#8b5cf6'}`,
                            zIndex: 20
                        }}>
                            {/* HP Bar */}
                            <div style={{ position: 'absolute', top: '-8px', left: '-50%', width: '200%', height: '4px', background: 'rgba(0,0,0,0.5)' }}>
                                <div style={{ width: `${(e.hp/e.maxHp)*100}%`, height: '100%', background: '#10b981' }}/>
                            </div>
                        </div>
                    ))}

                    {/* Projectiles */}
                    {projectiles.map(p => (
                        <div key={p.id} style={{
                            position: 'absolute',
                            left: p.x, top: p.y,
                            width: '6px', height: '6px',
                            background: p.color,
                            borderRadius: '50%',
                            boxShadow: `0 0 5px ${p.color}`,
                            transform: 'translate(-50%, -50%)',
                            zIndex: 30
                        }} />
                    ))}

                    {gameState === 'idle' && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                            <button className="btn-primary" style={{ padding: '16px 32px', fontSize: '1.2rem' }} onClick={startGame}><Play size={24} /> SPIEL STARTEN</button>
                        </div>
                    )}
                    {gameState === 'gameover' && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 100, color: 'white' }}>
                            <h2 style={{ fontSize: '3rem', color: '#ef4444', marginBottom: '8px' }}>GAME OVER</h2>
                            <p style={{ fontSize: '1.2rem', marginBottom: '24px' }}>Du hast Welle {wave} erreicht.</p>
                            <button className="btn-primary" onClick={startGame}><RefreshCw size={20} /> NOCHMAL SPIELEN</button>
                        </div>
                    )}
                </div>
            </div>

            {/* SIDEBAR / INVENTORY DECK */}
            <div style={{ width: '300px', background: 'rgba(0,0,0,0.3)', borderRadius: '16px', padding: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapIcon size={20} /> Bau Menü
                </h3>

                {!selectedSocket ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', padding: '24px' }}>
                        Klicke auf einen leeren Sockel auf der Map, um einen Turm zu platzieren.
                        {gameState === 'playing' && (
                             <div style={{ marginTop: '16px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                 <Play size={14} /> Spiel läuft im Hintergrund
                             </div>
                        )}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
                        <div style={{ color: '#fbbf24', fontSize: '0.85rem', fontWeight: 600, background: 'rgba(251, 191, 36, 0.1)', padding: '8px', borderRadius: '8px' }}>
                            Sockel {selectedSocket.id} ausgewählt. Wähle Turm & Rolle (50G).
                        </div>
                        
                        {towers.filter(t => !Object.values(placedTowers).some(pt => pt.id === t.id)).length === 0 ? (
                            <div style={{ textAlign: 'center', opacity: 0.5, marginTop: '24px' }}>Keine freien Türme im Deck!</div>
                        ) : (
                            towers.filter(t => !Object.values(placedTowers).some(pt => pt.id === t.id)).map(t => (
                                <div key={t.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {findTeamImage(t.teamCode) && <img src={findTeamImage(t.teamCode)} alt={t.teamCode} width="20" height="20" loading="lazy" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />}
                                            <span style={{ fontWeight: 800 }}>{t.teamCode}</span>
                                        </div>
                                        <span style={{ color: '#fbbf24' }}>{'⭐'.repeat(t.starLevel)}</span>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                                        {Object.keys(TOWER_ROLES).map(role => (
                                            <button 
                                                key={role}
                                                onClick={() => handlePlaceTower(t, role)}
                                                onMouseEnter={() => setHoveredTower({ ...t, role, ...calculateTowerStats({...t, role}), preview: true })}
                                                onMouseLeave={() => setHoveredTower(null)}
                                                style={{ 
                                                    background: `rgba(${TOWER_ROLES[role].color === '#ef4444' ? '239, 68, 68' : TOWER_ROLES[role].color === '#3b82f6' ? '59, 130, 246' : TOWER_ROLES[role].color === '#10b981' ? '16, 185, 129' : TOWER_ROLES[role].color === '#f59e0b' ? '245, 158, 11' : '236, 72, 153'}, 0.2)`,
                                                    color: TOWER_ROLES[role].color,
                                                    border: `1px solid ${TOWER_ROLES[role].color}`,
                                                    borderRadius: '4px', padding: '4px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700
                                                }}
                                            >
                                                {role}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default GameMap;
