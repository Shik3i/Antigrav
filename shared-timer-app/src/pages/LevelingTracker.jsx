import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  TrendingUp, 
  Plus, 
  Trash2, 
  Clock, 
  Zap, 
  Target, 
  History, 
  ChevronRight,
  Calculator,
  BarChart3,
  Calendar,
  AlertCircle,
  Trophy,
  Coins,
  ArrowUp,
  Layout
} from 'lucide-react';

/**
 * Format milliseconds to a readable duration string (e.g. 2h 15m or HH:MM:SS)
 */
const formatDuration = (ms) => {
  if (!ms || ms <= 0 || !isFinite(ms)) return '--';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 999) return '> 999h';
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

const FwcCountdown = () => {
  const [now, setNow] = useState(Date.now());
  // Target: 23. April 2026, 10:00 Uhr
  const target = new Date('2026-04-23T10:00:00').getTime();

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const diff = target - now;
  const isFuture = diff > 0;
  const absDiff = Math.abs(diff);

  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((absDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((absDiff % (1000 * 60)) / 1000);

  return (
    <div className="glass-card animate-fade-in" style={{ 
      padding: '12px 24px', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      gap: '16px',
      background: 'rgba(245, 158, 11, 0.05)',
      border: '1px solid rgba(245, 158, 11, 0.2)',
      borderRadius: '16px'
    }}>
      <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '8px', borderRadius: '50%', display: 'flex' }}>
        <Trophy size={20} color="#f59e0b" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>
          {isFuture ? 'Countdown zum Flyff FWC 2026:' : 'Zeit seit dem Flyff FWC 2026 Start:'}
        </span>
        <div style={{ display: 'flex', gap: '8px', fontFamily: "'JetBrains Mono', monospace", fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b' }}>
          <span>{days}d</span>
          <span>{hours}h</span>
          <span>{minutes}m</span>
          <span style={{ minWidth: '45px' }}>{seconds}s</span>
        </div>
      </div>
    </div>
  );
};

const LevelingTracker = ({ user, token }) => {
  const [activeTab, setActiveTab] = useState('xp'); // 'xp' or 'gold'
  const [now, setNow] = useState(Date.now());
  const [calcMode, setCalcMode] = useState('session'); // 'tick' or 'session'

  // XP State
  const [xpHistory, setXpHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('mmo_xp_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [currentLevel, setCurrentLevel] = useState('');
  const [currentXP, setCurrentXP] = useState('');

  // Gold State
  const [goldHistory, setGoldHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('mmo_gold_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [currentGold, setCurrentGold] = useState('');

  // Database Milestones
  const [milestones, setMilestones] = useState([]);

  // Ref for interval
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Milestones
  const fetchMilestones = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/leveling/milestones', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMilestones(data);
      }
    } catch (e) {
      console.error("Failed to fetch milestones", e);
    }
  };

  useEffect(() => {
    fetchMilestones();
  }, [token]);

  // Persist history to localStorage
  useEffect(() => {
    localStorage.setItem('mmo_xp_history', JSON.stringify(xpHistory));
  }, [xpHistory]);

  useEffect(() => {
    localStorage.setItem('mmo_gold_history', JSON.stringify(goldHistory));
  }, [goldHistory]);

  // Pre-fill level on load or history change
  useEffect(() => {
    if (xpHistory.length > 0 && currentLevel === '') {
      setCurrentLevel(xpHistory[0].level.toString());
    }
  }, [xpHistory]);


  const handleKeyShortcut = (e) => {
    if (activeTab === 'xp') {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const nextLvl = parseInt(currentLevel || '0') + 1;
        setCurrentLevel(nextLvl.toString());
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextLvl = Math.max(1, parseInt(currentLevel || '1') - 1);
        setCurrentLevel(nextLvl.toString());
      }
    }
  };

  const addXP = async () => {
    if (!currentLevel || !currentXP) return;
    
    const xpVal = parseFloat(currentXP);
    const lvlVal = parseInt(currentLevel);
    if (isNaN(xpVal) || xpVal < 0 || xpVal >= 100) {
      alert("XP muss zwischen 0 und 99.9999 liegen.");
      return;
    }

    const newEntry = {
      id: Date.now(),
      timestamp: Date.now(),
      level: lvlVal,
      xp: xpVal
    };

    // Add to history
    setXpHistory(prev => [newEntry, ...prev].slice(0, 100));
    setCurrentXP('');

    // Check for milestones in DB (let backend handle the logic for all milestones up to this level)
    if (token) {
      try {
        const res = await fetch('/api/leveling/milestone', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify({ level: lvlVal })
        });
        if (res.ok) fetchMilestones();
      } catch (e) {
        console.error("Failed to save milestone", e);
      }
    }
  };

  const addGold = () => {
    if (!currentGold) return;
    
    const goldVal = parseFloat(currentGold);
    if (isNaN(goldVal)) return;

    const newEntry = {
      id: Date.now(),
      timestamp: Date.now(),
      amount: goldVal
    };

    setGoldHistory(prev => [newEntry, ...prev].slice(0, 100));
    setCurrentGold('');
  };

  const deleteEntry = (id, type) => {
    if (type === 'xp') {
      setXpHistory(xpHistory.filter(e => e.id !== id));
    } else {
      setGoldHistory(goldHistory.filter(e => e.id !== id));
    }
  };

  const resetHistory = (type) => {
    if (window.confirm(`Möchtest du die gesamte ${type === 'xp' ? 'XP' : 'Gold'} Historie wirklich löschen?`)) {
      if (type === 'xp') setXpHistory([]); else setGoldHistory([]);
    }
  };

  // Calculations for XP
  const xpStats = useMemo(() => {
    if (xpHistory.length < 2) return null;
    let totalGained = 0;
    let elapsedMs = 0;

    if (calcMode === 'tick') {
      const latest = xpHistory[0];
      const prev = xpHistory[1];
      elapsedMs = latest.timestamp - prev.timestamp;
      totalGained = (latest.level - prev.level) * 100 + latest.xp - prev.xp;
    } else {
      const latest = xpHistory[0];
      const count = Math.min(xpHistory.length - 1, 5);
      const oldest = xpHistory[count];
      elapsedMs = latest.timestamp - oldest.timestamp;
      totalGained = (latest.level - oldest.level) * 100 + latest.xp - oldest.xp;
    }

    if (elapsedMs <= 0 || totalGained <= 0) return null;
    const xpPerMs = totalGained / elapsedMs;
    const remainingXP = 100 - xpHistory[0].xp;
    const timeToLevelUpMs = remainingXP / xpPerMs;
    const targetDate = new Date(Date.now() + timeToLevelUpMs);

    return {
      xpPerHour: xpPerMs * 3600000,
      xpPerMin: xpPerMs * 60000,
      xpPerDay: xpPerMs * 86400000,
      timeToLevelUpMs,
      targetDate
    };
  }, [xpHistory, calcMode]);

  // Calculations for Gold
  const goldStats = useMemo(() => {
    if (goldHistory.length < 2) return null;
    let totalGained = 0;
    let elapsedMs = 0;

    if (calcMode === 'tick') {
      const latest = goldHistory[0];
      const prev = goldHistory[1];
      elapsedMs = latest.timestamp - prev.timestamp;
      totalGained = latest.amount - prev.amount;
    } else {
      const latest = goldHistory[0];
      const count = Math.min(goldHistory.length - 1, 5);
      const oldest = goldHistory[count];
      elapsedMs = latest.timestamp - oldest.timestamp;
      totalGained = latest.amount - oldest.amount;
    }

    if (elapsedMs <= 0 || totalGained <= 0) return null;
    const goldPerMs = totalGained / elapsedMs;
    return {
      goldPerHour: goldPerMs * 3600000,
      goldPerMin: goldPerMs * 60000,
      goldPerDay: goldPerMs * 86400000,
      futureHour: goldPerMs * 3600000 // Predicted gold in 1 hour
    };
  }, [goldHistory, calcMode]);

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px' }}>
      
      {/* Hero Header */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '16px' }}>
          <TrendingUp size={40} color="var(--accent-primary)" />
          <h1 style={{ fontSize: '2.5rem', margin: 0, background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            MMO Leveling Tracker
          </h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '32px' }}>Tracke deinen Fortschritt und berechne deine Level-Up Zeiten.</p>
        <FwcCountdown />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '14px', width: 'fit-content' }}>
        <button 
          onClick={() => setActiveTab('xp')}
          className={`btn-ghost ${activeTab === 'xp' ? 'active' : ''}`}
          style={{ padding: '10px 20px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Zap size={18} /> XP Tracker
        </button>
        <button 
          onClick={() => setActiveTab('gold')}
          className={`btn-ghost ${activeTab === 'gold' ? 'active' : ''}`}
          style={{ padding: '10px 20px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Coins size={18} /> Gold Tracker
        </button>
      </div>

      <div className="leveling-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '24px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Input Card */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Plus size={20} color="var(--accent-primary)" />
              {activeTab === 'xp' ? 'XP Eintrag hinzufügen' : 'Goldbestand erfassen'}
            </h2>
            {activeTab === 'xp' ? (
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase' }}>Aktuelles Level</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      className="input-primary"
                      value={currentLevel}
                      onChange={(e) => setCurrentLevel(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={handleKeyShortcut}
                      placeholder="z.B. 60"
                      style={{ width: '100%' }}
                    />
                    <button 
                      onClick={() => {
                        const nextLvl = parseInt(currentLevel || '0') + 1;
                        setCurrentLevel(nextLvl.toString());
                      }}
                      className="btn-ghost"
                      style={{ 
                        padding: '0 12px', 
                        borderRadius: '10px', 
                        background: 'rgba(59, 130, 246, 0.1)', 
                        color: 'var(--accent-primary)',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        height: '48px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: 700
                      }}
                      title="Level +1"
                    >
                      <Plus size={16} /> 1
                    </button>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase' }}>Erfahrung / XP (%)</label>
                  <input 
                    type="number" 
                    className="input-primary"
                    value={currentXP}
                    onChange={(e) => setCurrentXP(e.target.value)}
                    onKeyDown={(e) => {
                      handleKeyShortcut(e);
                      if (e.key === 'Enter') addXP();
                    }}
                    placeholder="z.B. 50.1234"
                    step="0.0001"
                    style={{ width: '100% '}}
                  />
                </div>
                <button onClick={addXP} className="btn-primary" style={{ height: '48px', padding: '0 24px', borderRadius: '12px' }}>
                  Hinzufügen
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase' }}>Aktueller Goldbestand</label>
                  <input 
                    type="number" 
                    className="input-primary"
                    value={currentGold}
                    onChange={(e) => setCurrentGold(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addGold()}
                    placeholder="z.B. 1000000"
                    style={{ width: '100%' }}
                  />
                </div>
                <button onClick={addGold} className="btn-primary" style={{ height: '48px', padding: '0 24px', borderRadius: '12px' }}>
                  Hinzufügen
                </button>
              </div>
            )}
            <div style={{ marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Tipp: Drücke <kbd style={{ padding: '2px 4px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>ArrowUp</kbd> in XP-Feldern zum Erhöhen des Levels.
            </div>
          </div>

          {/* History Table */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <History size={20} color="var(--accent-primary)" />
                Verlauf
              </h2>
              <button 
                onClick={() => resetHistory(activeTab)}
                className="btn-ghost" 
                style={{ color: '#ef4444', fontSize: '0.85rem' }}
              >
                <Trash2 size={16} /> Verlauf leeren
              </button>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px' }}>Uhrzeit</th>
                    {activeTab === 'xp' && <th style={{ padding: '12px' }}>Lvl</th>}
                    <th style={{ padding: '12px' }}>{activeTab === 'xp' ? 'XP (%)' : 'Gold'}</th>
                    <th style={{ padding: '12px' }}>Diff</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeTab === 'xp' ? xpHistory : goldHistory).map((entry, idx, arr) => {
                    let diff = 0;
                    if (idx < arr.length - 1) {
                      const prev = arr[idx + 1];
                      if (activeTab === 'xp') {
                        diff = (entry.level - prev.level) * 100 + (entry.xp - prev.xp);
                      } else {
                        diff = entry.amount - prev.amount;
                      }
                    }
                    return (
                      <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                        <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                          {new Date(entry.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        {activeTab === 'xp' && <td style={{ padding: '12px', fontWeight: 600 }}>{entry.level}</td>}
                        <td style={{ padding: '12px', fontFamily: "'JetBrains Mono', monospace" }}>
                          {activeTab === 'xp' ? `${entry.xp.toFixed(4)}%` : entry.amount.toLocaleString()}
                        </td>
                        <td style={{ padding: '12px', color: diff > 0 ? '#10b981' : (diff < 0 ? '#ef4444' : 'inherit') }}>
                          {diff !== 0 ? (activeTab === 'xp' ? `${diff > 0 ? '+' : ''}${diff.toFixed(4)}%` : `${diff > 0 ? '+' : ''}${diff.toLocaleString()}`) : '-'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <button className="btn-ghost" style={{ color: '#ef4444' }} onClick={() => deleteEntry(entry.id, activeTab)}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {(activeTab === 'xp' ? xpHistory : goldHistory).length === 0 && (
                    <tr><td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Keine Einträge.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="glass-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0, fontWeight: 700, textTransform: 'uppercase' }}>Berechnungsbasis</h3>
              <Calculator size={18} color="var(--accent-primary)" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={() => setCalcMode('tick')} className={`btn-ghost ${calcMode === 'tick' ? 'active' : ''}`} style={{ justifyContent: 'flex-start', padding: '10px 14px', borderRadius: '10px', fontSize: '0.85rem' }}>
                Letzter Tick
              </button>
              <button onClick={() => setCalcMode('session')} className={`btn-ghost ${calcMode === 'session' ? 'active' : ''}`} style={{ justifyContent: 'flex-start', padding: '10px 14px', borderRadius: '10px', fontSize: '0.85rem' }}>
                Schnitt (letzte 5)
              </button>
            </div>
          </div>

          {/* Prediction Card */}
          <div className="glass-card" style={{ padding: '24px', position: 'relative', overflow: 'hidden', borderLeft: '4px solid var(--accent-primary)' }}>
            <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.1 }}>
              {activeTab === 'xp' ? <Target size={100} color="var(--accent-primary)" /> : <Coins size={100} color="var(--accent-primary)" />}
            </div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                {activeTab === 'xp' ? 'Estimated Level-Up' : 'Estimated Gold in 1h'}
              </div>
              
              {activeTab === 'xp' ? (
                <>
                  <div style={{ fontSize: '1.85rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", margin: '8px 0' }}>
                    {xpStats ? formatDuration(xpStats.targetDate.getTime() - now) : '--h --m --s'}
                  </div>
                  {xpStats && (
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                      <Clock size={14} style={{ marginRight: '6px' }} />
                      {xpStats.targetDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: '1.85rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", margin: '8px 0', color: '#10b981' }}>
                  {goldStats ? `+${goldStats.futureHour.toLocaleString()}` : '--'}
                </div>
              )}
              
              {(xpStats || goldStats) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <Zap size={12} color="#facc15" />
                  <span>Basierend auf {calcMode === 'tick' ? 'letztem Tick' : 'Schnitt'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Stat Cards */}
          {(activeTab === 'xp' ? [
            { label: 'XP / h', value: xpStats?.xpPerHour, color: '#ec4899', suffix: '%/h' },
            { label: 'XP / m', value: xpStats?.xpPerMin, color: '#facc15', suffix: '%/m' },
            { label: 'XP / d', value: xpStats?.xpPerDay, color: '#3b82f6', suffix: '%/d' }
          ] : [
            { label: 'Gold / h', value: goldStats?.goldPerHour, color: '#10b981', suffix: '' },
            { label: 'Gold / m', value: goldStats?.goldPerMin, color: '#facc15', suffix: '' },
            { label: 'Gold / d', value: goldStats?.goldPerDay, color: '#3b82f6', suffix: '' }
          ]).map((stat, i) => (
            <div key={i} className="glass-card" style={{ padding: '16px', borderLeft: `4px solid ${stat.color}` }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{stat.label}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: stat.color }}>
                {stat.value ? `${stat.value.toLocaleString(undefined, { maximumFractionDigits: activeTab === 'xp' ? 4 : 0 })}${stat.suffix}` : '--'}
              </div>
            </div>
          ))}

          {/* Milestones Sidebar Card */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0, fontWeight: 700, textTransform: 'uppercase' }}>Meilensteine</h3>
              <Trophy size={18} color="#facc15" />
            </div>
            {token ? (
              <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {milestones.length > 0 ? milestones.map(m => (
                  <div key={m.level} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                    <span style={{ fontWeight: 700 }}>Lvl {m.level}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {new Date(m.reachedAt).toLocaleDateString('de-DE')}
                    </span>
                  </div>
                )) : (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center' }}>
                    Keine Meilensteine erreicht.
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Logge dich ein, um persistente Meilensteine zu speichern.
              </div>
            )}
          </div>

        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .leveling-grid {
            grid-template-columns: 1fr !important;
          }
        }
        kbd {
          font-family: inherit;
          padding: 2px 5px;
          font-size: 11px;
          color: #fff;
          background-color: #333;
          border: 1px solid #555;
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
};

export default LevelingTracker;
