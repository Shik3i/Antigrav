import React, { useState, useEffect, useMemo } from 'react';
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
  Trophy
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
      marginBottom: '32px', 
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

const LevelingTracker = () => {
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('mmo_xp_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [currentLevel, setCurrentLevel] = useState('');
  const [currentXP, setCurrentXP] = useState('');
  const [calcMode, setCalcMode] = useState('session'); // 'tick' or 'session'

  // Persist history to localStorage
  useEffect(() => {
    localStorage.setItem('mmo_xp_history', JSON.stringify(history));
  }, [history]);

  const addEntry = () => {
    if (!currentLevel || !currentXP) return;
    
    const xpVal = parseFloat(currentXP);
    if (isNaN(xpVal) || xpVal < 0 || xpVal >= 100) {
      alert("XP muss zwischen 0 und 99.9999 liegen.");
      return;
    }

    const newEntry = {
      id: Date.now(),
      timestamp: Date.now(),
      level: parseInt(currentLevel),
      xp: xpVal
    };

    // Add new entry and limit to 100 most recent ones
    setHistory(prev => [newEntry, ...prev].slice(0, 100));
    // Don't reset level, only XP (usually level stays same for multiple ticks)
    setCurrentXP('');
  };

  const deleteEntry = (id) => {
    setHistory(history.filter(entry => entry.id !== id));
  };

  const resetHistory = () => {
    if (window.confirm("Möchtest du die gesamte Historie wirklich löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.")) {
      setHistory([]);
    }
  };

  // Logic for calculations
  const stats = useMemo(() => {
    if (history.length < 2) return null;

    let totalXPGained = 0;
    let timeElapsedMs = 0;

    if (calcMode === 'tick') {
      // Option A: Last Tick
      const latest = history[0];
      const prev = history[1];
      
      timeElapsedMs = latest.timestamp - prev.timestamp;
      // XP diff: accounts for level up (simple version: (LevelDiff * 100) + LatestXP - PrevXP)
      totalXPGained = (latest.level - prev.level) * 100 + latest.xp - prev.xp;
    } else {
      // Option B: Running Session / Last 5
      const latest = history[0];
      const oldestIndex = Math.min(history.length - 1, 5);
      const oldest = history[oldestIndex];

      timeElapsedMs = latest.timestamp - oldest.timestamp;
      totalXPGained = (latest.level - oldest.level) * 100 + latest.xp - oldest.xp;
    }

    if (timeElapsedMs <= 0 || totalXPGained <= 0) return null;

    const xpPerMs = totalXPGained / timeElapsedMs;
    const xpPerMin = xpPerMs * 60000;
    const xpPerHour = xpPerMs * 3600000;
    const xpPerDay = xpPerHour * 24;

    const remainingXPForLevel = 100 - history[0].xp;
    const timeToLevelUpMs = remainingXPForLevel / xpPerMs;

    return {
      xpPerMin,
      xpPerHour,
      xpPerDay,
      timeToLevelUpMs
    };
  }, [history, calcMode]);

  const historyDisplay = useMemo(() => {
    return history.map((entry, index) => {
      let gained = 0;
      let elapsed = 0;
      
      if (index < history.length - 1) {
        const prev = history[index + 1];
        gained = (entry.level - prev.level) * 100 + (entry.xp - prev.xp);
        elapsed = entry.timestamp - prev.timestamp;
      }

      return {
        ...entry,
        gained,
        elapsed
      };
    });
  }, [history]);

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px' }}>
      
      {/* FWC Countdown */}
      <FwcCountdown />

      {/* Hero Header */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '16px' }}>
          <TrendingUp size={40} color="var(--accent-primary)" />
          <h1 style={{ fontSize: '2.5rem', margin: 0, background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            MMO Leveling Tracker
          </h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Tracke deinen Fortschritt und berechne deine Level-Up Zeiten.</p>
      </div>

      <div className="leveling-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '24px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Input Card */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Plus size={20} color="var(--accent-primary)" />
              Neuen Eintrag erfassen
            </h2>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase' }}>Aktuelles Level</label>
                <input 
                  type="number" 
                  className="input-primary"
                  value={currentLevel}
                  onChange={(e) => setCurrentLevel(e.target.value)}
                  placeholder="z.B. 60"
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase' }}>Erfahrung / XP (%)</label>
                <input 
                  type="number" 
                  className="input-primary"
                  value={currentXP}
                  onChange={(e) => setCurrentXP(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addEntry()}
                  placeholder="z.B. 50.1234"
                  step="0.0001"
                  style={{ width: '100%' }}
                />
              </div>
              <button 
                onClick={addEntry}
                className="btn-primary"
                style={{ height: '48px', padding: '0 24px', borderRadius: '12px' }}
              >
                <Plus size={20} style={{ marginRight: '8px' }} /> Hinzufügen
              </button>
            </div>
          </div>

          {/* History Table */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <History size={20} color="var(--accent-primary)" />
                Verlauf
              </h2>
              {history.length > 0 && (
                <button 
                  onClick={resetHistory}
                  className="btn-ghost" 
                  style={{ color: '#ef4444', fontSize: '0.85rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  title="Verlauf leeren"
                >
                  <Trash2 size={16} /> Verlauf leeren
                </button>
              )}
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: '600px', width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '12px' }}>Uhrzeit</th>
                    <th style={{ padding: '12px' }}>Lvl</th>
                    <th style={{ padding: '12px' }}>XP (%)</th>
                    <th style={{ padding: '12px' }}>XP Gained</th>
                    <th style={{ padding: '12px' }}>Elapsed</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {historyDisplay.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Keine Einträge vorhanden.</td>
                    </tr>
                  ) : (
                    historyDisplay.map((entry) => (
                      <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                        <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                          {new Date(entry.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '12px', fontWeight: 600 }}>{entry.level}</td>
                        <td style={{ padding: '12px', fontFamily: "'JetBrains Mono', monospace" }}>{entry.xp.toFixed(4)}%</td>
                        <td style={{ padding: '12px', color: entry.gained > 0 ? '#10b981' : (entry.gained < 0 ? '#ef4444' : 'inherit') }}>
                          {entry.gained > 0 ? `+${entry.gained.toFixed(4)}%` : (entry.gained < 0 ? `${entry.gained.toFixed(4)}%` : '-')}
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                          {entry.elapsed > 0 ? `${Math.floor(entry.elapsed / 60000)}m ${Math.floor((entry.elapsed % 60000) / 1000)}s` : '-'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <button 
                            className="btn-ghost" 
                            style={{ color: '#ef4444', padding: '6px' }}
                            onClick={() => deleteEntry(entry.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {history.length >= 100 && (
                <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  Limit von 100 Einträgen erreicht. Die ältesten Daten werden automatisch entfernt.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="glass-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0, fontWeight: 700, textTransform: 'uppercase' }}>Berechnungsbasis</h3>
              <Calculator size={18} color="var(--accent-primary)" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                onClick={() => setCalcMode('tick')}
                className={`btn-ghost ${calcMode === 'tick' ? 'active' : ''}`}
                style={{ justifyContent: 'flex-start', padding: '10px 14px', borderRadius: '10px', fontSize: '0.85rem' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                   <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: calcMode === 'tick' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)' }}></div>
                   Letzter Tick
                </div>
                <ChevronRight size={14} style={{ opacity: 0.5 }} />
              </button>
              <button 
                onClick={() => setCalcMode('session')}
                className={`btn-ghost ${calcMode === 'session' ? 'active' : ''}`}
                style={{ justifyContent: 'flex-start', padding: '10px 14px', borderRadius: '10px', fontSize: '0.85rem' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: calcMode === 'session' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)' }}></div>
                  Gleitender Durchschnitt (5)
                </div>
                <ChevronRight size={14} style={{ opacity: 0.5 }} />
              </button>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '24px', position: 'relative', overflow: 'hidden', borderLeft: '4px solid var(--accent-primary)' }}>
            <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.1 }}>
              <Target size={100} color="var(--accent-primary)" />
            </div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                Estimated Level-Up
              </div>
              <div style={{ 
                fontSize: '1.85rem', 
                fontWeight: 700, 
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                color: 'var(--text-main)',
                margin: '8px 0'
              }}>
                {stats ? formatDuration(stats.timeToLevelUpMs) : '--h --m --s'}
              </div>
              {stats && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <Zap size={12} color="#facc15" />
                  <span>Basierend auf {calcMode === 'tick' ? 'letztem Tick' : 'Session-Schnitt'}</span>
                </div>
              )}
            </div>
          </div>

          {[
            { label: 'XP pro Stunde', value: stats?.xpPerHour, icon: <BarChart3 size={20} color="#ec4899" />, color: '#ec4899', suffix: '%/h' },
            { label: 'XP pro Minute', value: stats?.xpPerMin, icon: <Zap size={20} color="#facc15" />, color: '#facc15', suffix: '%/m' },
            { label: 'XP pro Tag', value: stats?.xpPerDay, icon: <Calendar size={20} color="#3b82f6" />, color: '#3b82f6', suffix: '%/d' }
          ].map((stat, i) => (
            <div key={i} className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', borderLeft: `4px solid ${stat.color}` }}>
              <div style={{ background: `${stat.color}15`, padding: '10px', borderRadius: '12px' }}>
                {stat.icon}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: stat.color }}>
                  {stat.value ? `${stat.value.toFixed(4)}${stat.suffix}` : '--'}
                </div>
              </div>
            </div>
          ))}

          {history.length < 2 && (
            <div style={{ display: 'flex', gap: '12px', padding: '16px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
              <AlertCircle size={20} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                Füge mindestens zwei Einträge hinzu, um XP-Statistiken und Prognosen zu sehen.
              </p>
            </div>
          )}

        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .leveling-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default LevelingTracker;
