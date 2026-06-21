import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useRouletteGame } from '../features/roulette/hooks/useRouletteGame';
import { useCountdownTimer } from '../features/casino/hooks/useCountdownTimer';
import RouletteWheel from '../features/roulette/components/RouletteWheel';
import RouletteBettingTable from '../features/roulette/components/RouletteBettingTable';
import RouletteChipSelector from '../features/roulette/components/RouletteChipSelector';
import RoulettePhaseBar from '../features/roulette/components/RoulettePhaseBar';
import RouletteSettlement from '../features/roulette/components/RouletteSettlement';
import RouletteHistory from '../features/roulette/components/RouletteHistory';
import '../features/roulette/roulette.css';

export default function Roulette({ socket }) {
  const { user, setUser, isGuest } = useAuth();
  const { showToast } = useToast();

  const {
    roomState,
    loading,
    isParticipant,
    myBets,
    selectedChip,
    setSelectedChip,
    lastWheelSpin,
    busy,
    roundHistory,
    lastBets,
    autobet,
    setAutobet,
    handleToggleAutobet,
    eraseMode,
    setEraseMode,
    isReady,
    handleJoin,
    handleLeave,
    handlePlaceBet,
    handleRemoveBet,
    handleRebet,
    handleReady,
  } = useRouletteGame({ socket, user, setUser, showToast });

  const phaseSecondsLeft = useCountdownTimer(roomState?.deadlineAt) ?? 0;

  const phase = roomState?.currentPhase || 'waiting';
  const canBet = isParticipant && phase === 'betting_open';
  const spinning = phase === 'spin';

  // Per-player chip colors (current user = gold, others get assigned colors)
  const PLAYER_COLORS = ['#4a9eff','#e74c3c','#2ecc71','#9b59b6','#e67e22','#1abc9c','#e91e63','#ff9800'];
  const playerColors = {};
  if (roomState?.participants) {
    let colorIdx = 0;
    roomState.participants.forEach(p => {
      if (String(p.userId) === String(user?.id)) {
        playerColors[String(p.userId)] = '#c9a84c'; // gold for self
      } else {
        playerColors[String(p.userId)] = PLAYER_COLORS[colorIdx++ % PLAYER_COLORS.length];
      }
    });
  }

  // Per-field per-player bets: { betType: { userId: totalAmount } }
  const playerBets = {};
  if (roomState?.currentRoundBets) {
    Object.entries(roomState.currentRoundBets).forEach(([uid, bets]) => {
      bets.forEach(bet => {
        if (!playerBets[bet.type]) playerBets[bet.type] = {};
        playerBets[bet.type][uid] = (playerBets[bet.type][uid] || 0) + bet.amount;
      });
    });
  }

  if (loading) {
    return (
      <div className="roulette-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ color: 'var(--r-gold-dim)', fontFamily: 'Playfair Display, serif', fontSize: '18px', letterSpacing: '0.2em' }}>
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="roulette-page">
      <div className="roulette-header">
        <h1>Roulette</h1>
        <div className="roulette-header-rule">European</div>
      </div>

      {/* Phase bar */}
      <div style={{ maxWidth: 1100, margin: '0 auto 20px' }}>
        <RoulettePhaseBar
          phase={phase}
          secondsLeft={phaseSecondsLeft}
        />
      </div>

      <div className="roulette-layout">
        {/* Left column: wheel + players + controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <RouletteWheel
            spinResult={roomState?.spinResult}
            spinning={spinning}
          />

          {/* Join/Leave + Rebet */}
          {!isGuest && !isParticipant && (
            <button className="roulette-join-btn" onClick={handleJoin} disabled={busy}>
              Join Table
            </button>
          )}
          {isParticipant && (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="roulette-rebet-btn"
                  onClick={handleRebet}
                  disabled={!canBet || lastBets.length === 0}
                  title={lastBets.length > 0 ? `Repeat ${lastBets.length} bet(s) from last round` : 'No previous bets'}
                >
                  ↺ Rebet {lastBets.length > 0 ? `(${lastBets.length})` : ''}
                </button>
                <button
                  className={`roulette-autobet-btn${autobet ? ' roulette-autobet-btn--active' : ''}`}
                  onClick={handleToggleAutobet}
                  disabled={lastBets.length === 0}
                  title="Automatically place last bets each new round"
                >
                  {autobet ? '⟳ Auto ON' : '⟳ Auto OFF'}
                </button>
                {canBet && (
                  <button
                    className={`roulette-ready-btn${isReady ? ' roulette-ready-btn--active' : ''}`}
                    onClick={handleReady}
                    disabled={isReady}
                    title={`Ready (${roomState?.readyCount ?? 0}/${roomState?.activeCount ?? 0})`}
                  >
                    {isReady ? `✓ Ready (${roomState?.readyCount}/${roomState?.activeCount})` : `Ready (${roomState?.readyCount ?? 0}/${roomState?.activeCount ?? 0})`}
                  </button>
                )}
              </div>
              <button className="roulette-leave-btn" onClick={handleLeave} disabled={busy}>
                Leave Table
              </button>
            </>
          )}

          {/* Players */}
          <div className="roulette-players">
            <h3>At the Table</h3>
            {roomState?.participants?.length === 0 && (
              <div style={{ color: 'var(--r-text-dim)', fontSize: 12 }}>No players yet</div>
            )}
            {roomState?.participants?.map(p => (
              <div key={p.userId} className={`player-row ${p.left ? 'player-left' : ''}`}>
                <span className="player-name">{p.username}</span>
                {p.sessionPnl !== 0 && (
                  <span style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: p.sessionPnl > 0 ? '#2ecc71' : '#c0392b' }}>
                    {p.sessionPnl > 0 ? '+' : ''}{p.sessionPnl?.toLocaleString()} KC
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Round history */}
          <RouletteHistory history={roundHistory} />
        </div>

        {/* Right column: table + chips + bets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <RouletteBettingTable
            onBet={eraseMode ? handleRemoveBet : handlePlaceBet}
            onRemove={handleRemoveBet}
            canBet={canBet}
            eraseMode={eraseMode}
            myUserId={String(user?.id ?? '')}
            playerBets={playerBets}
            playerColors={playerColors}
            playerSkins={roomState?.playerSkins || {}}
          />

          {/* Chip selector */}
          {isParticipant && (
            <RouletteChipSelector
              selected={selectedChip}
              onSelect={setSelectedChip}
              disabled={!canBet}
              eraseMode={eraseMode}
              onToggleErase={setEraseMode}
            />
          )}

          {/* My bets this round */}
          {(() => {
            const showPhase = phase === 'settlement' || phase === 'waiting';
            const myPayouts = showPhase
              ? (roomState?.lastPayouts?.[String(user?.id)] || roomState?.lastPayouts?.[Number(user?.id)] || null)
              : null;
            const betsToShow = myPayouts || myBets;
            if (!betsToShow || betsToShow.length === 0) return null;
            return (
              <div className="my-bets-summary">
                <h4>Your Bets</h4>
                {betsToShow.map((b, i) => {
                  const isWon = b.status === 'won';
                  const isLost = b.status === 'lost';
                  return (
                    <div key={b.betId || i} className={`my-bet-row${isWon ? ' my-bet-row--won' : isLost ? ' my-bet-row--lost' : ''}`}>
                      <span>{b.type}</span>
                      <span className="my-bet-amount">
                        {isWon && <span className="my-bet-result">+{b.payout} KC &nbsp;</span>}
                        {b.amount} KC
                      </span>
                    </div>
                  );
                })}
                {(() => {
                  const net = myPayouts
                    ? betsToShow.reduce((s, b) => s + (b.status === 'won' ? b.payout : b.status === 'lost' ? -b.amount : b.amount), 0)
                    : betsToShow.reduce((s, b) => s + b.amount, 0);
                  const isNet = myPayouts != null;
                  return (
                    <div className="my-bet-row" style={{ marginTop: 4, color: isNet ? (net >= 0 ? '#2ecc71' : '#c0392b') : 'var(--r-gold)', fontWeight: 700 }}>
                      <span>{isNet ? 'Net' : 'Total'}</span>
                      <span>{isNet && net > 0 ? '+' : ''}{net} KC</span>
                    </div>
                  );
                })()}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Settlement toast */}
      <RouletteSettlement
        settlement={roomState?.lastSettlement}
        userId={user?.id}
        spinResult={roomState?.spinResult}
      />
    </div>
  );
}
