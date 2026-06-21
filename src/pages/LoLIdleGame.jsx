import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Users, Zap, Coins, Play, RefreshCw, Star, Info, ChevronRight, Gamepad2, Mic2, GraduationCap, ArrowUpCircle, XCircle, Swords, TreePine, Crosshair, Shield } from 'lucide-react';
import Avatar from '../components/Avatar';
import './LoLIdleGame.css';


const GachaRevealModal = ({ results = [], onClose, allTeams }) => {
    const canvasRef = useRef(null);
    const [revealed, setRevealed] = useState(false);
    const isBulk = results.length > 1;

    const findTeamImage = (code) => {
        if (!code) return '';
        const team = (allTeams || []).find(t => t.code?.toUpperCase() === code.toUpperCase());
        return team?.image?.replace(/^http:\/\//, 'https://') || '';
    };

    const getTeamName = (code) => (allTeams || []).find(t => t.code === code)?.name || code;

    useEffect(() => {
        if (isBulk) {
            // Faster reveal for bulk
            setTimeout(() => setRevealed(true), 500);
            return;
        }
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        // Initial Silver Layer
        ctx.fillStyle = '#b0b0b0';
        ctx.fillRect(0, 0, 250, 250);
        
        // Visual Noise
        for (let i = 0; i < 200; i++) {
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.1})`;
            ctx.fillRect(Math.random() * 250, Math.random() * 250, 2, 2);
        }

        // Auto-Scratch Animation (Spiral Inward)
        let frame = 0;
        const totalFrames = 100; 
        const interval = setInterval(() => {
            frame++;
            ctx.globalCompositeOperation = 'destination-out';
            
            const centerX = 125, centerY = 125;
            // Start at radius 200 (outside) and go to 0
            const radius = (1 - (frame / totalFrames)) * 200;
            const angle = frame * 0.4; // Slightly slower spiral
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;

            ctx.beginPath();
            ctx.arc(x, y, 60, 0, Math.PI * 2);
            ctx.fill();

            if (frame >= totalFrames) {
                clearInterval(interval);
                ctx.clearRect(0, 0, 250, 250);
                setRevealed(true);
            }
        }, 16);

        return () => clearInterval(interval);
    }, [isBulk]);

    return (
        <div className="gacha-modal-overlay">
            <div className={`gacha-modal-content glass-panel ${isBulk ? 'bulk-layout' : 'single-layout'}`}>
                {!isBulk ? (
                    <>
                        <div className="scratch-container" style={{ width: 250, height: 250, position: 'relative', margin: '0 auto' }}>
                            <div className="revealed-hero" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <img 
                                    src={findTeamImage(results[0]?.team)} 
                                    alt={results[0]?.team} 
                                    width="180"
                                    height="180"
                                    loading="lazy"
                                    decoding="async"
                                    style={{ width: 180, height: 180, objectFit: 'contain', opacity: revealed ? 1 : 0.3, transition: '0.8s' }} 
                                />
                            </div>
                           <canvas ref={canvasRef} width={250} height={250} style={{ position: 'absolute', inset: 0, borderRadius: '12px', display: revealed ? 'none' : 'block' }} />
                        </div>
                        
                        <div className={`reveal-details ${revealed ? 'visible' : 'hidden'}`}>
                            <h2 className={`rarity-text ${results[0]?.rarity.toLowerCase()}`}>{results[0]?.rarity} Team!</h2>
                            <h3>{getTeamName(results[0]?.team)}</h3>
                            <div className="reveal-role-badge">
                                <RoleIcon role={results[0]?.role} />
                                <span>{results[0]?.role}</span>
                            </div>
                           <div className="reveal-stats">
                                <span>Power: {results[0]?.stats}</span>
                            </div>
                            <button className="btn-primary" onClick={onClose}>Einsammeln</button>
                        </div>
                    </>
                ) : (
                    <div className="bulk-reveal-container">
                        <h2>Bulk Recruit Results</h2>
                        <div className="bulk-grid">
                            {results.map((res, i) => (
                                <div key={i} className={`bulk-item rarity-${res.rarity.toLowerCase()}`} style={{ animationDelay: `${i * 0.1}s` }}>
                                    <div className="bulk-rarity-dot"></div>
                                    <img src={findTeamImage(res.team)} alt={res.team} width="48" height="48" loading="lazy" decoding="async" />
                                    <div className="bulk-info">
                                        <RoleIcon role={res.role} />
                                        <span>Pow: {res.stats}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button className="btn-primary collect-all-btn" onClick={onClose}>Alle Einsammeln</button>
                    </div>
                )}
            </div>
        </div>
    );
};

const SLOT_NAMES = {
    1: 'Top Lane', 2: 'Jungle', 3: 'Mid Lane', 4: 'Bot Lane', 5: 'Support', 6: 'Coach', 7: 'Streamer'
};

const RoleIcon = ({ role, slotId = null }) => {
    // If slotId is provided, determine role from slot
    const effectiveRole = slotId && slotId <= 5 ? ROLES[slotId - 1] : role;
    
    switch (effectiveRole) {
        case 'Top': return <Swords size={20} />;
        case 'Jungle': return <TreePine size={20} />;
        case 'Mid': return <Zap size={20} />;
        case 'Bot': return <Crosshair size={20} />;
        case 'Support': return <Shield size={20} />;
        default:
            if (slotId === 6) return <GraduationCap size={20} />;
            if (slotId === 7) return <Mic2 size={20} />;
            return null;
    }
};

const ContextMenu = ({ x, y, unit, onSell, onEquip, onClose }) => {
    useEffect(() => {
        const handleClick = () => onClose();
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, [onClose]);

    return (
        <div className="context-menu" style={{ top: y, left: x }}>
            <div className="context-header">
                <strong>{unit.team_code} {unit.role}</strong>
                <span>Tier {unit.tier} • Lvl {unit.level}</span>
            </div>
            <div className="context-stats">
                <Zap size={14} /> Power: {unit.base_stats + (unit.level - 1) * 2}
            </div>
            <hr />
            <button className="context-item" onClick={() => onEquip(unit.id)}>
                <Play size={14} /> Einsetzen (Slot wählen)
            </button>
            <button className="context-item danger" onClick={() => onSell(unit.id)}>
                <Coins size={14} /> Verkaufen ($)
            </button>
        </div>
    );
};

const ROLES = ['Top', 'Jungle', 'Mid', 'Bot', 'Support'];

const getNextLevelXP = (level) => Math.floor(100 * Math.pow(level, 1.5));

const LoLIdleGame = ({ user, token }) => {
    const [profile, setProfile] = useState(null);
    const [roster, setRoster] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pulling, setPulling] = useState(false);
    const [filterRole, setFilterRole] = useState('All');
    const [sortBy, setSortBy] = useState('rarity'); // 'rarity', 'level', 'stars'
    const [revealData, setRevealData] = useState(null); // { results: [] }
    const [merging, setMerging] = useState(false);
    const [equippingUnit, setEquippingUnit] = useState(null);
    const [contextMenu, setContextMenu] = useState(null); // { x, y, unit }
    const [tournamentActive, setTournamentActive] = useState(false);
    const [tournamentResult, setTournamentResult] = useState(null);
    const [ticker, setTicker] = useState([]);
    const [playerHp, setPlayerHp] = useState(100);
    const [enemyHp, setEnemyHp] = useState(100);
    const [timer, setTimer] = useState(60);
    const [allTeams, setAllTeams] = useState([]);
    const tournamentRef = useRef(null);

    const findTeamImage = (code) => {
        if (!code) return '';
        const team = (allTeams || []).find(t => t.code?.toUpperCase() === code.toUpperCase());
        return team?.image?.replace(/^http:\/\//, 'https://') || '';
    };

    const fetchData = async () => {
        try {
            const [statusRes, teamsRes] = await Promise.all([
                fetch('/api/idle/status', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/esports/teams')
            ]);
            const statusData = await statusRes.json();
            const teamsData = await teamsRes.json();
            if (statusData.success) {
                setProfile(statusData.profile);
                setRoster(statusData.roster);
                setInventory(statusData.inventory);
            }
            // Backend returns raw array for /api/esports/teams
            if (Array.isArray(teamsData)) {
                setAllTeams(teamsData);
            } else if (teamsData.success && Array.isArray(teamsData.teams)) {
                setAllTeams(teamsData.teams);
            }
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);
    const handleGachaPull = async (useKC = false, amount = 1) => {
        if (pulling) return;
        setPulling(true);
        try {
            const res = await fetch('/api/idle/gacha', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ useKC, amount })
            });
            const data = await res.json();
            if (data.success) {
                setInventory(data.inventory);
                if (data.profile) setProfile(data.profile);
                setRevealData({ results: data.results });
            } else alert(data.error || 'Fehler');
        } catch (err) {
            console.error(err);
        } finally {
            setPulling(false);
        }
    };

    const handleMerge = async (teamCode, tier, role) => {
        if (merging || !role) return;
        setMerging(true);
        try {
            const res = await fetch('/api/idle/merge', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamCode, tier, role })
            });
            const data = await res.json();
            if (data.success) {
                setInventory(data.inventory);
                // No alert for manual merge anymore to reduce spam
            } else alert(data.error);
        } finally {
            setMerging(false);
        }
    };

    const handleMergeAll = async () => {
        if (merging) return;
        setMerging(true);
        try {
            const res = await fetch('/api/idle/merge-all', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.success && data.changes > 0) {
                setInventory(data.inventory);
            }
        } catch (err) {
            console.error('MergeAll error:', err);
        } finally {
            setMerging(false);
        }
    };

    const handleSell = async (unitId) => {
        if (!window.confirm('Einheit wirklich verkaufen?')) return;
        try {
            const res = await fetch('/api/idle/sell', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ unitId })
            });
            const data = await res.json();
            if (data.success) {
                setInventory(data.inventory);
                if (data.profile) setProfile(data.profile);
            } else alert(data.error);
        } catch (err) {
            console.error(err);
        } finally {
            setContextMenu(null); // Close context menu after selling
        }
    };

    const handleEquip = async (slotId, inventoryId) => {
        try {
            const res = await fetch('/api/idle/equip', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ slotId, inventoryId })
            });
            const data = await res.json();
            if (data.success) {
                setInventory(data.inventory);
                setRoster(data.roster);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const toggleMode = async (slotId, currentMode) => {
        const newMode = currentMode === 'Trainieren' ? 'Streamen' : 'Trainieren';
        try {
            const res = await fetch('/api/idle/roster/mode', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ slotId, mode: newMode })
            });
            if ((await res.json()).success) {
                setRoster(prev => prev.map(s => s.slot_id === slotId ? { ...s, current_mode: newMode } : s));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const startTournament = () => {
        if (roster.filter(s => s.slot_id <= 5 && s.inventory_id).length < 5) {
            alert('Lineup unvollständig! (Top, Jgl, Mid, Bot, Sup benötigt)');
            return;
        }

        // Calculate Total Power (Slots 1-5 + Coach Bonus)
        const lineup = roster.filter(s => s.slot_id >= 1 && s.slot_id <= 5 && s.inventory_id);
        const coach = roster.find(s => s.slot_id === 6 && s.inventory_id);
        
        let totalPower = lineup.reduce((sum, s) => sum + (s.display_stats || 0), 0);
        if (coach) {
            const coachLevel = coach.level || 1;
            totalPower = Math.floor(totalPower * (1 + coachLevel / 100)); // +1% pro Level
        }

        const managerLevel = profile?.level || 1;
        const enemyPower = managerLevel * 100;

        setTournamentActive(true);
        setTournamentResult(null);
        setTimer(60); setPlayerHp(100); setEnemyHp(100);
        setTicker([`Match beginnt! Team Power: ${totalPower} vs Gegner: ${enemyPower}`]);

        tournamentRef.current = setInterval(() => {
            setTimer(t => {
                if (t <= 1) {
                    clearInterval(tournamentRef.current);
                    finishTournament();
                    return 0;
                }

                // HP Ticks basierend auf Power
                if (t % 1 === 0) { // Jeden Tick
                    const ratio = totalPower / (enemyPower || 1);
                    const pDmg = Math.max(1, Math.floor(3 / ratio));
                    const eDmg = Math.max(1, Math.floor(3 * ratio));
                    
                    setPlayerHp(h => Math.max(0, h - pDmg));
                    setEnemyHp(h => Math.max(0, h - eDmg));
                }

                if (t % 5 === 0) {
                    const ratio = totalPower / (enemyPower || 1);
                    const combatMsgs = [
                        `Dein Team pusht hart! (Power: ${totalPower})`,
                        ratio > 1.2 ? "Absolute Dominanz auf der Map!" : "Der Kampf ist ausgeglichen.",
                        ratio < 0.8 ? "Vorsicht, der Gegner drängt euch zurück!" : "Gute Teamkoordination!",
                        `Top/Mid halten die Lanes...`,
                        `Bot-Lane teilt massiv aus!`
                    ];
                    setTicker([combatMsgs[Math.floor(Math.random() * combatMsgs.length)]]);
                }
                return t - 1;
            });
        }, 1000);
    };

    const finishTournament = async () => {
        const result = playerHp > enemyHp ? 'victory' : 'defeat';
        setTournamentResult(result);
        const res = await fetch('/api/idle/tournament/complete', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ result, durationS: 60 })
        });
        const data = await res.json();
        if (data.success && data.newLevel) setProfile(p => ({ ...p, level: data.newLevel }));
    };

    // Group inventory units - GRANULAR (Team + Tier + Role)
    // AND filter out equipped units to avoid ghosting
    const RARITY_POWER = { 'Legendary': 4, 'Epic': 3, 'Rare': 2, 'Common': 1 };
    
    const filteredInventory = inventory
        .filter(item => !roster.find(r => r.inventory_id === item.id))
        .filter(item => filterRole === 'All' || item.role === filterRole)
        .sort((a, b) => {
            if (sortBy === 'rarity') {
                const rDiff = RARITY_POWER[b.rarity] - RARITY_POWER[a.rarity];
                if (rDiff !== 0) return rDiff;
                return b.base_stats - a.base_stats;
            }
            if (sortBy === 'level') return b.level - a.level;
            if (sortBy === 'stars') return b.tier - a.tier;
            return 0;
        });

    const groupedInventory = filteredInventory
        .reduce((acc, item) => {
            const key = `${item.team_code}-${item.tier}-${item.role}`;
            if (!acc[key]) acc[key] = { ...item, count: 0, items: [] };
            acc[key].count++;
            acc[key].items.push(item);
            return acc;
        }, {});

    const handleRightClick = (e, unit) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, unit });
    };

    const renderTierStars = (tier) => {
       return Array.from({ length: tier }).map((_, i) => <Star key={i} size={12} fill="currentColor" />);
    };

    if (loading) return <div className="idle-loading">Synchronisiere...</div>;

    return (
        <div className="idle-game-container">
            <header className="idle-header glass-panel">
                <div className="manager-info">
                    <Trophy className="manager-icon" size={40} />
                    <div>
                        <h1>Road to Worlds</h1>
                        <p>Manager Level: <span>{profile?.level}</span></p>
                    </div>
                </div>
            </header>

            <div className="idle-content">
                <div className="idle-main-area">
                    <section className="board-section">
                        <div className="section-title"><Gamepad2 size={24} /> <h2>Starting Lineup (The Rift)</h2></div>
                        <div className="roster-grid lineup">
                            {[1, 2, 3, 4, 5].map(slotId => {
                                const slot = roster.find(s => s.slot_id === slotId) || { slot_id: slotId };
                                const teamData = allTeams.find(t => t.code === slot.team_code);
                                return (
                                    <div key={slotId} className={`roster-slot glass-panel ${slot.inventory_id ? 'occupied' : 'empty'} ${slot.inventory_id && slot.role !== ROLES[slotId-1] && slotId <= 5 ? 'malus' : ''}`}>
                                        <div className="slot-header"><RoleIcon slotId={slotId} /> <h3>{SLOT_NAMES[slotId]}</h3></div>
                                        {slot.inventory_id ? (
                                            <div className="player-card">
                                                {slot.current_mode === 'Streamen' && <div className="rec-dot-pulse" title="Live Streaming"></div>}
                                                <div className="player-avatar">
                                                    <img 
                                                        src={findTeamImage(slot.team_code)} 
                                                        alt={slot.team_code} 
                                                        width="60"
                                                        height="60"
                                                        loading="lazy"
                                                        decoding="async"
                                                        style={{ width: 60, height: 60, objectFit: 'contain', borderRadius: '8px' }} 
                                                    />
                                                    <div className="stars-overlay">{renderTierStars(slot.tier)}</div>
                                                    <div className="level-badge">Lvl {slot.level}</div>
                                                </div>
                                                <div className="player-info">
                                                    <h4 className="player-name-container">
                                                        {teamData?.name}
                                                        {slot.current_mode === 'Trainieren' && <Zap className="training-pulse" size={14} />}
                                                    </h4>
                                                    <div className="xp-bar-container"><div className="xp-bar" style={{ width: `${(slot.experience % getNextLevelXP(slot.level || 1)) / getNextLevelXP(slot.level || 1) * 100}%` }}></div></div>
                                                    <div className="power-stat">Power: {slot.display_stats}</div>
                                                </div>
                                                <div className="slot-actions">
                                                    <div className="mode-toggle-group">
                                                        <div className="mode-toggle-container">
                                                            <button className={`mode-switch-btn ${slot.current_mode === 'Trainieren' ? 'active' : ''}`} onClick={() => toggleMode(slotId, 'Trainieren')}>XP</button>
                                                            <button className={`mode-switch-btn ${slot.current_mode === 'Streamen' ? 'active' : ''}`} onClick={() => toggleMode(slotId, 'Streamen')}>Hype</button>
                                                        </div>
                                                        <span className="mode-explanation">
                                                            {slot.current_mode === 'Trainieren' ? 'Sammelt EXP für Level-Ups' : 'Generiert Hype für Upgrades'}
                                                        </span>
                                                    </div>
                                                    <button className="unequip-btn" onClick={() => handleEquip(slotId, null)} title="Unequip"><XCircle size={16} /></button>
                                                </div>
                                            </div>
                                        ) : <div className="empty-slot-msg">Empty Slot</div>}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="section-title staff-title"><Users size={24} /> <h2>Team House (Support Staff)</h2></div>
                        <div className="roster-grid staff">
                            {[6, 7].map(slotId => {
                                const slot = roster.find(s => s.slot_id === slotId) || { slot_id: slotId };
                                const teamData = allTeams.find(t => t.code === slot.team_code);
                                return (
                                    <div key={slotId} className={`roster-slot glass-panel staff-slot ${slot.inventory_id ? 'occupied' : 'empty'}`}>
                                        <div className="slot-header"><RoleIcon slotId={slotId} /> <h3>{SLOT_NAMES[slotId]}</h3></div>
                                        {slot.inventory_id ? (
                                            <div className="player-card">
                                                {slot.current_mode === 'Streamen' && <div className="rec-dot-pulse"></div>}
                                                <div className="player-avatar">
                                                    <img 
                                                        src={findTeamImage(slot.team_code)} 
                                                        alt={slot.team_code} 
                                                        width="60"
                                                        height="60"
                                                        loading="lazy"
                                                        decoding="async"
                                                        style={{ width: 60, height: 60, objectFit: 'contain', borderRadius: '8px' }} 
                                                    />
                                                    <div className="stars-overlay">{renderTierStars(slot.tier)}</div>
                                                </div>
                                                <div className="player-info">
                                                    <h4 className="player-name-container">
                                                        {teamData?.name}
                                                        {slot.current_mode === 'Trainieren' && <Zap className="training-pulse" size={14} />}
                                                    </h4>
                                                </div>
                                                <div className="slot-actions">
                                                    <div className="mode-toggle-container">
                                                        <button className={`mode-switch-btn ${slot.current_mode === 'Trainieren' ? 'active' : ''}`} onClick={() => toggleMode(slotId, 'Trainieren')}>XP</button>
                                                        <button className={`mode-switch-btn ${slot.current_mode === 'Streamen' ? 'active' : ''}`} onClick={() => toggleMode(slotId, 'Streamen')}>Hype</button>
                                                    </div>
                                                    <button className="unequip-btn" onClick={() => handleEquip(slotId, null)} title="Unequip"><XCircle size={16} /></button>
                                                </div>
                                            </div>
                                        ) : <div className="empty-slot-msg">No Personnel</div>}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                    <section className="inventory-section glass-panel">
                       <div className="section-header-row">
                            <div className="section-title">
                                <Users size={24} /> 
                                <h2>Team Inventory</h2>
                                <button className="merge-all-btn" onClick={handleMergeAll} disabled={merging}>
                                    <Zap size={16} /> Merge All
                                </button>
                            </div>
                            <div className="inventory-controls">
                                <div className="filter-group">
                                    {['All', 'Top', 'Jungle', 'Mid', 'Bot', 'Support', 'Coach', 'Streamer'].map(role => (
                                        <button 
                                            key={role} 
                                            className={`filter-pill ${filterRole === role ? 'active' : ''}`}
                                            onClick={() => setFilterRole(role)}
                                            title={role}
                                        >
                                            {role === 'All' ? 'Alle' : <RoleIcon role={role} />}
                                       </button>
                                    ))}
                                </div>
                                <div className="sort-group">
                                    <span className="sort-label">Sortieren:</span>
                                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select">
                                        <option value="rarity">Seltenheit</option>
                                        <option value="level">Level</option>
                                        <option value="stars">Sterne (Tier)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="inventory-scroll">
                               <div className="inventory-grid">
                                {Object.values(groupedInventory).map(group => {
                                    const teamData = allTeams.find(t => t.code === group.team_code);
                                    const availableToEquip = group.items.find(i => !i.is_equipped);
                                    return (
                                        <div 
                                            key={`${group.team_code}-${group.tier}-${group.role}`} 
                                            className="inventory-card"
                                            onContextMenu={(e) => handleRightClick(e, availableToEquip)}
                                        >
                                            <div className={`inv-avatar rarity-${availableToEquip?.rarity?.toLowerCase()}`}>
                                                <img 
                                                    src={findTeamImage(group.team_code)} 
                                                    alt={group.team_code} 
                                                    width="50"
                                                    height="50"
                                                    loading="lazy"
                                                    decoding="async"
                                                    style={{ width: 50, height: 50, objectFit: 'contain', borderRadius: '6px' }} 
                                                />
                                                {group.count > 1 && <span className="inv-count">x{group.count}</span>}
                                                <div className="inv-stars">{renderTierStars(group.tier)}</div>
                                                <div className="level-badge">Lvl {availableToEquip?.level || 1}</div>
                                                <div className="rarity-badge">{availableToEquip?.rarity}</div>
                                            </div>
                                            <div className="inv-info">
                                                <div className="inv-role-row">
                                                    <RoleIcon role={availableToEquip?.role} />
                                                    <span className="inv-role-text">{availableToEquip?.role}</span>
                                                </div>
                                                <div className="inv-power">Power: {availableToEquip ? (availableToEquip.base_stats + (availableToEquip.level - 1) * 2) : 0}</div>
                                            </div>
                                            {group.count >= 3 && (
                                                <button className="merge-btn-active" onClick={() => handleMerge(group.team_code, group.tier, group.role)} disabled={merging}>
                                                    <ArrowUpCircle size={14} /> Merge!
                                                </button>
                                            )}
                                            {equippingUnit === availableToEquip?.id && (
                                                <div className="slot-selector">
                                                    <div className="selector-title">Slot wählen:</div>
                                                    <div className="slot-buttons">
                                                        {[1,2,3,4,5,6,7].map(sid => (
                                                            <button 
                                                                key={sid} 
                                                                className={`slot-target-btn ${roster.find(r => r.slot_id === sid)?.inventory_id ? 'occupied' : ''}`}
                                                                onClick={() => {
                                                                    handleEquip(sid, availableToEquip.id);
                                                                    setEquippingUnit(null);
                                                                }}
                                                                title={SLOT_NAMES[sid]}
                                                            >
                                                                {SLOT_NAMES[sid].split(' ')[0]}
                                                            </button>
                                                        ))}
                                                        <button className="cancel-equip" onClick={() => setEquippingUnit(null)}><XCircle size={14} /></button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </section>
                </div>

                <div className="idle-sidebar">
                    <section className="currency-widget glass-panel">
                        <div className="side-currency-item dollars">
                            <span className="dollar-symbol">$</span>
                            <span className="currency-value">{profile?.dollars?.toLocaleString() || 0}</span>
                            <span className="currency-label">Budget</span>
                        </div>
                        <div className="side-currency-item hype">
                            <Users size={20} />
                            <span className="currency-value">{profile?.hype?.toLocaleString() || 0}</span>
                            <span className="currency-label">Hype</span>
                        </div>
                    </section>

                    <section className="gacha-section glass-panel">
                        <div className="sidebar-section-header">
                            <Users size={20} />
                            <h3>Recruiting</h3>
                        </div>
                        <p className="sidebar-desc">Investiere in erstklassige Talente!</p>
                        <div className="dual-recruit-buttons">
                            <div className="recruit-group">
                                <button className="btn-primary buy-btn side-btn" onClick={() => handleGachaPull(false, 1)} disabled={pulling}>
                                    {pulling ? <RefreshCw className="spin" size={14} /> : <span className="dollar-btn-icon">$</span>} 
                                    <span>$10k Pull</span>
                                </button>
                                <button className="btn-primary buy-btn side-btn bulk-btn" onClick={() => handleGachaPull(false, 10)} disabled={pulling}>
                                    <span>10x ($100k)</span>
                                </button>
                            </div>
                            <div className="recruit-group">
                                <button className="btn-secondary buy-btn side-btn kc-btn" onClick={() => handleGachaPull(true, 1)} disabled={pulling}>
                                    {pulling ? <RefreshCw className="spin" size={14} /> : <Coins size={14} />} 
                                    <span>10 KC Pull</span>
                                </button>
                                <button className="btn-secondary buy-btn side-btn kc-btn bulk-btn" onClick={() => handleGachaPull(true, 10)} disabled={pulling}>
                                    <span>10x (100 KC)</span>
                                </button>
                            </div>
                        </div>
                   </section>
                    <section className="arena-section glass-panel">
                        <div className="section-title"><Trophy size={20} /> <h2>Arena</h2></div>
                        {!tournamentActive ? (
                            <button className="btn-primary start-btn" onClick={startTournament}><Play size={18} /> Match starten</button>
                        ) : (
                            <div className="arena-active">
                                <div className="match-timer">{timer}s</div>
                                <div className="hp-container">
                                    <div className="hp-bar-outer"><div className="hp-bar player" style={{ width: `${playerHp}%` }}></div></div>
                                    <div className="hp-bar-outer"><div className="hp-bar enemy" style={{ width: `${enemyHp}%` }}></div></div>
                                </div>
                                <div className="match-ticker">{ticker[0]}</div>
                                {tournamentResult && (
                                    <div className={`match-result ${tournamentResult}`}>{tournamentResult.toUpperCase()}
                                        <button onClick={() => setTournamentActive(false)}>Close</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>
                </div>
            </div>
            {revealData && <GachaRevealModal results={revealData.results} onClose={() => setRevealData(null)} allTeams={allTeams} />}
           {contextMenu && (
                <ContextMenu 
                    {...contextMenu} 
                    onSell={(id) => { handleSell(id); setContextMenu(null); }}
                    onEquip={(id) => { setEquippingUnit(id); setContextMenu(null); }}
                    onClose={() => setContextMenu(null)} 
                />
            )}
        </div>
    );
};

export default LoLIdleGame;
