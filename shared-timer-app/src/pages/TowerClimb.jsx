import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Coins, Play, RotateCcw, Shield, TrendingUp, Trophy } from 'lucide-react';
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
  const [visibleLevelCount, setVisibleLevelCount] = useState(4);
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

  const towerLevels = useMemo(() => {
    if (!previewRound?.levelCount) return [];
    return Array.from({ length: previewRound.levelCount }, (_, index) => previewRound.levelCount - index - 1);
  }, [previewRound]);

  const targetVisibleLevelCount = useMemo(() => {
    if (!previewRound?.levelCount) return 0;
    if (activeRound) {
      return Math.min(previewRound.levelCount, Math.max(4, activeRound.currentLevel + 3));
    }
    if (latestRound?.selectedTiles?.length) {
      return Math.min(previewRound.levelCount, Math.max(4, latestRound.currentLevel + 2));
    }
    return Math.min(previewRound.levelCount, 4);
  }, [activeRound, latestRound, previewRound]);

  useEffect(() => {
    if (!targetVisibleLevelCount) {
      setVisibleLevelCount(0);
      return undefined;
    }

    if (targetVisibleLevelCount <= visibleLevelCount) {
      setVisibleLevelCount(targetVisibleLevelCount);
      return undefined;
    }

    const revealTimer = window.setInterval(() => {
      setVisibleLevelCount((current) => {
        if (current >= targetVisibleLevelCount) {
          window.clearInterval(revealTimer);
          return current;
        }
        return current + 1;
      });
    }, 90);

    return () => window.clearInterval(revealTimer);
  }, [targetVisibleLevelCount, visibleLevelCount]);

  const visibleTowerLevels = useMemo(
    () => towerLevels.slice(-visibleLevelCount),
    [towerLevels, visibleLevelCount]
  );

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

  const handleResetView = async () => {
    setLatestRound(null);
    await refreshHistory();
  };

  if (loading) {
    return <div className="flex-center" style={{ minHeight: '60vh', opacity: 0.65 }}>Tower Climb wird geladen...</div>;
  }

  if (!config) {
    return <div className="flex-center" style={{ minHeight: '60vh', color: '#ef4444' }}>{error || 'Konfiguration konnte nicht geladen werden.'}</div>;
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1180px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '48px' }}>
      <div className="glass-panel" style={{ padding: '28px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={28} color="var(--accent-primary)" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '2.2rem' }}>Tower Climb</h1>
              <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', maxWidth: '780px' }}>
                Setze KoalaCoins, wähle pro Ebene ein Feld und entscheide nach jedem sicheren Schritt, ob du weiter riskierst oder deinen Gewinn sicherst.
              </p>
            </div>
          </div>
        </div>

        {isGuest && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '16px', padding: '14px 16px', color: '#fcd34d', flexWrap: 'wrap' }}>
            <AlertCircle size={18} />
            <span style={{ flex: 1, minWidth: '220px' }}>Tower Climb nutzt die interne KoalaCoin-Ökonomie und ist daher nur für eingeloggte Accounts spielbar.</span>
            <Link to="/login" className="btn-primary" style={{ textDecoration: 'none', padding: '8px 14px' }}>Zum Login</Link>
          </div>
        )}

        {error && (
          <div style={{ padding: '12px 14px', borderRadius: '14px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.22)', color: '#fca5a5' }}>
            {error}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(320px, 0.9fr)', gap: '24px', alignItems: 'start' }}>
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.35rem' }}>Tower Board</h2>
              <div style={{ marginTop: '6px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                {activeRound
                  ? `Aktive Runde auf Level ${activeRound.currentLevel + 1 > activeRound.levelCount ? activeRound.levelCount : activeRound.currentLevel + 1}.`
                  : 'Bereit für eine neue Runde.'}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                className="btn-primary"
                onClick={handleStart}
                disabled={isGuest || !!activeRound || actionBusy}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px' }}
              >
                <Play size={16} />
                Runde starten
              </button>
              <button
                className="btn-secondary"
                onClick={handleCashout}
                disabled={!activeRound?.canCashout || actionBusy}
                style={{ padding: '10px 16px' }}
              >
                Cashout
              </button>
              <button
                className="btn-ghost"
                onClick={handleResetView}
                disabled={!!activeRound || actionBusy}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px' }}
              >
                <RotateCcw size={16} />
                Ergebnis ausblenden
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontWeight: 700, marginBottom: '6px' }}>
                <Coins size={16} />
                Einsatz
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{formatKC(activeRound?.bet ?? bet)} KC</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6', fontWeight: 700, marginBottom: '6px' }}>
                <Shield size={16} />
                Level
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{activeRound?.currentLevel || 0} / {config.levelCount}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8b5cf6', fontWeight: 700, marginBottom: '6px' }}>
                <TrendingUp size={16} />
                Multiplikator
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>x{Number(activeRound?.currentMultiplier || 1).toFixed(2)}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: 700, marginBottom: '6px' }}>
                <Trophy size={16} />
                Cashout-Wert
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                {formatKC(activeRound?.currentPayout || latestRound?.payout || 0)} KC
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {visibleTowerLevels.map((levelIndex, visibleIndex) => {
              const resolvedSelection = previewRound?.selectedTiles?.find((selection) => selection.level === levelIndex);
              const isCurrentLevel = !!activeRound && activeRound.currentLevel === levelIndex;
              const isPastLevel = !!activeRound && levelIndex < activeRound.currentLevel;
              const isUpcomingLevel = !!activeRound && levelIndex > activeRound.currentLevel;
              const rowMultiplier = previewRound?.multiplierTable?.[levelIndex + 1] || 1;

              return (
                <div
                  key={levelIndex}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '88px minmax(0, 1fr)',
                    gap: '14px',
                    alignItems: 'stretch',
                    padding: '14px',
                    borderRadius: '18px',
                    opacity: 1,
                    transform: 'translateY(0)',
                    animation: `fadeInUp 220ms ease ${visibleIndex * 45}ms both`,
                    background: isCurrentLevel ? 'rgba(59,130,246,0.10)' : 'rgba(255,255,255,0.025)',
                    border: isCurrentLevel ? '1px solid rgba(59,130,246,0.28)' : '1px solid rgba(255,255,255,0.05)'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px', paddingRight: '6px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>x{Number(rowMultiplier).toFixed(2)}</div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${previewRound?.tilesPerLevel || tilesPerLevel}, minmax(0, 1fr))`, gap: '10px' }}>
                    {Array.from({ length: previewRound?.tilesPerLevel || tilesPerLevel }, (_, tileIndex) => {
                      let background = 'rgba(255,255,255,0.045)';
                      let border = '1px solid rgba(255,255,255,0.08)';
                      let color = 'var(--text-main)';
                      let label = `Tile ${tileIndex + 1}`;

                      if (resolvedSelection) {
                        if (tileIndex === resolvedSelection.tileIndex && resolvedSelection.result === 'safe') {
                          background = 'rgba(16,185,129,0.20)';
                          border = '1px solid rgba(16,185,129,0.35)';
                          color = '#a7f3d0';
                          label = 'Safe';
                        } else if (tileIndex === resolvedSelection.tileIndex && resolvedSelection.result === 'trap') {
                          background = 'rgba(239,68,68,0.20)';
                          border = '1px solid rgba(239,68,68,0.35)';
                          color = '#fecaca';
                          label = 'Trap';
                        } else if (tileIndex === resolvedSelection.trapIndex) {
                          background = 'rgba(239,68,68,0.12)';
                          border = '1px solid rgba(239,68,68,0.22)';
                          color = '#fca5a5';
                          label = 'Trap';
                        } else {
                          background = 'rgba(255,255,255,0.03)';
                          border = '1px solid rgba(255,255,255,0.04)';
                          color = 'var(--text-muted)';
                          label = 'Clear';
                        }
                      } else if (isCurrentLevel) {
                        background = 'rgba(59,130,246,0.12)';
                        border = '1px solid rgba(59,130,246,0.28)';
                        color = '#bfdbfe';
                        label = 'Pick';
                      } else if (isPastLevel) {
                        background = 'rgba(16,185,129,0.06)';
                        border = '1px solid rgba(16,185,129,0.12)';
                        color = '#cbd5e1';
                        label = 'Done';
                      } else if (isUpcomingLevel) {
                        background = 'rgba(148,163,184,0.06)';
                        border = '1px solid rgba(148,163,184,0.12)';
                        color = 'var(--text-muted)';
                        label = 'Locked';
                      }

                      const isClickable = isCurrentLevel && !resolvedSelection && !actionBusy;

                      return (
                        <button
                          key={tileIndex}
                          onClick={() => isClickable && handlePick(tileIndex)}
                          disabled={!isClickable}
                          style={{
                            minHeight: '64px',
                            borderRadius: '14px',
                            background,
                            border,
                            color,
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            cursor: isClickable ? 'pointer' : 'default',
                            transition: 'all 0.18s ease',
                            opacity: isClickable ? 1 : 0.94
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {visibleLevelCount < towerLevels.length && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '16px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(59,130,246,0.05))',
                border: '1px dashed rgba(59,130,246,0.16)'
              }}>
                Weitere Ebenen blenden sich beim Klettern automatisch ein.
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glass-panel" style={{ padding: '22px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Round Setup</h3>
              <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Wähle deinen Einsatz und die Anzahl an Tiles pro Ebene. Weniger Tiles bedeuten hier das höhere Risiko und daher stärkere Multiplikatoren.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Einsatz (in KC)</label>
              <input
                type="number"
                min={config.minBet / 100}
                max={config.maxBet / 100}
                step="0.5"
                value={Number.isFinite(bet) ? bet / 100 : 0}
                onChange={(e) => setBet(Math.max(config.minBet, Math.round((Number.parseFloat(e.target.value || '0') || 0) * 100)))}
                disabled={!!activeRound || isGuest}
                className="input-primary"
                style={{ padding: '12px 14px' }}
              />
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Minimum {formatKC(config.minBet)} KC, Maximum {formatKC(config.maxBet)} KC
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tiles pro Ebene</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                {config.allowedTilesPerLevel.map((value) => {
                  const isSelected = value === tilesPerLevel;
                  const previewTable = config.multiplierPreviews?.[value] || [1];
                  return (
                    <button
                      key={value}
                      onClick={() => setTilesPerLevel(value)}
                      disabled={!!activeRound}
                      className="btn-ghost"
                      style={{
                        padding: '12px',
                        borderRadius: '14px',
                        border: isSelected ? '1px solid rgba(59,130,246,0.35)' : '1px solid rgba(255,255,255,0.08)',
                        background: isSelected ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: '4px'
                      }}
                    >
                      <span style={{ fontWeight: 800 }}>{value} Tiles</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Top: x{Number(previewTable[previewTable.length - 1] || 1).toFixed(2)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <label style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              padding: '12px 14px',
              borderRadius: '14px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              cursor: isGuest ? 'not-allowed' : 'pointer',
              opacity: isGuest ? 0.6 : 1
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontWeight: 700 }}>Runden automatisch starten</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  Nach Verlust oder Cashout startet automatisch eine neue Runde mit denselben Einstellungen.
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoStartRounds}
                onChange={(e) => setAutoStartRounds(e.target.checked)}
                disabled={isGuest}
                style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)', cursor: isGuest ? 'not-allowed' : 'pointer' }}
              />
            </label>
          </div>

          <div className="glass-panel" style={{ padding: '22px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem' }}>History</h3>
            {(history.length === 0 && !latestRound) ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Noch keine abgeschlossenen Tower-Runden.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[...(latestRound ? [latestRound] : []), ...history.filter((entry) => entry.id !== latestRound?.id)].slice(0, 8).map((round) => {
                  const meta = STATUS_META[round.status] || STATUS_META.idle;
                  return (
                    <div key={round.id} style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                        <strong style={{ fontSize: '0.92rem' }}>{round.tilesPerLevel} Tiles · Level {round.currentLevel}/{round.levelCount}</strong>
                        <span style={{ padding: '5px 9px', borderRadius: '999px', background: meta.bg, color: meta.color, fontSize: '0.74rem', fontWeight: 700 }}>
                          {meta.label}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        <span>Bet: {formatKC(round.bet)} KC</span>
                        <span>x{Number(round.currentMultiplier || 1).toFixed(2)}</span>
                        <span style={{ textAlign: 'right', color: round.payout > 0 ? '#10b981' : 'var(--text-muted)' }}>
                          {round.payout > 0 ? `+${formatKC(round.payout)} KC` : '0.00 KC'}
                        </span>
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
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}} />
    </div>
  );
};

export default TowerClimb;
