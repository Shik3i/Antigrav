import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Coins, Flag, Play, RotateCcw, Shield, TrendingUp, Trophy, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchJson } from '../utils/apiClient';

const formatKC = (cents) => (cents / 100).toLocaleString('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const STATUS_META = {
  running: { label: 'Running', color: '#3b82f6', bg: 'rgba(59,130,246,0.14)' },
  cashed_out: { label: 'Cashed Out', color: '#10b981', bg: 'rgba(16,185,129,0.14)' },
  lost: { label: 'Lost', color: '#ef4444', bg: 'rgba(239,68,68,0.14)' },
  idle: { label: 'Idle', color: 'var(--text-muted)', bg: 'rgba(148,163,184,0.12)' }
};

const TowerClimb = () => {
  const { user, isGuest, setUser } = useAuth();
  const { showToast } = useToast();

  const [config, setConfig] = useState(null);
  const [activeRound, setActiveRound] = useState(null);
  const [latestRound, setLatestRound] = useState(null);
  const [history, setHistory] = useState([]);
  const [bet, setBet] = useState(500);
  const [tilesPerLevel, setTilesPerLevel] = useState(3);
  const [autoStartRounds, setAutoStartRounds] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState('');

  const syncBalance = useCallback((newBalance) => {
    if (!Number.isFinite(newBalance)) return;
    setUser((prev) => ({ ...prev, koala_balance: newBalance }));
  }, [setUser]);

  const loadConfig = useCallback(async () => {
    const configData = await fetchJson('/api/tower/config', { token: '' });
    setConfig(configData);
    setTilesPerLevel((prev) => configData.allowedTilesPerLevel?.includes(prev)
      ? prev
      : (configData.allowedTilesPerLevel?.[1] || configData.allowedTilesPerLevel?.[0] || 3));
    setBet((prev) => Math.max(configData.minBet || 100, prev));
    return configData;
  }, []);

  const loadAuthedData = useCallback(async () => {
    if (isGuest) {
      setActiveRound(null);
      setLatestRound(null);
      setHistory([]);
      return;
    }

    const [stateData, historyData] = await Promise.all([
      fetchJson('/api/tower/state'),
      fetchJson('/api/tower/history')
    ]);

    setActiveRound(stateData.activeRound || null);
    setLatestRound(stateData.activeRound ? null : (stateData.latestRound || null));
    setHistory(historyData.history || []);
  }, [isGuest]);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await loadConfig();
      await loadAuthedData();
    } catch (err) {
      console.error('Failed to load Tower Climb page:', err);
      setError(err.message || 'Tower Climb konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [loadAuthedData, loadConfig]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const refreshHistory = useCallback(async () => {
    if (isGuest) return;
    try {
      const historyData = await fetchJson('/api/tower/history');
      setHistory(historyData.history || []);
    } catch (err) {
      console.error('Failed to refresh tower history:', err);
    }
  }, [isGuest]);

  const previewRound = useMemo(() => {
    if (!config) return null;
    if (activeRound) return activeRound;
    return {
      status: 'idle',
      bet,
      currentLevel: 0,
      currentMultiplier: 1,
      currentPayout: 0,
      tilesPerLevel,
      levelCount: config.levelCount,
      selectedTiles: [],
      multiplierTable: config.multiplierPreviews?.[tilesPerLevel] || [1]
    };
  }, [activeRound, bet, config, tilesPerLevel]);

  const visibleTowerLevels = useMemo(() => {
    if (!previewRound?.levelCount) return [];
    const current = activeRound?.currentLevel ?? 0;
    const maxAhead = 2;
    const topLimit = Math.min(previewRound.levelCount - 1, current + maxAhead);
    
    // We show everything from 0 to topLimit, in descending order (top level first)
    const levels = [];
    for (let i = topLimit; i >= 0; i--) {
      levels.push(i);
    }
    return levels;
  }, [activeRound, previewRound]);

  const handleStart = useCallback(async () => {
    if (isGuest) {
      showToast('Tower Climb nutzt KoalaCoins und benötigt daher einen Login.', 'warning');
      return;
    }

    setActionBusy(true);
    setError('');
    try {
      const result = await fetchJson('/api/tower/start', {
        method: 'POST',
        body: JSON.stringify({ bet, tilesPerLevel })
      });
      setActiveRound(result.round);
      setLatestRound(null);
      syncBalance(result.newBalance);
      showToast('Tower-Runde gestartet. Viel Glück!', 'success');
      await refreshHistory();
    } catch (err) {
      setError(err.message || 'Runde konnte nicht gestartet werden.');
      await loadAuthedData();
    } finally {
      setActionBusy(false);
    }
  }, [isGuest, loadAuthedData, refreshHistory, showToast, syncBalance, bet, tilesPerLevel]);

  useEffect(() => {
    if (!autoStartRounds || isGuest || activeRound || actionBusy) return undefined;
    if (!latestRound || !['lost', 'cashed_out'].includes(latestRound.status)) return undefined;

    const autoStartTimer = window.setTimeout(() => {
      handleStart();
    }, 900);

    return () => window.clearTimeout(autoStartTimer);
  }, [actionBusy, activeRound, autoStartRounds, handleStart, isGuest, latestRound]);

  const handlePick = async (tileIndex) => {
    if (!activeRound || actionBusy) return;

    setActionBusy(true);
    setError('');
    try {
      const result = await fetchJson('/api/tower/pick', {
        method: 'POST',
        body: JSON.stringify({ tileIndex, expectedLevel: activeRound.currentLevel })
      });

      if (result.round.status === 'running') {
        setActiveRound(result.round);
        const nextStep = result.round.currentLevel >= result.round.levelCount
          ? 'Tower vollständig geklärt. Jetzt auszahlen!'
          : `Sicher! Level ${result.round.currentLevel}/${result.round.levelCount}.`;
        showToast(nextStep, 'success');
      } else {
        setActiveRound(null);
        setLatestRound(result.round);
        showToast('Falle getroffen. Einsatz verloren.', 'error');
        await refreshHistory();
      }

      syncBalance(result.newBalance);
    } catch (err) {
      setError(err.message || 'Spielzug konnte nicht ausgewertet werden.');
      await loadAuthedData();
    } finally {
      setActionBusy(false);
    }
  };

  const handleCashout = async () => {
    if (!activeRound || actionBusy) return;

    setActionBusy(true);
    setError('');
    try {
      const result = await fetchJson('/api/tower/cashout', {
        method: 'POST',
        body: JSON.stringify({})
      });
      setActiveRound(null);
      setLatestRound(result.round);
      syncBalance(result.newBalance);
      showToast(`Cashout erfolgreich: ${formatKC(result.payout)} KC`, 'success');
      await refreshHistory();
    } catch (err) {
      setError(err.message || 'Cashout fehlgeschlagen.');
      await loadAuthedData();
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return <div className="flex-center" style={{ minHeight: '60vh', opacity: 0.65 }}>Tower Climb wird geladen...</div>;
  }

  if (!config) {
    return <div className="flex-center" style={{ minHeight: '60vh', color: '#ef4444' }}>{error || 'Konfiguration konnte nicht geladen werden.'}</div>;
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '64px' }}>
      {/* Header Panel */}
      <div className="glass-panel" style={{ padding: '32px', borderRadius: '28px', display: 'flex', flexDirection: 'column', gap: '18px', background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(59,130,246,0.05) 100%)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(37,99,235,0.2) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' }}>
              <Shield size={32} color="var(--accent-primary)" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.02em', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Tower Climb</h1>
              <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: '1.05rem', maxWidth: '800px' }}>
                Steige den Turm hinauf und vervielfache deinen Einsatz. Aber Vorsicht: Jede Ebene birgt Gefahren!
              </p>
            </div>
          </div>
          
          {/* Quick Stats in Header */}
          <div style={{ display: 'flex', gap: '12px' }}>
             <div style={{ padding: '12px 20px', borderRadius: '18px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Guthaben</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b' }}>{formatKC(user?.koala_balance || 0)} KC</span>
             </div>
          </div>
        </div>

        {isGuest && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '20px', padding: '16px 20px', color: '#fcd34d', marginTop: '8px' }}>
            <AlertCircle size={22} />
            <span style={{ flex: 1, fontWeight: 500 }}>Login erforderlich, um mit KoalaCoins zu spielen.</span>
            <Link to="/login" className="btn-primary" style={{ textDecoration: 'none', padding: '10px 18px', borderRadius: '14px' }}>Jetzt Einloggen</Link>
          </div>
        )}

        {error && (
          <div style={{ padding: '14px 20px', borderRadius: '18px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', fontWeight: 500 }}>
             {error}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(360px, 0.8fr)', gap: '32px', alignItems: 'start' }}>
        
        {/* Main Game Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="glass-panel" style={{ padding: '0', borderRadius: '32px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ padding: '24px 32px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Tower Board</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: activeRound ? '#10b981' : '#64748b', boxShadow: activeRound ? '0 0 12px #10b981' : 'none' }}></div>
                <span style={{ fontSize: '0.9rem', color: activeRound ? '#10b981' : 'var(--text-muted)', fontWeight: 600 }}>{activeRound ? 'Live' : 'Bereit'}</span>
              </div>
            </div>

            <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Stats Grid Icons */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', padding: '20px', display: 'flex', alignItems: 'center', gap: '20px', transition: 'transform 0.2s ease' }}>
                   <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TrendingUp size={24} color="#a78bfa" />
                   </div>
                   <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Multiplikator</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 900 }}>x{Number(activeRound?.currentMultiplier || 1).toFixed(2)}</div>
                   </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', padding: '20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                   <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trophy size={24} color="#34d399" />
                   </div>
                   <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Potentieller Gewinn</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#10b981' }}>{formatKC(activeRound?.currentPayout || 0)} KC</div>
                   </div>
                </div>
              </div>

              {/* Tower Visualization */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative' }}>
                {visibleTowerLevels.map((levelIndex, visibleIndex) => {
                  const resolvedSelection = previewRound?.selectedTiles?.find((selection) => selection.level === levelIndex);
                  const isCurrentLevel = !!activeRound && activeRound.currentLevel === levelIndex;
                  const isPastLevel = !!activeRound && levelIndex < activeRound.currentLevel;
                  const isUpcomingLevel = !!activeRound && levelIndex > activeRound.currentLevel;
                  const isFinalLevel = levelIndex === (config?.levelCount - 1);
                  const rowMultiplier = previewRound?.multiplierTable?.[levelIndex + 1] || 1;

                  return (
                    <div
                      key={levelIndex}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '120px minmax(0, 1fr)',
                        gap: '20px',
                        alignItems: 'stretch',
                        padding: '16px',
                        borderRadius: '24px',
                        background: isCurrentLevel ? 'rgba(59,130,246,0.08)' : (isFinalLevel ? 'rgba(245,158,11,0.05)' : 'rgba(255,255,255,0.02)'),
                        border: isCurrentLevel ? '2px solid rgba(59,130,246,0.3)' : (isFinalLevel ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.05)'),
                        boxShadow: isCurrentLevel ? '0 0 30px rgba(59,130,246,0.1)' : (isFinalLevel ? '0 0 20px rgba(245,158,11,0.1)' : 'none'),
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        animation: `fadeInUp 0.4s ease ${visibleIndex * 50}ms both`,
                        position: 'relative',
                        zIndex: isCurrentLevel ? 10 : 1
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', borderRight: '1px solid rgba(255,255,255,0.06)', gap: '12px' }}>
                        {isCurrentLevel && (
                          <div className="avatar-pulse" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                             <User size={24} color="var(--accent-primary)" strokeWidth={3} />
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{isFinalLevel ? 'Ziel' : `Lvl ${levelIndex + 1}`}</span>
                          <div style={{ fontWeight: 900, fontSize: '1.1rem', color: isCurrentLevel ? 'var(--accent-primary)' : (isFinalLevel ? '#f59e0b' : '#fff') }}>
                             {isFinalLevel && <Flag size={14} style={{ marginRight: '4px' }} />}
                             x{Number(rowMultiplier).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${previewRound?.tilesPerLevel || tilesPerLevel}, minmax(0, 1fr))`, gap: '14px' }}>
                        {Array.from({ length: previewRound?.tilesPerLevel || tilesPerLevel }, (_, tileIndex) => {
                          let background = 'rgba(255,255,255,0.035)';
                          let border = '1px solid rgba(255,255,255,0.08)';
                          let color = 'var(--text-main)';
                          let icon = null;

                          if (resolvedSelection) {
                            if (tileIndex === resolvedSelection.tileIndex && resolvedSelection.result === 'safe') {
                              background = 'linear-gradient(135deg, rgba(16,185,129,0.3) 0%, rgba(5,150,105,0.3) 100%)';
                              border = '2px solid #10b981';
                              color = '#fff';
                              icon = <Shield size={20} />;
                            } else if (tileIndex === resolvedSelection.tileIndex && resolvedSelection.result === 'trap') {
                              background = 'linear-gradient(135deg, rgba(239,68,68,0.3) 0%, rgba(220,38,38,0.3) 100%)';
                              border = '2px solid #ef4444';
                              color = '#fff';
                              icon = <AlertCircle size={20} />;
                            } else if (tileIndex === resolvedSelection.trapIndex) {
                              background = 'rgba(239,68,68,0.1)';
                              border = '1px dashed rgba(239,68,68,0.3)';
                              color = '#fca5a5';
                              icon = <AlertCircle size={16} opacity={0.6} />;
                            } else {
                              background = 'rgba(255,255,255,0.02)';
                              border = '1px solid rgba(255,255,255,0.04)';
                              color = 'rgba(255,255,255,0.2)';
                            }
                          } else if (isCurrentLevel) {
                            background = 'rgba(59,130,246,0.1)';
                            border = '1px solid rgba(59,130,246,0.3)';
                            color = '#bfdbfe';
                          } else if (isUpcomingLevel) {
                            opacity: 0.5;
                          }

                          const isClickable = isCurrentLevel && !resolvedSelection && !actionBusy;

                          return (
                            <button
                              key={tileIndex}
                              onClick={() => isClickable && handlePick(tileIndex)}
                              disabled={!isClickable}
                              className={`tower-tile ${isClickable ? 'clickable' : ''}`}
                              style={{
                                minHeight: '80px',
                                borderRadius: '20px',
                                background,
                                border,
                                color,
                                fontWeight: 800,
                                fontSize: '0.9rem',
                                cursor: isClickable ? 'pointer' : 'default',
                                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                boxShadow: isClickable ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
                              }}
                            >
                              {icon}
                              {isCurrentLevel && !resolvedSelection && !actionBusy ? 'Wählen' : ''}
                              {resolvedSelection && tileIndex === resolvedSelection.tileIndex ? (resolvedSelection.result === 'safe' ? 'Sicher' : 'Falle') : ''}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Ground / Base Camp */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '120px minmax(0, 1fr)',
                  gap: '20px',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderRadius: '24px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  marginTop: '8px'
                }}>
                   <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', borderRight: '1px solid rgba(255,255,255,0.06)', gap: '12px' }}>
                      {!activeRound && (
                         <div className="avatar-pulse">
                            <User size={24} color="var(--text-muted)" strokeWidth={2} />
                         </div>
                      )}
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Basis</div>
                   </div>
                   <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', fontWeight: 600 }}>
                      {activeRound ? 'Viel Erfolg beim Aufstieg!' : 'Wähle deinen Einsatz und starte die Runde.'}
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Main Action Area */}
          <div className="glass-panel" style={{ padding: '32px', borderRadius: '32px', display: 'flex', flexDirection: 'column', gap: '24px', border: '2px solid rgba(59,130,246,0.2)', background: 'linear-gradient(180deg, rgba(59,130,246,0.05) 0%, rgba(30,58,138,0.05) 100%)' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Spielsteuerung</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {!activeRound ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Dein Einsatz</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        min={config?.minBet / 100}
                        max={config?.maxBet / 100}
                        step="0.5"
                        value={Number.isFinite(bet) ? bet / 100 : 0}
                        onChange={(e) => setBet(Math.max(config.minBet, Math.round((Number.parseFloat(e.target.value || '0') || 0) * 100)))}
                        disabled={isGuest}
                        className="input-primary"
                        style={{ padding: '16px 20px', fontSize: '1.2rem', fontWeight: 800, width: '100%', borderRadius: '18px', paddingRight: '60px' }}
                      />
                      <span style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: 'var(--text-muted)' }}>KC</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Risiko-Stufe</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                      {config?.allowedTilesPerLevel.map((value) => {
                        const isSelected = value === tilesPerLevel;
                        const previewTable = config.multiplierPreviews?.[value] || [1];
                        return (
                          <button
                            key={value}
                            onClick={() => setTilesPerLevel(value)}
                            style={{
                              padding: '16px',
                              borderRadius: '18px',
                              border: isSelected ? '2px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.08)',
                              background: isSelected ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <span style={{ fontWeight: 800, fontSize: '1rem', color: isSelected ? '#fff' : 'var(--text-muted)' }}>{value} Tiles</span>
                            <span style={{ color: isSelected ? 'var(--accent-primary)' : 'rgba(255,255,255,0.3)', fontSize: '0.75rem', fontWeight: 700 }}>Max x{Number(previewTable[previewTable.length - 1] || 1).toFixed(1)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    className="btn-primary"
                    onClick={handleStart}
                    disabled={isGuest || actionBusy}
                    style={{ padding: '20px', borderRadius: '20px', fontSize: '1.2rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', boxShadow: '0 10px 20px rgba(59, 130, 246, 0.2)', marginTop: '8px' }}
                  >
                    <Play size={24} fill="currentColor" />
                    Runde starten ({formatKC(bet)} KC)
                  </button>
                </>
              ) : (
                <>
                  <div style={{ padding: '20px', borderRadius: '24px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>
                        <span>Aktueller Einsatz</span>
                        <span style={{ color: '#fff' }}>{formatKC(activeRound.bet)} KC</span>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>
                        <span>Erreichte Ebene</span>
                        <span style={{ color: '#fff' }}>{activeRound.currentLevel} / {config?.levelCount}</span>
                     </div>
                     <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }}></div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 800 }}>Auszahlung</span>
                        <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#10b981' }}>{formatKC(activeRound.currentPayout)} KC</span>
                     </div>
                  </div>

                  <button
                    className="btn-secondary"
                    onClick={handleCashout}
                    disabled={!activeRound?.canCashout || actionBusy}
                    style={{ padding: '20px', borderRadius: '20px', fontSize: '1.2rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', color: '#fff', opacity: activeRound?.canCashout ? 1 : 0.5, boxShadow: activeRound?.canCashout ? '0 10px 20px rgba(16, 185, 129, 0.2)' : 'none' }}
                  >
                    <Coins size={24} />
                    Cashout ({formatKC(activeRound.currentPayout)} KC)
                  </button>

                  {!activeRound.canCashout && (
                    <p style={{ margin: 0, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
                       Du musst mindestens LVL 1 erreichen für einen Cashout.
                    </p>
                  )}
                </>
              )}

              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '20px',
                borderRadius: '24px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                cursor: isGuest ? 'not-allowed' : 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={autoStartRounds}
                  onChange={(e) => setAutoStartRounds(e.target.checked)}
                  disabled={isGuest}
                  style={{ width: '22px', height: '22px', accentColor: 'var(--accent-primary)' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Auto-Start</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Nächste Runde autom. starten</span>
                </div>
              </label>
            </div>
          </div>

          {/* History Panel */}
          <div className="glass-panel" style={{ padding: '24px', borderRadius: '32px', display: 'flex', flexDirection: 'column', gap: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
               <RotateCcw size={20} color="var(--text-muted)" />
               <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Verlauf</h3>
            </div>
            
            {(history.length === 0 && !latestRound) ? (
              <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>Keine Runden gefunden.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[...(latestRound ? [latestRound] : []), ...history.filter((entry) => entry.id !== latestRound?.id)].slice(0, 5).map((round) => {
                  const meta = STATUS_META[round.status] || STATUS_META.idle;
                  return (
                    <div key={round.id} style={{ padding: '16px', borderRadius: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>LVL {round.currentLevel} · {round.tilesPerLevel} Tiles</span>
                        <span style={{ padding: '4px 10px', borderRadius: '999px', background: meta.bg, color: meta.color, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>{meta.label}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatKC(round.bet)} KC → x{Number(round.currentMultiplier || 1).toFixed(2)}</span>
                         <span style={{ fontWeight: 800, color: round.payout > 0 ? '#10b981' : 'var(--text-muted)' }}>{round.payout > 0 ? `+${formatKC(round.payout)}` : '0.00'} KC</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .tower-tile {
          position: relative;
          overflow: hidden;
        }
        .tower-tile.clickable:hover {
          transform: translateY(-4px);
          background: rgba(59,130,246,0.18) !important;
          border-color: rgba(59,130,246,0.5) !important;
          box-shadow: 0 8px 20px rgba(59,130,246,0.2) !important;
        }
        .tower-tile.clickable:active {
          transform: scale(0.96) translateY(-2px);
        }
        .avatar-pulse {
          animation: avatarPulse 2s infinite ease-in-out;
        }
        @keyframes avatarPulse {
          0% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.15); opacity: 1; filter: drop-shadow(0 0 8px rgba(59,130,246,0.5)); }
          100% { transform: scale(1); opacity: 0.8; }
        }
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `}} />
    </div>
  );
};

export default TowerClimb;
