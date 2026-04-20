import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, RotateCcw, Coins, Crown, Loader2, LogIn, ShieldAlert, Trophy, UserRound } from 'lucide-react';
import EVENTS from '../../socketEvents.json';
import Avatar from '../components/Avatar';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchJson } from '../utils/apiClient';

const formatKC = (cents) => `${(cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KC`;
const CHIP_VALUES = [1, 5, 10, 50, 100, 500, 1000];
const TABLE_OPTIONS = [3, 5];
const TURN_TIMEOUT_SECONDS = 90;

const STATUS_LABELS = {
  waiting: 'Wartet auf Spieler',
  betting: 'Einsätze werden platziert',
  dealing: 'Karten werden ausgeteilt',
  player_turns: 'Spieler am Zug',
  dealer_turn: 'Dealer spielt',
  settlement: 'Abrechnung läuft'
};

const RESULT_META = {
  win: { label: 'Win', color: '#22c55e', bg: 'rgba(34,197,94,0.18)' },
  lose: { label: 'Lose', color: '#ef4444', bg: 'rgba(239,68,68,0.18)' },
  push: { label: 'Push', color: '#facc15', bg: 'rgba(250,204,21,0.18)' },
  blackjack: { label: 'Blackjack', color: '#fbbf24', bg: 'rgba(245,158,11,0.18)' },
  bust: { label: 'Bust', color: '#fb7185', bg: 'rgba(244,63,94,0.18)' }
};

const cardSuitMap = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
  hidden: '🂠'
};

function getRoomId(maxPlayers) {
  return `blackjack-main-${maxPlayers}`;
}

function normalizeRoomSlug(value, maxPlayers) {
  const trimmed = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);

  if (!trimmed) {
    return `blackjack-${maxPlayers}-${Date.now().toString(36).slice(-5)}`;
  }

  return `blackjack-${maxPlayers}-${trimmed}`;
}

function buildChipBreakdown(amountCents) {
  let remaining = Math.floor((amountCents || 0) / 100);
  return [...CHIP_VALUES]
    .sort((a, b) => b - a)
    .flatMap((chip) => {
      const count = Math.floor(remaining / chip);
      remaining %= chip;
      return Array.from({ length: count }, () => chip);
    });
}

function cardStyle(card) {
  const red = card?.suit === 'hearts' || card?.suit === 'diamonds';
  return {
    width: '58px',
    height: '84px',
    borderRadius: '14px',
    border: card?.visible === false ? '1px solid rgba(245,158,11,0.22)' : '1px solid rgba(255,255,255,0.14)',
    background: card?.visible === false
      ? 'linear-gradient(145deg, rgba(18,24,38,0.98), rgba(34,45,68,0.95))'
      : 'linear-gradient(180deg, rgba(250,250,250,0.98), rgba(235,241,248,0.94))',
    color: card?.visible === false ? '#f8fafc' : (red ? '#dc2626' : '#111827'),
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '8px',
    boxShadow: '0 12px 24px rgba(0,0,0,0.24)',
    fontWeight: 800
  };
}

function getSeatClass(maxPlayers, seat) {
  return `blackjack-seat blackjack-seat-${maxPlayers}-${seat}`;
}

function hasActiveRound(room) {
  if (!room) return false;
  return !['waiting', 'betting'].includes(room.status);
}

function getVisualSeat(seat, mySeat, maxPlayers) {
  if (!mySeat || !maxPlayers) return seat;
  return ((seat - mySeat + maxPlayers) % maxPlayers) + 1;
}

function getActualSeat(visualSeat, mySeat, maxPlayers) {
  if (!mySeat || !maxPlayers) return visualSeat;
  return ((visualSeat + mySeat - 2) % maxPlayers) + 1;
}

function getTableStatusMeta(roomState, userId, turnCountdownSeconds, autoStartSeconds) {
  if (roomState?.currentPlayerTurn === userId) {
    return {
      label: 'Dein Zugtimer',
      seconds: turnCountdownSeconds,
      color: '#fbbf24',
      copy: 'Zeit fuer Hit oder Stand.'
    };
  }

  if (autoStartSeconds !== null) {
    return {
      label: 'Naechste Runde',
      seconds: autoStartSeconds,
      color: '#f8fafc',
      copy: 'Der Tisch teilt danach automatisch aus.'
    };
  }

  return {
    label: 'Tischstatus',
    seconds: 0,
    color: '#f8fafc',
    copy: 'Warte auf den naechsten Einsatz.'
  };
}

function buildRealisticStack(amountCents) {
  const values = [100000, 50000, 10000, 5000, 2500, 1000, 500, 100]; // in cents
  let remaining = amountCents;
  const stack = [];
  for (const v of values) {
    while (remaining >= v && stack.length < 15) {
      stack.push(v / 100);
      remaining -= v;
    }
  }
  return stack.reverse(); // Bottom to top
}

function ChipStack({ amount, onClick, isPending }) {
  const chips = buildRealisticStack(amount);
  const [showTooltip, setShowTooltip] = useState(false);

  if (!amount || amount <= 0) return null;

  return (
    <div 
      className={`blackjack-realistic-stack ${isPending ? 'pending' : ''}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={onClick}
    >
      <div className="chips-container">
        {chips.map((val, i) => (
          <div
            key={i}
            className="casino-chip-layered"
            style={{
              '--chip-color': val >= 1000 ? '#1e1b4b' : val >= 500 ? '#7c3aed' : val >= 100 ? '#dc2626' : val >= 50 ? '#0ea5e9' : val >= 25 ? '#ec4899' : val >= 10 ? '#22c55e' : val >= 5 ? '#f59e0b' : '#f8fafc',
              bottom: `${i * 4}px`,
              left: `${i * 0.4}px`, // Slight 3D shift
              zIndex: i,
              boxShadow: `0 ${2 + i*0.5}px ${4 + i*0.5}px rgba(0,0,0,0.4)` // Deepening shadows
            }}
          >
             <div className="chip-inner-ring" />
             <span className="chip-val-tiny" style={{ opacity: i === chips.length - 1 ? 1 : 0.6 }}>{val}</span>
          </div>
        ))}
      </div>

      {showTooltip && (
        <div className="chip-stack-tooltip">
          {formatKC(amount)}
          {isPending && <span className="pending-tag">PENDING (Click to clear)</span>}
        </div>
      )}
    </div>
  );
}

function SettlementToast({ settlements }) {
  if (!settlements || settlements.length === 0) return null;

  const totalNet = settlements.reduce((sum, s) => sum + (Number(s.netProfit) || 0), 0);
  const isPush = settlements.every(s => s.result === 'push');
  
  let label = '';
  let color = '#fbbf24';
  if (totalNet > 0) {
    label = `+${formatKC(totalNet)}`;
    color = '#4ade80';
  } else if (totalNet < 0) {
    label = formatKC(totalNet);
    color = '#f87171';
  } else if (isPush) {
    label = 'PUSH';
    color = '#fbbf24';
  } else {
    return null;
  }

  return (
    <div className="blackjack-settlement-toast">
       <div className="toast-glow" style={{ '--toast-color': color }} />
       <div className="toast-text" style={{ color }}>{label}</div>
    </div>
  );
}

function BlackjackCelebration({ active }) {
  if (!active) return null;

  return (
    <div className="blackjack-celebration-overlay">
      <div className="confetti-container">
        {Array.from({ length: 16 }).map((_, i) => (
          <div 
            key={i} 
            className="confetti-particle" 
            style={{ 
              '--angle': `${i * 22.5}deg`, 
              '--delay': `${i * 20}ms`,
              '--color': ['#fbbf24', '#f59e0b', '#fcd34d', '#fff'][i % 4]
            }} 
          />
        ))}
      </div>
      <div className="blackjack-pop-text">BLACKJACK!</div>
    </div>
  );
}

function PlayingCard({ card, index = 0, compact = false }) {
  return (
    <div
      className={`blackjack-card${compact ? ' compact' : ''}${card?.visible === false ? ' hidden-card' : ''}`}
      style={{
        ...cardStyle(card),
        animation: `blackjackDealIn 460ms cubic-bezier(0.16, 1, 0.3, 1) both`,
        animationDelay: `${index * 90}ms`,
        transformOrigin: card?.visible === false ? 'center center' : 'top center'
      }}
    >
      <span style={{ fontSize: '1rem' }}>{card?.visible === false ? '?' : card?.rank}</span>
      <span style={{ alignSelf: 'center', fontSize: '1.35rem' }}>{cardSuitMap[card?.suit] || '♠'}</span>
      <span style={{ alignSelf: 'flex-end', transform: 'rotate(180deg)', fontSize: '1rem' }}>{card?.visible === false ? '?' : card?.rank}</span>
    </div>
  );
}

function getDealerStatusText(roomState) {
  if (roomState?.status === 'betting' || roomState?.status === 'waiting') return 'Waiting for bets';
  if (roomState?.status === 'dealing') return 'Dealing';
  if (roomState?.status === 'dealer_turn') {
    if (roomState?.dealerPhase === 'reveal') return 'Dealer reveals hole card';
    if (roomState?.dealerPhase === 'draw') return 'Dealer draws';
    if (roomState?.dealerPhase === 'stand') return 'Dealer stands';
    if (roomState?.dealerPhase === 'bust') return 'Dealer busts';
    return 'Dealer turn';
  }
  if (roomState?.status === 'settlement') {
    if ((roomState?.dealerHandValue || 0) > 21) return 'Dealer busts';
    return 'Dealer stands';
  }

  return 'Waiting for bets';
}

function getSeatResultMeta(settlement) {
  if (!settlement) return null;
  return RESULT_META[settlement.result] || RESULT_META.push;
}

function getPlayerStatusLabel(player, roomState, settlement, isCurrentTurn, isLocalPlayer) {
  if (settlement) {
    return getSeatResultMeta(settlement)?.label || 'Push';
  }
  if (!player?.userId) return 'Open seat';
  if (player.blackjack) return 'Blackjack';
  if (player.busted) return 'Bust';
  if (player.stood) return 'Stand';
  if (isCurrentTurn && isLocalPlayer) return 'Your turn';
  if (isCurrentTurn) return 'Turn';
  if (roomState?.status === 'dealing') return 'Dealing';
  if (['waiting', 'betting'].includes(roomState?.status)) return player.currentBet > 0 ? 'Betting' : 'Waiting';
  return 'Waiting';
}

function DealerHand({ roomState }) {
  const isBlackjack = roomState?.dealerHandValue === 21 && roomState?.dealerHand?.length === 2;
  return (
    <div className="blackjack-dealer-zone">
      <BlackjackCelebration active={isBlackjack} />
      <div className="blackjack-dealer-header" style={{ marginBottom: (roomState?.dealerHand?.length || 0) > 0 ? '10px' : '0' }}>
        <div className="blackjack-dealer-status" style={{ fontWeight: 800, color: '#facc15', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem' }}>
          {getDealerStatusText(roomState)}
        </div>
        {(roomState?.dealerHand?.length || 0) > 0 && (
          <div className="blackjack-value-badge" style={{ padding: '2px 8px' }}>Value {roomState?.dealerHandValue ?? 0}</div>
        )}
      </div>

      <div className="blackjack-dealer-cards">
        {(roomState?.dealerHand || []).map((card, index) => <PlayingCard key={`${card.code}-${index}`} card={card} index={index} />)}
      </div>
    </div>
  );
}

function FeltPile({ label, count, side = 'left', accent = '#f8fafc' }) {
  return (
    <div className={`blackjack-felt-pile ${side}`}>
      <div className="blackjack-felt-pile-cards">
        <div className="blackjack-felt-pile-card shadow" />
        <div className="blackjack-felt-pile-card top" />
      </div>
      <div className="blackjack-felt-pile-meta">
        <div className="blackjack-felt-pile-label">{label}</div>
        <div className="blackjack-felt-pile-count" style={{ color: accent }}>{count}</div>
      </div>
    </div>
  );
}

function SeatControls({ isLocalPlayer, roomState, isCurrentTurn, onHit, onStand, onDouble, onSplit, onChipAdd, onChipSub, onBetSubmit, pendingBet, canDouble, canSplit, balance }) {
  if (!isLocalPlayer) return null;

  const isBetting = roomState?.status === 'betting' || roomState?.status === 'waiting';
  const hasEnoughForSplit = balance >= (roomState?.players?.find(p => p.userId === roomState?.currentPlayerTurn)?.hands[0]?.bet || 0);

  return (
    <div className="blackjack-seat-controls-wrapper">
      {isBetting && (
        <div className="blackjack-chip-tray vertical-side">
          {[1, 5, 25, 100, 500].map(val => (
            <button
              key={val}
              className="blackjack-casino-chip"
              onClick={() => onChipAdd(val * 100)}
              style={{
                 '--chip-color': val >= 500 ? '#7c3aed' : val >= 100 ? '#dc2626' : val >= 25 ? '#ec4899' : val >= 5 ? '#f59e0b' : '#f8fafc',
                 color: val >= 25 ? '#fff' : '#111827'
              }}
            >
              {val}
            </button>
          ))}
          {pendingBet > 0 && (
            <button 
              className="blackjack-deal-button mini"
              onClick={() => onBetSubmit(pendingBet)}
            >
              DEAL
            </button>
          )}
        </div>
      )}

      {isCurrentTurn && roomState?.status === 'player_turns' && (
        <div className="blackjack-action-column">
          <button className="blackjack-action-btn-long hit" onClick={onHit}>Hit</button>
          <button className="blackjack-action-btn-long stand" onClick={onStand}>Stand</button>
          {canDouble && (
            <button className="blackjack-action-btn-long double" onClick={onDouble}>Double</button>
          )}
          {canSplit && (
            <div style={{ position: 'relative' }}>
              <button 
                className="blackjack-action-btn-long split" 
                onClick={onSplit}
                disabled={!hasEnoughForSplit}
              >
                Split
              </button>
              {!hasEnoughForSplit && (
                <div style={{ position: 'absolute', top: '100%', right: 0, whiteSpace: 'nowrap', fontSize: '0.65rem', color: '#f87171', marginTop: '4px', fontWeight: 700 }}>
                  Low Balance
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PlayerSeat({
  player,
  selectedTable,
  roomState,
  settlements, // Array of settlements for this player
  isCurrentTurn,
  isLocalPlayer,
  canSelectEmptySeat,
  onSelectEmptySeat,
  onHit,
  onStand,
  onDouble,
  onSplit,
  onChipAdd,
  onChipSub,
  onBetSubmit,
  pendingBet,
  balance
}) {
  const isWinningSeat = (settlements || []).some(s => Number(s.netProfit || 0) > 0);
  const seatClassName = `${getSeatClass(roomState?.maxPlayers || selectedTable, player.visualSeat)}${isCurrentTurn ? ' current-turn' : ''}${isWinningSeat ? ' winner-seat' : ''}${isLocalPlayer ? ' local-seat' : ''}`;

  if (!player.userId) {
    return (
      <div key={`seat-${player.visualSeat}`} className={`${getSeatClass(roomState?.maxPlayers || selectedTable, player.visualSeat)} blackjack-seat-empty`}>
        <button
          type="button"
          className={`blackjack-seat-empty-shell${canSelectEmptySeat ? ' is-clickable' : ''}`}
          onClick={() => canSelectEmptySeat && onSelectEmptySeat?.(player)}
          disabled={!canSelectEmptySeat}
        >
          <UserRound size={18} />
          <div className="blackjack-seat-empty-title">Open seat</div>
          <div className="blackjack-seat-empty-copy">Seat {player.visualSeat}</div>
        </button>
      </div>
    );
  }

  const activeHand = player.hands?.[player.activeHandIndex] || null;
  const canSplit = player.hands?.length === 1 && player.hands[0].cards?.length === 2 && player.hands[0].cards[0].rank === player.hands[0].cards[1].rank;
  const isBettingPhase = roomState?.status === 'betting' || roomState?.status === 'waiting';

  return (
    <div key={player.userId} className={seatClassName}>
      <div className="blackjack-seat-layout-horizontal">
        <SeatControls
          isLocalPlayer={isLocalPlayer}
          roomState={roomState}
          isCurrentTurn={isCurrentTurn}
          onHit={onHit}
          onStand={onStand}
          onDouble={onDouble}
          onSplit={onSplit}
          onChipAdd={onChipAdd}
          onChipSub={onChipSub}
          onBetSubmit={onBetSubmit}
          pendingBet={pendingBet}
          canDouble={activeHand?.cards?.length === 2}
          canSplit={canSplit}
          balance={balance}
        />

        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '8px' }}>
          <div className="blackjack-seat-box-actual">
            <BlackjackCelebration active={(player.hands || []).some(h => h.blackjack)} />
            {isCurrentTurn && <div className="blackjack-turn-arrow">{isLocalPlayer ? 'YOUR TURN' : 'TURN'}</div>}
            
            {/* Hands/Cards Area */}
            <div style={{ flex: 1, display: 'flex', gap: '10px', alignItems: 'flex-start', paddingBottom: '10px' }}>
              {(player.hands || []).map((hand, hIdx) => {
                const isActive = isCurrentTurn && player.activeHandIndex === hIdx;
                return (
                  <div 
                    key={`hand-${hIdx}`} 
                    className={`blackjack-hand-card-slot ${isActive ? 'active' : ''}`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="blackjack-value-badge" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                        {hand.blackjack ? 'BJ' : hand.value}
                      </div>
                    </div>

                    <div className="blackjack-hand-wrap" style={{ minHeight: '80px', transform: 'scale(0.85)', transformOrigin: 'top left', margin: '0 0 -15px -5px' }}>
                      {(hand.cards || []).map((card, index) => (
                        <PlayingCard key={`${hIdx}-${card.code}-${index}`} card={card} index={index} compact />
                      ))}
                    </div>

                    <div style={{ fontSize: '0.7rem', fontWeight: 900, textAlign: 'center', color: hand.busted ? '#ef4444' : hand.stood ? '#fbbf24' : 'rgba(255,255,255,0.4)' }}>
                      {hand.busted ? 'BUST' : hand.blackjack ? 'BLACKJACK' : hand.stood ? 'STAND' : ''}
                    </div>
                  </div>
                );
              })}
            </div>

            {roomState?.status === 'settlement' && <SettlementToast settlements={settlements} />}

            {/* Avatar + Name (Anchored at the absolute bottom of the box) */}
            <div className="blackjack-seat-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Avatar user={player} size={38} />
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0, lineHeight: 1 }}>
                  <div className="blackjack-seat-name" style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f8fafc' }}>
                    {player.displayName || player.username}
                  </div>
                  <div className="blackjack-seat-subline" style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>
                    {isLocalPlayer ? 'You' : player.isBot ? 'Bot' : 'Player'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chips Group + Deal Button */}
          <div className="blackjack-footer-chips" style={{ minHeight: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
            <div style={{ position: 'relative' }}>
              {isBettingPhase && isLocalPlayer && pendingBet > 0 && (
                <ChipStack amount={pendingBet} isPending onClick={() => onChipSub(pendingBet)} />
              )}
              {(!isLocalPlayer || !isBettingPhase || (isLocalPlayer && pendingBet === 0)) && player.currentBet > 0 && (
                <ChipStack amount={player.currentBet} />
              )}
            </div>

            {isBettingPhase && isLocalPlayer && pendingBet > 0 && (
              <button
                className="blackjack-bet-submit-btn"
                onClick={() => onBetSubmit(pendingBet)}
                style={{
                  background: 'var(--accent-primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '60px',
                  padding: '8px 20px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.target.style.transform = 'scale(1.08)'; e.target.style.filter = 'brightness(1.1)'; }}
                onMouseLeave={e => { e.target.style.transform = 'scale(1)'; e.target.style.filter = 'none'; }}
              >
                DEAL
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// BlackjackActionBar component removed in favor of seat-centered controls

function LeaderboardSection({ rows, sortBy, setSortBy, loading }) {
  return (
    <section style={{
      background: 'linear-gradient(180deg, rgba(14,20,30,0.92), rgba(10,14,22,0.94))',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '28px',
      padding: '24px',
      boxShadow: '0 24px 50px rgba(0,0,0,0.2)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fbbf24', fontWeight: 800, marginBottom: '6px' }}>
            <Trophy size={18} />
            Blackjack Leaderboard
          </div>
          <div style={{ color: 'rgba(255,255,255,0.64)', fontSize: '0.92rem' }}>Aggregierte Stats, ohne Hand-History im Backend.</div>
        </div>

        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
          style={{
            background: 'rgba(255,255,255,0.05)',
            color: '#f8fafc',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '14px',
            padding: '10px 14px'
          }}
        >
          <option value="totalWon">Net Profit</option>
          <option value="gamesPlayed">Games Played</option>
          <option value="blackjacksHit">Blackjacks</option>
          <option value="totalWagered">Total Wagered</option>
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'rgba(255,255,255,0.68)' }}>
          <Loader2 size={16} className="spin" />
          Leaderboard wird geladen...
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '10px' }}>
          {(rows || []).slice(0, 10).map((row, index) => (
            <div
              key={row.userId}
              style={{
                display: 'grid',
                gridTemplateColumns: '34px minmax(140px, 1fr) 100px 90px 110px 110px',
                gap: '10px',
                alignItems: 'center',
                padding: '12px 14px',
                borderRadius: '18px',
                background: index === 0 ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${index === 0 ? 'rgba(245,158,11,0.24)' : 'rgba(255,255,255,0.06)'}`
              }}
            >
              <div style={{ fontWeight: 900, color: index < 3 ? '#fbbf24' : '#cbd5e1' }}>{index + 1}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <Avatar user={{ username: row.username, preferences: typeof row.preferences === 'string' ? JSON.parse(row.preferences || '{}') : (row.preferences || {}) }} size={28} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.displayName || row.username}</div>
                  <div style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.48)' }}>@{row.username}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right', fontWeight: 700 }}>{row.gamesPlayed}</div>
              <div style={{ textAlign: 'right', fontWeight: 700 }}>{row.blackjacksHit}</div>
              <div style={{ textAlign: 'right', fontWeight: 700 }}>{formatKC(row.totalWagered)}</div>
              <div style={{ textAlign: 'right', fontWeight: 800, color: row.totalWon >= 0 ? '#4ade80' : '#f87171' }}>{formatKC(row.totalWon)}</div>
            </div>
          ))}
          {!rows?.length && <div style={{ color: 'rgba(255,255,255,0.56)' }}>Noch keine Blackjack-Einträge vorhanden.</div>}
        </div>
      )}
    </section>
  );
}

const Blackjack = ({ socket }) => {
  const { user, isGuest, setUser } = useAuth();
  const { showToast } = useToast();

  const [config, setConfig] = useState(null);
  const [selectedTable, setSelectedTable] = useState(() => {
    const stored = Number.parseInt(localStorage.getItem('blackjack_table_size'), 10);
    return stored === 3 ? 3 : 5;
  });
  const [roomState, setRoomState] = useState(null);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardSort, setLeaderboardSort] = useState('totalWon');
  const [currentRoomId, setCurrentRoomId] = useState(() => localStorage.getItem('blackjack_current_room') || getRoomId(5));
  const [pendingBet, setPendingBet] = useState(() => Number.parseInt(localStorage.getItem('blackjack_pending_bet'), 10) || 0);
  const [roomDraft, setRoomDraft] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [error, setError] = useState('');
  const [recentSettlement, setRecentSettlement] = useState({ roundId: null, results: [] });
  const [now, setNow] = useState(() => Date.now());
  const [betAdjustMode, setBetAdjustMode] = useState('add');
  const [autoBetEnabled, setAutoBetEnabled] = useState(() => localStorage.getItem('blackjack_auto_bet') === 'true');
  const joinedRoomIdRef = useRef(null);

  const roomId = useMemo(() => currentRoomId || getRoomId(selectedTable), [currentRoomId, selectedTable]);
  const mySeat = useMemo(() => roomState?.players?.find((player) => String(player.userId) === String(user?.id)) || null, [roomState?.players, user?.id]);
  const canAct = Boolean(mySeat && roomState?.status === 'player_turns' && String(roomState?.currentPlayerTurn) === String(user?.id) && !actionBusy);
  const settlementRows = recentSettlement?.results || [];
  const tableSeats = useMemo(() => {
    const maxPlayers = roomState?.maxPlayers || selectedTable;
    const playersBySeat = new Map(
      (roomState?.players || []).map((p) => [p.seat, p])
    );

    const seatCount = maxPlayers;
    const mySeatNum = mySeat?.seat || null;

    return Array.from({ length: seatCount }, (_, index) => {
      const seat = index + 1;
      const player = playersBySeat.get(seat);
      const visualSeat = getVisualSeat(seat, mySeatNum, seatCount);
      return player ? { ...player, visualSeat } : { seat, visualSeat };
    }).sort((a, b) => a.visualSeat - b.visualSeat);
  }, [mySeat?.seat, roomState?.maxPlayers, roomState?.players, selectedTable]);
  const turnCountdownSeconds = useMemo(() => {
    if (!roomState?.turnDeadlineAt || roomState?.status !== 'player_turns') {
      return TURN_TIMEOUT_SECONDS;
    }
    return Math.max(0, Math.ceil((roomState.turnDeadlineAt - now) / 1000));
  }, [now, roomState?.status, roomState?.turnDeadlineAt]);
  const autoStartSeconds = useMemo(() => {
    if (!roomState?.autoStartAt || !['waiting', 'betting'].includes(roomState?.status)) {
      return null;
    }
    return Math.max(0, Math.ceil((roomState.autoStartAt - now) / 1000));
  }, [now, roomState?.autoStartAt, roomState?.status]);
  const tableStatusMeta = useMemo(
    () => getTableStatusMeta(roomState, user?.id, turnCountdownSeconds, autoStartSeconds),
    [autoStartSeconds, roomState, turnCountdownSeconds, user?.id]
  );
  const canSwitchSeats = Boolean(
    mySeat
    && mySeat.currentBet <= 0
    && (!mySeat.hand || mySeat.hand.length === 0)
    && !['dealing', 'player_turns', 'dealer_turn', 'settlement'].includes(roomState?.status)
  );

  useEffect(() => {
    localStorage.setItem('blackjack_table_size', String(selectedTable));
  }, [selectedTable]);

  useEffect(() => {
    localStorage.setItem('blackjack_pending_bet', String(pendingBet));
  }, [pendingBet]);

  useEffect(() => {
    localStorage.setItem('blackjack_auto_bet', autoBetEnabled ? 'true' : 'false');
  }, [autoBetEnabled]);

  useEffect(() => {
    localStorage.setItem('blackjack_current_room', roomId);
  }, [roomId]);

  useEffect(() => {
    if (roomState?.lastSettlement?.length && roomState?.lastSettlementRoundId) {
      setRecentSettlement({
        roundId: roomState.lastSettlementRoundId,
        results: roomState.lastSettlement
      });
    }
  }, [roomState?.lastSettlement, roomState?.lastSettlementRoundId]);

  useEffect(() => {
    if (roomState?.status && ['dealing', 'player_turns', 'dealer_turn'].includes(roomState.status) && recentSettlement?.roundId && recentSettlement.roundId < roomState.roundId) {
      setRecentSettlement({ roundId: null, results: [] });
    }
  }, [recentSettlement?.roundId, roomState?.roundId, roomState?.status]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const syncBalance = useCallback((balance) => {
    if (!Number.isFinite(balance)) return;
    setUser((prev) => prev ? ({ ...prev, koala_balance: balance }) : prev);
  }, [setUser]);

  const loadConfig = useCallback(async () => {
    const data = await fetchJson('/api/blackjack/config', { token: '' });
    setConfig(data);
  }, []);

  const loadRooms = useCallback(async () => {
    try {
      const data = await fetchJson('/api/blackjack/rooms', { token: '' });
      setAvailableRooms(data.rooms || []);
    } catch (err) {
      console.error('Failed to fetch blackjack rooms:', err);
    }
  }, []);

  const loadLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      const data = await fetchJson(`/api/blackjack/leaderboard?sortBy=${leaderboardSort}`, { token: '' });
      setLeaderboard(data.leaderboard || []);
    } catch (err) {
      console.error('Failed to fetch blackjack leaderboard:', err);
    } finally {
      setLeaderboardLoading(false);
    }
  }, [leaderboardSort]);

  const loadFallbackState = useCallback(async () => {
    if (isGuest) return;
    try {
      const data = await fetchJson(`/api/blackjack/state?roomId=${encodeURIComponent(roomId)}&maxPlayers=${selectedTable}`);
      setRoomState(data.state || null);
    } catch (err) {
      if (err.status === 404) {
        setRoomState(null);
        return;
      }
      console.error('Failed to load blackjack fallback state:', err);
      setError(err.message || 'Blackjack-Status konnte nicht geladen werden.');
    }
  }, [isGuest, roomId, selectedTable]);

  const runSocketAction = useCallback((eventName, payload = {}) => new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Socket connection unavailable.'));
      return;
    }

    socket.emit(eventName, payload, (response) => {
      if (!response?.success) {
        reject(new Error(response?.error || 'Blackjack action failed.'));
        return;
      }
      if (response.state) {
        setRoomState(response.state);
      }
      resolve(response);
    });
  }), [socket]);

  useEffect(() => {
    setPageLoading(true);
    Promise.all([loadConfig(), loadLeaderboard(), loadRooms(), loadFallbackState()])
      .finally(() => setPageLoading(false));
  }, [loadConfig, loadLeaderboard, loadRooms, loadFallbackState]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  useEffect(() => {
    if (isGuest || !socket) return undefined;

    const handleState = (state) => {
      setRoomState(state);
      setError('');
    };
    const handleRooms = (rooms) => {
      setAvailableRooms(Array.isArray(rooms) ? rooms : []);
    };
    const handleError = (message) => {
      // Ignore "not found" errors during initial auto-join/switching as we handle them locally
      if (message?.toLowerCase().includes('not found')) return;

      setError(message || 'Blackjack-Fehler');
      showToast(message || 'Blackjack-Fehler', 'warning');
      loadFallbackState();
    };
    const handleConnect = () => {
      const previouslyJoinedRoom = joinedRoomIdRef.current;
      const eventName = previouslyJoinedRoom && previouslyJoinedRoom !== roomId
        ? EVENTS.BLACKJACK_SWITCH_ROOM
        : EVENTS.BLACKJACK_JOIN;
      const payload = eventName === EVENTS.BLACKJACK_SWITCH_ROOM
        ? { fromRoomId: previouslyJoinedRoom, roomId, maxPlayers: selectedTable }
        : { roomId };

    runSocketAction(eventName, payload)
        .then((response) => {
          joinedRoomIdRef.current = response?.roomId || roomId;
          setError(''); // Clear errors on successful join
        })
        .catch(async (err) => {
          const isNotFound = err.message?.toLowerCase().includes('not found');
          // If the room doesn't exist, try to create it automatically
          if (isNotFound && eventName === EVENTS.BLACKJACK_JOIN) {
            try {
              const createResp = await runSocketAction(EVENTS.BLACKJACK_CREATE_ROOM, { roomId, maxPlayers: selectedTable });
              joinedRoomIdRef.current = createResp?.roomId || roomId;
              // No error set, just move on
              return;
            } catch (createErr) {
              setError(createErr.message);
            }
          } else {
            setError(err.message);
          }
        });
    };

    socket.on(EVENTS.BLACKJACK_STATE, handleState);
    socket.on(EVENTS.BLACKJACK_ROOMS, handleRooms);
    socket.on(EVENTS.BLACKJACK_ERROR, handleError);
    socket.on(EVENTS.CONNECT, handleConnect);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off(EVENTS.BLACKJACK_STATE, handleState);
      socket.off(EVENTS.BLACKJACK_ROOMS, handleRooms);
      socket.off(EVENTS.BLACKJACK_ERROR, handleError);
      socket.off(EVENTS.CONNECT, handleConnect);
    };
  }, [isGuest, roomId, runSocketAction, selectedTable, showToast, socket]);

  useEffect(() => {
    const handleCoinUpdate = ({ balance }) => syncBalance(balance);
    socket?.on(EVENTS.COIN_BALANCE_UPDATE, handleCoinUpdate);
    return () => socket?.off(EVENTS.COIN_BALANCE_UPDATE, handleCoinUpdate);
  }, [socket, syncBalance]);

  const handleBetSubmit = async () => {
    if (!pendingBet) {
      showToast('Bitte erst Chips zum Einsatz hinzufügen.', 'warning');
      return;
    }

    setActionBusy(true);
    setError('');
    try {
      const resp = await runSocketAction(EVENTS.BLACKJACK_BET, { roomId, amount: pendingBet });
      if (resp?.state) {
        setRoomState(resp.state);
      }
      showToast(`Einsatz von ${formatKC(pendingBet)} gesetzt.`, 'success');
    } catch (err) {
      setError(err.message);
    } finally {
      setActionBusy(false);
    }
  };

  useEffect(() => {
    if (
      isGuest
      || actionBusy
      || !autoBetEnabled
      || pendingBet <= 0
      || !mySeat?.userId
      || mySeat.currentBet > 0
      || !['waiting', 'betting'].includes(roomState?.status)
    ) {
      return;
    }

    runSocketAction(EVENTS.BLACKJACK_BET, { roomId, amount: pendingBet })
      .catch((err) => {
        setError(err.message);
      });
  }, [
    actionBusy,
    autoBetEnabled,
    isGuest,
    mySeat?.currentBet,
    mySeat?.userId,
    pendingBet,
    roomId,
    roomState?.status,
    runSocketAction
  ]);

  const handleTurnAction = async (eventName) => {
    setActionBusy(true);
    setError('');
    try {
      await runSocketAction(eventName, { roomId });
      await loadLeaderboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionBusy(false);
    }
  };

  const filteredRooms = useMemo(() => availableRooms.filter((room) => room.maxPlayers === selectedTable), [availableRooms, selectedTable]);

  const handleSwitchRoom = useCallback((nextRoomId, nextMaxPlayers = selectedTable) => {
    setSelectedTable(nextMaxPlayers === 3 ? 3 : 5);
    setCurrentRoomId(nextRoomId);
    setRoomState(null);
    setError('');
  }, [selectedTable]);

  const handleCreateRoom = useCallback(async () => {
    const nextRoomId = normalizeRoomSlug(roomDraft, selectedTable);
    setActionBusy(true);
    setError('');
    try {
      await runSocketAction(EVENTS.BLACKJACK_CREATE_ROOM, { roomId: nextRoomId, maxPlayers: selectedTable });
      setRoomDraft('');
      showToast(`Tisch ${nextRoomId} erstellt.`, 'success');
    } catch (err) {
      setError(err.message || 'Tisch konnte nicht erstellt werden.');
    } finally {
      setActionBusy(false);
    }
  }, [roomDraft, runSocketAction, selectedTable, showToast]);

  const handleLeaveTable = useCallback(async () => {
    if (mySeat?.currentBet > 0 || hasActiveRound(roomState)) {
      showToast('Du kannst den Tisch während einer aktiven Runde nicht verlassen.', 'warning');
      return;
    }
    setActionBusy(true);
    try {
      await runSocketAction(EVENTS.BLACKJACK_LEAVE, { roomId });
      showToast('Sitzplatz verlassen.', 'success');
      // No need to setRoomState(null) manually, the next sync/ack will show we are gone
    } catch (err) {
      setError(err.message);
    } finally {
      setActionBusy(false);
    }
  }, [roomId, mySeat, roomState, runSocketAction, showToast]);

  const handleAddBot = useCallback(async (targetRoomId) => {
    setActionBusy(true);
    setError('');
    try {
      await runSocketAction(EVENTS.BLACKJACK_ADD_BOT, { roomId: targetRoomId });
      showToast('Blackjack-Bot hinzugefuegt.', 'success');
    } catch (err) {
      setError(err.message || 'Bot konnte nicht hinzugefuegt werden.');
    } finally {
      setActionBusy(false);
    }
  }, [runSocketAction, showToast]);

  const handleSmartJoin = useCallback(async (seatObj) => {
    setActionBusy(true);
    setError('');
    try {
      let activeRoomState = roomState;
      // 1. If not in room, join it first
      if (!activeRoomState) {
        try {
          const joinResp = await runSocketAction(EVENTS.BLACKJACK_JOIN, { roomId });
          activeRoomState = joinResp.state;
        } catch (err) {
          if (err.message?.toLowerCase().includes('not found')) {
            const createResp = await runSocketAction(EVENTS.BLACKJACK_CREATE_ROOM, { roomId, maxPlayers: selectedTable });
            await runSocketAction(EVENTS.BLACKJACK_JOIN, { roomId });
            activeRoomState = createResp.state;
          } else {
            throw err;
          }
        }
      }

      // 2. Select the seat
      // If we are already seated, we need switchSeat. If not, join seat.
      // The backend switchSeat works for both new seating and switching.
      const actualSeat = seatObj.seat;
      const moveResp = await runSocketAction(EVENTS.BLACKJACK_SWITCH_SEAT, { roomId, seat: actualSeat });
      if (moveResp?.state) {
        setRoomState(moveResp.state);
      }
      showToast(`Platz ${actualSeat} belegt. Viel Erfolg!`, 'success');
    } catch (err) {
      setError(err.message || 'Beitritt fehlgeschlagen.');
    } finally {
      setActionBusy(false);
    }
  }, [roomId, roomState, runSocketAction, selectedTable, showToast]);

  if (pageLoading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.72)', gap: '10px' }}>
        <Loader2 size={18} className="spin" />
        Blackjack wird geladen...
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      <style>{`
        @keyframes blackjackDealIn {
          0% {
            opacity: 0;
            transform: translate(60px, -60px) rotate(-15deg) scale(0.6);
            filter: blur(8px);
          }
          100% {
            opacity: 1;
            transform: translate(0, 0) rotate(0deg) scale(1);
            filter: blur(0);
          }
        }

        @keyframes blackjackToastPop {
          0% {
            opacity: 0;
            transform: translate(-50%, 20px) scale(0.8);
          }
          20% {
            opacity: 1;
            transform: translate(-50%, -10px) scale(1.1);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, -20px) scale(1);
          }
        }

        @keyframes blackjackTextPop {
          0% {
             opacity: 0;
             transform: translate(-50%, -50%) scale(0.2) rotate(-10deg);
             filter: blur(10px);
          }
          50% {
             opacity: 1;
             transform: translate(-50%, -50%) scale(1.4) rotate(0deg);
             filter: blur(0);
          }
          70% {
             transform: translate(-50%, -50%) scale(1.1);
          }
          100% {
             opacity: 0;
             transform: translate(-50%, -90%) scale(1);
          }
        }

        @keyframes confettiBurst {
           0% {
              transform: translate(-50%, -50%) scale(0);
              opacity: 1;
           }
           100% {
              transform: translate(calc(-50% + cos(var(--angle)) * 120px), calc(-50% + sin(var(--angle)) * 120px)) scale(1);
              opacity: 0;
           }
        }

        .blackjack-celebration-overlay {
           position: absolute;
           inset: 0;
           z-index: 100;
           pointer-events: none;
           display: flex;
           align-items: center;
           justify-content: center;
        }

        .blackjack-pop-text {
           position: absolute;
           left: 50%;
           top: 50%;
           transform: translate(-50%, -50%);
           font-size: 2.4rem;
           font-weight: 900;
           color: #fbbf24;
           text-shadow: 0 0 20px rgba(245, 158, 11, 0.6), 0 0 40px rgba(245, 158, 11, 0.3);
           animation: blackjackTextPop 2.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
           white-space: nowrap;
        }

        .confetti-container {
           position: absolute;
           inset: 0;
        }

        .confetti-particle {
           position: absolute;
           left: 50%;
           top: 50%;
           width: 6px;
           height: 6px;
           background: var(--color);
           border-radius: 2px;
           animation: confettiBurst 1.2s ease-out var(--delay) both;
        }

        .blackjack-settlement-toast {
          position: absolute;
          left: 50%;
          top: 0;
          transform: translate(-50%, -20px);
          z-index: 50;
          pointer-events: none;
          animation: blackjackToastPop 600ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }

        .toast-text {
          font-size: 1.4rem;
          font-weight: 900;
          text-shadow: 0 4px 12px rgba(0,0,0,0.5), 0 0 20px rgba(0,0,0,0.3);
          white-space: nowrap;
        }

        .toast-glow {
          position: absolute;
          inset: -10px;
          background: var(--toast-color);
          filter: blur(30px);
          opacity: 0.25;
        }

        @keyframes blackjackGlowPulse {
          0%, 100% { box-shadow: 0 0 0 rgba(245, 158, 11, 0); }
          50% { box-shadow: 0 0 28px rgba(245, 158, 11, 0.28); }
        }

        @keyframes blackjackSettlementIn {
          0% {
            opacity: 0;
            transform: translateY(16px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .blackjack-stage {
          --stage-side-padding: clamp(20px, 2.2vw, 34px);
          --seat-width: clamp(180px, 15vw, 250px);
          position: relative;
          height: 72vh;
          min-height: 600px;
          max-height: 850px;
          width: 100%;
          aspect-ratio: 16 / 9;
          border-radius: clamp(28px, 2.6vw, 38px);
          overflow: hidden;
          background:
            radial-gradient(circle at 50% 20%, rgba(255,255,255,0.06), transparent 24%),
            linear-gradient(180deg, rgba(63, 25, 13, 0.96), rgba(31, 12, 7, 0.99));
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 30px 80px rgba(0,0,0,0.28);
        }

        .blackjack-stage::before {
          content: "";
          position: absolute;
          inset: clamp(18px, 1.8vw, 26px);
          border-radius: 999px;
          background:
            radial-gradient(circle at 50% 30%, rgba(34, 197, 94, 0.16), transparent 40%),
            linear-gradient(180deg, rgba(18, 108, 63, 0.98), rgba(8, 61, 39, 0.98));
          border: clamp(11px, 1vw, 16px) solid rgba(88, 38, 22, 0.92);
          box-shadow:
            inset 0 0 0 2px rgba(245,158,11,0.18),
            inset 0 22px 40px rgba(255,255,255,0.04),
            inset 0 -34px 60px rgba(0,0,0,0.22);
        }

        .blackjack-stage::after {
          content: "";
          position: absolute;
          inset: clamp(54px, 4vw, 74px);
          border-radius: 999px;
          border: 1px dashed rgba(245, 158, 11, 0.18);
          pointer-events: none;
        }

        .blackjack-table-center {
          position: absolute;
          left: 50%;
          top: 40%;
          transform: translate(-50%, -50%);
          z-index: 2;
          width: min(560px, 62%);
          padding: 24px 20px 18px;
          border-radius: 999px 999px 36px 36px;
          text-align: center;
          background: transparent;
          border: none;
          backdrop-filter: none;
          pointer-events: none;
        }

        .blackjack-area-kicker {
          font-size: 0.72rem;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.56);
          margin-bottom: 4px;
        }

        .blackjack-dealer-zone {
          position: absolute;
          top: clamp(26px, 3.2vw, 44px);
          left: 50%;
          transform: translateX(-50%);
          width: min(420px, calc(100% - 2 * var(--stage-side-padding) - 320px));
          z-index: 3;
          padding: 6px 12px;
          border-radius: 22px;
          background: linear-gradient(180deg, rgba(9, 23, 17, 0.48), rgba(7, 14, 11, 0.28));
          border: 1px solid rgba(255,255,255,0.05);
          box-shadow: 0 10px 24px rgba(0,0,0,0.14);
          backdrop-filter: blur(6px);
        }

        .blackjack-felt-pile {
          position: absolute;
          top: 34px;
          z-index: 3;
          display: grid;
          gap: 8px;
          align-items: center;
          justify-items: center;
        }

        .blackjack-felt-pile.left {
          left: clamp(34px, 4vw, 64px);
        }

        .blackjack-felt-pile.right {
          right: clamp(34px, 4vw, 64px);
        }

        .blackjack-felt-pile-cards {
          position: relative;
          width: 72px;
          height: 90px;
        }

        .blackjack-felt-pile-card {
          position: absolute;
          inset: 0;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.16);
          background:
            linear-gradient(135deg, rgba(29,78,216,0.92), rgba(30,41,59,0.95)),
            repeating-linear-gradient(45deg, rgba(255,255,255,0.12) 0 6px, transparent 6px 12px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.22);
        }

        .blackjack-felt-pile-card.shadow {
          transform: translate(8px, 8px) rotate(8deg);
          opacity: 0.56;
        }

        .blackjack-felt-pile-card.top {
          transform: rotate(-2deg);
        }

        .blackjack-felt-pile-meta {
          text-align: center;
          padding: 7px 10px;
          border-radius: 14px;
          background: rgba(7,12,18,0.38);
          border: 1px solid rgba(255,255,255,0.06);
          backdrop-filter: blur(4px);
        }

        .blackjack-felt-pile-label {
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: rgba(255,255,255,0.54);
          margin-bottom: 3px;
        }

        .blackjack-felt-pile-count {
          font-size: 0.96rem;
          font-weight: 900;
        }

        .blackjack-dealer-header {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: center;
        }

        .blackjack-dealer-title {
          font-size: clamp(1rem, 1.4vw, 1.2rem);
          font-weight: 900;
          color: #f8fafc;
          margin-bottom: 4px;
        }

        .blackjack-dealer-status {
          color: rgba(255,255,255,0.72);
          font-size: 0.82rem;
        }

        .blackjack-dealer-cards,
        .blackjack-hand-wrap {
          display: flex;
          align-items: flex-end;
          min-height: 96px;
        }

        .blackjack-dealer-cards .blackjack-card + .blackjack-card,
        .blackjack-hand-wrap .blackjack-card + .blackjack-card {
          margin-left: -18px;
        }

        .blackjack-card {
          position: relative;
          z-index: 1;
        }

        .blackjack-card.compact {
          transform: scale(0.94);
          transform-origin: bottom left;
        }

        .blackjack-card.hidden-card::before {
          content: "";
          position: absolute;
          inset: 7px;
          border-radius: 10px;
          background:
            linear-gradient(135deg, rgba(245,158,11,0.16), rgba(59,130,246,0.18)),
            repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0 6px, transparent 6px 12px);
          opacity: 0.92;
        }

        .blackjack-header-status {
          display: grid;
          gap: 10px;
          min-width: min(100%, 280px);
          max-width: 360px;
          padding: 14px 16px;
          border-radius: 22px;
          background: linear-gradient(180deg, rgba(8,18,14,0.94), rgba(7,12,18,0.96));
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 18px 32px rgba(0,0,0,0.24);
          backdrop-filter: blur(10px);
        }

        .blackjack-seat {
          position: absolute;
          z-index: 10;
          width: min(var(--seat-width), calc(100% - 24px));
          padding: 10px;
          border-radius: 28px;
          background: rgba(0, 0, 0, 0.12);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.05);
          transform: var(--seat-transform, none);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .blackjack-seat-controls-wrapper {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 20;
        }

        .blackjack-seat-controls-wrapper > * {
          pointer-events: auto;
        }

        .blackjack-chip-rack {
          position: absolute;
          left: -60px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          flex-direction: column;
          gap: 6px;
          animation: blackjackSettlementIn 0.3s ease-out;
        }

        .blackjack-action-column {
          position: absolute;
          right: -130px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          flex-direction: column;
          gap: 8px;
          animation: blackjackSettlementIn 0.3s ease-out;
        }

        .blackjack-context-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.15);
          background: rgba(30, 41, 59, 0.8);
          color: white;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }

        .blackjack-context-btn:hover:not(:disabled) {
          transform: scale(1.1);
          border-color: #fbbf24;
          background: rgba(51, 65, 85, 0.9);
        }

        .blackjack-action-btn-long {
          min-width: 110px;
          height: 42px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(15, 23, 42, 0.9);
          color: white;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }

        .blackjack-action-btn-long.hit { border-color: #22c55e; }
        .blackjack-action-btn-long.hit:hover { background: #15803d; }
        .blackjack-action-btn-long.stand { border-color: #eab308; }
        .blackjack-action-btn-long.stand:hover { background: #a16207; }
        .blackjack-action-btn-long.double { border-color: #3b82f6; }
        .blackjack-action-btn-long.double:hover { background: #1d4ed8; }

        .blackjack-action-btn-long:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          filter: grayscale(1);
        }

        .blackjack-seat.current-turn {
          transform: var(--seat-transform, none) translateY(-4px);
          animation: blackjackGlowPulse 2s ease-in-out infinite;
        }

        .blackjack-seat.local-seat {
          filter: drop-shadow(0 10px 22px rgba(0,0,0,0.16));
        }

        .blackjack-seat.winner-seat {
          filter: drop-shadow(0 0 18px rgba(245,158,11,0.22));
        }

        .blackjack-turn-arrow {
          position: absolute;
          top: -14px;
          left: 50%;
          transform: translateX(-50%);
          padding: 5px 10px;
          border-radius: 999px;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: #111827;
          font-size: 0.72rem;
          font-weight: 900;
          letter-spacing: 0.08em;
          box-shadow: 0 10px 18px rgba(245,158,11,0.22);
        }

        .blackjack-seat-header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 8px;
        }

        .blackjack-seat-user {
          display: flex;
          gap: 10px;
          min-width: 0;
          align-items: center;
        }

        .blackjack-seat-name {
          font-weight: 800;
          color: #f8fafc;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .blackjack-seat-subline {
          color: rgba(255,255,255,0.52);
          font-size: 0.78rem;
        }

        .blackjack-seat-metrics {
          display: grid;
          gap: 8px;
          justify-items: end;
        }

        .blackjack-value-badge {
          display: inline-flex;
          align-items: center;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          color: #f8fafc;
          font-size: 0.8rem;
          font-weight: 800;
        }

        .blackjack-seat-status {
          color: rgba(255,255,255,0.72);
          font-size: 0.78rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .blackjack-seat-status.is-result {
          color: #fde68a;
        }

        .blackjack-seat-bet-row {
          display: grid;
          gap: 6px;
          margin: 8px auto 10px;
          justify-items: center;
        }

        .blackjack-seat-spot {
          position: relative;
          width: 92px;
          height: 92px;
          border-radius: 50%;
          border: 4px solid rgba(255,255,255,0.16);
          background: radial-gradient(circle, rgba(255,255,255,0.02), transparent 64%);
          display: grid;
          place-items: center;
        }

        .blackjack-seat.current-turn .blackjack-seat-spot {
          border-color: rgba(245,158,11,0.72);
          box-shadow: 0 0 0 8px rgba(245,158,11,0.08);
        }

        .blackjack-seat-bet-label {
          font-size: 0.72rem;
          color: rgba(255,255,255,0.52);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .blackjack-seat-empty,
        .blackjack-seat-empty-shell {
          display: grid;
          place-items: center;
          text-align: center;
        }

        .blackjack-seat-empty {
          opacity: 0.76;
        }

        .blackjack-seat-empty-shell {
          min-height: 136px;
          width: 100%;
          border-radius: 26px 26px 999px 999px;
          border: 1px dashed rgba(255,255,255,0.14);
          background: radial-gradient(circle at 50% 18%, rgba(255,255,255,0.03), rgba(255,255,255,0.008));
          color: rgba(255,255,255,0.42);
          gap: 8px;
          appearance: none;
          box-shadow: none;
          cursor: default;
        }

        .blackjack-seat-empty-shell.is-clickable {
          cursor: pointer;
          border-color: rgba(245,158,11,0.22);
          background: radial-gradient(circle at 50% 18%, rgba(245,158,11,0.08), rgba(255,255,255,0.01));
          color: rgba(255,255,255,0.74);
          transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
        }

        .blackjack-seat-empty-shell.is-clickable:hover {
          transform: translateY(-4px);
          border-color: rgba(245,158,11,0.42);
        }

        .blackjack-seat-empty-title {
          color: rgba(255,255,255,0.72);
          font-weight: 700;
        }

        .blackjack-seat-empty-copy {
          color: rgba(255,255,255,0.46);
          font-size: 0.82rem;
        }

        .blackjack-seat-3-1 { --seat-transform: translateX(-50%); bottom: 90px; left: 50%; }
        .blackjack-seat-3-2 { bottom: 190px; left: 10%; }
        .blackjack-seat-3-3 { bottom: 190px; right: 10%; }

        .blackjack-seat-5-1 { --seat-transform: translateX(-50%); bottom: 70px; left: 50%; }
        .blackjack-seat-5-1,
        .blackjack-seat-5-2,
        .blackjack-seat-5-3,
        .blackjack-seat-5-4,
        .blackjack-seat-5-5 {
          width: min(clamp(156px, 11vw, 206px), calc(100% - 24px));
        }
        .blackjack-seat-5-2 { bottom: 240px; left: 3.2%; }
        .blackjack-seat-5-3 { bottom: 130px; left: 16%; }
        .blackjack-seat-5-4 { bottom: 130px; right: 16%; }
        .blackjack-seat-5-5 { bottom: 220px; right: 2.2%; }

        .blackjack-control-deck {
          position: relative;
          width: min(1080px, 100%);
          margin: 16px auto 0;
          z-index: 1;
          padding: 8px;
          border-radius: 22px;
          background: linear-gradient(180deg, rgba(5,16,13,0.84), rgba(7,12,18,0.88));
          border: 1px solid rgba(255,255,255,0.06);
          box-shadow: 0 16px 34px rgba(0,0,0,0.28);
          backdrop-filter: blur(8px);
        }

        .blackjack-control-deck.is-live {
          box-shadow: 0 24px 44px rgba(0,0,0,0.34), 0 0 0 1px rgba(245,158,11,0.2);
        }

        .blackjack-control-grid {
          display: grid;
          grid-template-columns: minmax(180px, 240px) minmax(0, 1.2fr) minmax(240px, 290px);
          gap: 10px;
          align-items: stretch;
        }

        .blackjack-control-panel {
          display: grid;
          gap: 8px;
          align-content: start;
          padding: 10px 12px;
          border-radius: 18px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
        }

        .blackjack-controls-caption {
          font-size: 0.72rem;
          color: rgba(255,255,255,0.52);
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .blackjack-action-panel.active {
          background: linear-gradient(180deg, rgba(245,158,11,0.12), rgba(255,255,255,0.03));
          border-color: rgba(245,158,11,0.22);
        }

        .blackjack-chip-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: flex-start;
        }

        .blackjack-chip-button {
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.05);
          color: #fff;
          border-radius: 999px;
          padding: 8px 12px;
          cursor: pointer;
          font-weight: 700;
        }

        .blackjack-chip-mode {
          display: inline-flex;
          padding: 4px;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          gap: 4px;
        }

        .blackjack-chip-mode button {
          min-width: 44px;
          border: none;
          border-radius: 999px;
          padding: 7px 10px;
          background: transparent;
          color: rgba(255,255,255,0.72);
          font-weight: 800;
          cursor: pointer;
        }

        .blackjack-chip-mode button.active {
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: #111827;
        }

        .blackjack-action-row {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .blackjack-countdown-clock {
          display: inline-flex;
          min-width: 88px;
          justify-content: center;
          align-items: center;
          padding: 8px 12px;
          border-radius: 16px;
          font-size: clamp(1.2rem, 1.8vw, 1.6rem);
          font-weight: 900;
          letter-spacing: 0.04em;
          background: rgba(10,16,24,0.82);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
        }

        .blackjack-pending-chip {
          display: grid;
          gap: 6px;
          padding: 10px 12px;
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: #f8fafc;
        }

        .blackjack-toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .blackjack-toggle {
          position: relative;
          width: 48px;
          height: 28px;
          border-radius: 999px;
          border: none;
          cursor: pointer;
          background: rgba(255,255,255,0.14);
          transition: background 180ms ease;
        }

        .blackjack-toggle.active {
          background: rgba(245,158,11,0.9);
        }

        .blackjack-toggle::after {
          content: "";
          position: absolute;
          top: 3px;
          left: 3px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #fff;
          transition: transform 180ms ease;
        }

        .blackjack-toggle.active::after {
          transform: translateX(20px);
        }

        .blackjack-turn-button {
          min-width: 120px;
          min-height: 54px;
          border-radius: 18px;
          font-size: 1rem;
          font-weight: 900;
        }

        .blackjack-control-button {
          min-height: 44px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: #f8fafc;
          font-weight: 800;
          box-shadow: none;
        }

        .blackjack-chip-tray {
          display: flex;
          flex-direction: row;
          gap: 12px;
          padding: 14px;
          background: rgba(0,0,0,0.3);
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.1);
          margin-bottom: 20px;
          justify-content: center;
          backdrop-filter: blur(10px);
          box-shadow: inset 0 2px 10px rgba(0,0,0,0.4);
        }

        .blackjack-chip-tray.vertical-side {
          position: absolute;
          right: calc(100% + 20px);
          top: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 0;
          margin: 0;
          z-index: 10;
          background: none;
          border: none;
          box-shadow: none;
          backdrop-filter: none;
        }

        .blackjack-deal-button.mini {
          padding: 6px 4px;
          font-size: 0.65rem;
          width: 100%;
          margin-top: 5px;
        }

        .blackjack-casino-chip {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 3px dashed rgba(255,255,255,0.4);
          background: var(--chip-color);
          display: grid;
          place-items: center;
          font-weight: 950;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3), inset 0 0 0 2px rgba(0,0,0,0.1);
          position: relative;
        }

        .blackjack-casino-chip:hover {
          transform: translateY(-4px) scale(1.1);
          border-color: rgba(255,255,255,0.8);
          box-shadow: 0 8px 20px rgba(0,0,0,0.4);
          filter: brightness(1.1);
        }

        .blackjack-casino-chip:active {
          transform: translateY(0) scale(0.95);
        }

        .blackjack-casino-chip::before {
          content: "";
          position: absolute;
          inset: 4px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.1);
          pointer-events: none;
        }

        .blackjack-seat {
          position: absolute;
          width: calc(var(--seat-width) + 70px);
          transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          padding: 12px;
          display: flex;
          flex-direction: column;
          z-index: 5;
        }

        .blackjack-seat-layout-horizontal {
          position: relative;
          width: 100%;
          height: 100%;
        }

        .blackjack-footer-chips {
          display: flex;
          align-items: center;
          min-height: 40px;
          margin-top: 4px;
        }

        .blackjack-seat-box-actual {
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          min-width: 0;
          width: 100%;
          height: 220px;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          padding: 16px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.3);
          position: relative;
        }

        .blackjack-seat-footer {
          margin-top: auto;
          width: 100%;
          border-top: 1px solid rgba(255,255,255,0.05);
          padding-top: 8px;
        }

        .blackjack-realistic-stack {
          position: relative;
          width: 44px;
          height: 60px;
          cursor: pointer;
          transition: transform 0.2s ease;
        }

        .blackjack-realistic-stack:hover {
          transform: scale(1.1);
        }

        .blackjack-realistic-stack.pending {
          filter: drop-shadow(0 0 8px rgba(245, 158, 11, 0.4));
        }

        .casino-chip-layered {
          position: absolute;
          left: 0;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: var(--chip-color);
          border: 4px dashed rgba(255,255,255,0.35);
          box-shadow: 0 4px 8px rgba(0,0,0,0.4), inset 0 0 10px rgba(0,0,0,0.2);
          display: grid;
          place-items: center;
          transition: transform 0.1s ease;
        }

        .chip-inner-ring {
          position: absolute;
          inset: 4px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.2);
        }

        .chip-val-tiny {
          font-size: 0.55rem;
          font-weight: 950;
          color: rgba(255,255,255,0.9);
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
          z-index: 2;
        }

        .chip-stack-tooltip {
          position: absolute;
          bottom: 110%;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.92);
          padding: 6px 12px;
          border-radius: 12px;
          color: #fff;
          font-size: 0.75rem;
          font-weight: 900;
          white-space: nowrap;
          pointer-events: none;
          z-index: 100;
          border: 1px solid rgba(255,255,255,0.1);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .pending-tag {
          font-size: 0.55rem;
          color: #fbbf24;
          font-weight: 700;
        }

        .blackjack-deal-button {
          padding: 8px 16px;
          background: linear-gradient(135deg, #fbbf24, #d97706);
          color: #111827;
          border-radius: 12px;
          font-weight: 950;
          font-size: 0.8rem;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4);
          animation: blackjackGlowPulse 2s infinite;
          margin-top: 10px;
        }

        .blackjack-deal-button:hover {
          transform: translateY(-2px);
          filter: brightness(1.1);
        }

        .blackjack-hand-card-slot {
          flex: 1; 
          display: flex; 
          flex-direction: column; 
          gap: 8px; 
          padding: 6px;
          border-radius: 16px;
          background: transparent;
          border: 1px solid transparent;
          transition: all 0.3s ease;
        }

        .blackjack-hand-card-slot.active {
          background: rgba(245, 158, 11, 0.08);
          border-color: rgba(245, 158, 11, 0.3);
          box-shadow: 0 0 15px rgba(245, 158, 11, 0.1);
        }

        @media (max-width: 1500px) {
          .blackjack-stage {
            --seat-width: clamp(170px, 14vw, 218px);
          }

          .blackjack-dealer-zone {
            width: min(500px, calc(100% - 2 * var(--stage-side-padding) - 240px));
          }

          .blackjack-seat-5-2 { bottom: 266px; left: 2%; }
          .blackjack-seat-5-3 { left: 14%; }
          .blackjack-seat-5-4 { right: 14%; }
          .blackjack-seat-5-5 { right: 1%; }
        }

        @media (max-width: 1260px) {
          .blackjack-stage {
            --seat-width: clamp(154px, 14vw, 186px);
            min-height: 860px;
          }

          .blackjack-dealer-zone {
            width: min(420px, calc(100% - 2 * var(--stage-side-padding) - 180px));
          }

          .blackjack-control-deck {
            width: min(920px, calc(100% - 2 * var(--stage-side-padding)));
          }

          .blackjack-control-grid {
            grid-template-columns: minmax(150px, 190px) minmax(0, 1fr) minmax(200px, 236px);
          }

          .blackjack-seat-5-2,
          .blackjack-seat-5-3,
          .blackjack-seat-5-4,
          .blackjack-seat-5-5 {
            width: min(clamp(146px, 13vw, 176px), calc(100% - 24px));
          }

          .blackjack-seat-5-1 { bottom: 126px; }
          .blackjack-seat-5-2 { bottom: 254px; left: 2%; }
          .blackjack-seat-5-3 { bottom: 176px; left: 12.8%; }
          .blackjack-seat-5-4 { bottom: 176px; right: 12.8%; }
          .blackjack-seat-5-5 { bottom: 228px; right: 1%; }
        }

        @media (max-width: 980px) {
          .blackjack-stage {
            min-height: auto;
            padding: 22px;
            display: grid;
            gap: 18px;
          }

          .blackjack-stage::before,
          .blackjack-stage::after,
          .blackjack-table-center {
            display: none;
          }

          .blackjack-dealer-zone,
          .blackjack-felt-pile,
          .blackjack-seat {
            position: relative;
            width: 100%;
            left: auto;
            right: auto;
            top: auto;
            bottom: auto;
            transform: none !important;
          }

          .blackjack-control-grid {
            grid-template-columns: 1fr;
          }

          .blackjack-action-row {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>

      <section style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '36px',
        marginTop: '14px',
        padding: 'clamp(18px, 2vw, 28px)',
        background: 'radial-gradient(circle at top, rgba(20,83,45,0.95), rgba(9,37,24,0.98) 50%, rgba(7,18,12,0.98) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.28)'
      }}>
        <div style={{ position: 'absolute', inset: '18px', border: '1px solid rgba(245,158,11,0.14)', borderRadius: '28px', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '22px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(245,158,11,0.18)', display: 'grid', placeItems: 'center', color: '#fbbf24' }}>
                <Crown size={20} />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: 'clamp(1.8rem, 3vw, 2.6rem)' }}>Blackjack Table</h1>
                <div style={{ color: 'rgba(255,255,255,0.62)' }}>Live-Raum mit 6-Deck-Shoe, Burn Card und Settlement erst am Ende.</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ padding: '10px 14px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)' }}>Status: {STATUS_LABELS[roomState?.status] || 'Unbekannt'}</div>
              <div style={{ padding: '10px 14px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)' }}>Shoe: {roomState?.shoeRemaining ?? 0} Karten</div>
              <div style={{ padding: '10px 14px', borderRadius: '999px', background: roomState?.needsShuffle ? 'rgba(245,158,11,0.16)' : 'rgba(255,255,255,0.06)' }}>
                {roomState?.needsShuffle ? 'Reshuffle vor nächster Hand' : `Reshuffle bei ${config?.reshuffleRemainingPercent || 25}%`}
              </div>
            </div>
          </div>

          <div className="blackjack-header-status">
            <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.56)' }}>
              {tableStatusMeta.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div className="blackjack-countdown-clock" style={{ color: tableStatusMeta.color }}>
                {String(tableStatusMeta.seconds).padStart(2, '0')}s
              </div>
              <div style={{ fontSize: '0.86rem', lineHeight: 1.4, maxWidth: '210px', color: 'rgba(255,255,255,0.8)' }}>
                {tableStatusMeta.copy}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: '18px', padding: '12px 14px', borderRadius: '16px', background: 'rgba(127,29,29,0.35)', color: '#fecaca', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldAlert size={16} />
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gap: '20px' }}>
          <div className="blackjack-stage">
            <div className="blackjack-table-center" style={{ top: '30%' }}>
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '8px',
                color: '#facc15',
                fontSize: '0.9rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.1em'
              }}>
                <div>Blackjack pays 3 to 2</div>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Dealer must stand on 17</div>
              </div>
            </div>

            <FeltPile label="Shoe" count={roomState?.shoeRemaining ?? 0} side="right" accent="#fbbf24" />
            <FeltPile label="Discard" count={roomState?.discardCount ?? 0} side="left" accent="#93c5fd" />

            <DealerHand roomState={roomState} />

            {tableSeats.map((player) => {
              const isCurrentTurn = String(roomState?.currentPlayerTurn) === String(player.userId);
              const settlements = (roomState?.lastSettlement || []).filter((entry) => String(entry.userId) === String(player.userId)).sort((a, b) => a.handIndex - b.handIndex);
              return (
                <PlayerSeat
                  key={player.userId || `seat-${player.seat}`}
                  player={player}
                  selectedTable={selectedTable}
                  roomState={roomState}
                  settlements={settlements}
                  isCurrentTurn={isCurrentTurn}
                  isLocalPlayer={String(player.userId) === String(user?.id)}
                  canSelectEmptySeat={!actionBusy && (!mySeat || roomState?.status === 'waiting' || roomState?.status === 'betting')}
                  onSelectEmptySeat={handleSmartJoin}
                  onHit={() => handleTurnAction(EVENTS.BLACKJACK_HIT)}
                  onStand={() => handleTurnAction(EVENTS.BLACKJACK_STAND)}
                  onDouble={() => handleTurnAction(EVENTS.BLACKJACK_DOUBLE)}
                  onSplit={() => handleTurnAction(EVENTS.BLACKJACK_SPLIT)}
                  onChipAdd={(amt) => setPendingBet(prev => prev + amt)}
                  onChipSub={(amt) => setPendingBet(0)}
                  onBetSubmit={handleBetSubmit}
                  pendingBet={pendingBet}
                  balance={user?.koala_balance || 0}
                />
              );
            })}

          </div>

          {!isGuest && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 24px',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '20px',
              border: '1px solid rgba(255,255,255,0.05)',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <Coins size={18} color="#fbbf24" />
                <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>{formatKC(user?.koala_balance || 0)}</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>Auto-Bet</div>
                  <div style={{ fontWeight: 800 }}>{formatKC(pendingBet)}</div>
                </div>
                <button
                  className={`blackjack-toggle${autoBetEnabled ? ' active' : ''}`}
                  onClick={() => setAutoBetEnabled(prev => !prev)}
                />
              </div>

              {mySeat && (
                <button
                  onClick={handleLeaveTable}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '12px',
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.24)',
                    color: '#f87171',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => { e.target.style.background = 'rgba(239, 68, 68, 0.2)'; }}
                  onMouseLeave={(e) => { e.target.style.background = 'rgba(239, 68, 68, 0.12)'; }}
                >
                  Sitzplatz verlassen
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <section style={{
        background: 'linear-gradient(180deg, rgba(15,18,26,0.94), rgba(9,12,18,0.96))',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '28px',
        padding: '24px',
        boxShadow: '0 24px 50px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fbbf24', fontWeight: 800, marginBottom: '6px' }}>
              <Crown size={18} />
              Blackjack Lobby
            </div>
            <div style={{ color: 'rgba(255,255,255,0.64)', fontSize: '0.92rem' }}>
              Mehrere Tische parallel. Aktiv: <strong>{roomId}</strong>
            </div>
          </div>
          <button className="btn-ghost" onClick={loadRooms} disabled={actionBusy}>Tische aktualisieren</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: '18px' }}>
          <div style={{
            display: 'grid',
            gap: '12px',
            padding: '16px',
            borderRadius: '20px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)'
          }}>
            <div style={{ fontWeight: 800 }}>Neuen Tisch erstellen</div>
            <div style={{ color: 'rgba(255,255,255,0.58)', fontSize: '0.86rem' }}>
              Optionalen Namen angeben oder automatisch erzeugen lassen.
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {TABLE_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    setSelectedTable(option);
                    setCurrentRoomId(getRoomId(option));
                    setRoomState(null);
                  }}
                  style={{
                    border: 'none',
                    cursor: 'pointer',
                    borderRadius: '999px',
                    padding: '10px 14px',
                    background: selectedTable === option ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(255,255,255,0.07)',
                    color: '#fff',
                    fontWeight: 800
                  }}
                >
                  {option} Seats
                </button>
              ))}
            </div>
            <input
              value={roomDraft}
              onChange={(event) => setRoomDraft(event.target.value)}
              placeholder="z. B. friday-run"
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '14px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.04)',
                color: '#fff'
              }}
            />
            <div style={{ color: 'rgba(255,255,255,0.46)', fontSize: '0.78rem' }}>
              Raum-ID: <code>{normalizeRoomSlug(roomDraft || 'dein-tisch', selectedTable)}</code>
            </div>
            <button className="btn-primary" onClick={handleCreateRoom} disabled={actionBusy}>
              Tisch erstellen
            </button>
          </div>

          <div style={{ display: 'grid', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 800 }}>Offene {selectedTable}er-Tische</div>
              <button className="btn-ghost" onClick={() => handleAddBot(roomId, selectedTable)} disabled={actionBusy}>
                Bot zum aktiven Tisch
              </button>
            </div>
            {filteredRooms.length === 0 && (
              <div style={{
                padding: '16px',
                borderRadius: '18px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.56)'
              }}>
                Noch kein aktiver Tisch für {selectedTable} Plätze offen.
              </div>
            )}
            {filteredRooms.map((room) => (
              <div
                key={room.roomId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(160px, 1fr) 90px 120px 220px',
                  gap: '12px',
                  alignItems: 'center',
                  padding: '14px 16px',
                  borderRadius: '18px',
                  background: String(room.roomId) === String(roomId) ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${String(room.roomId) === String(roomId) ? 'rgba(245,158,11,0.24)' : 'rgba(255,255,255,0.06)'}`
                }}
              >
                <div>
                  <div style={{ fontWeight: 800 }}>{room.roomId}</div>
                  <div style={{ color: 'rgba(255,255,255,0.46)', fontSize: '0.8rem' }}>{room.status}</div>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 700 }}>{room.connectedCount}/{room.maxPlayers}</div>
                <div style={{ textAlign: 'right', color: room.needsShuffle ? '#fbbf24' : 'rgba(255,255,255,0.62)' }}>
                  {room.needsShuffle ? 'Reshuffle' : `${room.shoeRemaining} Karten`}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    className="btn-ghost"
                    onClick={() => handleAddBot(room.roomId, room.maxPlayers)}
                    disabled={actionBusy || room.connectedCount >= room.maxPlayers}
                  >
                    Bot hinzufügen
                  </button>
                  <button
                    className={room.roomId === roomId ? 'btn-primary' : 'btn-ghost'}
                    onClick={() => handleSwitchRoom(room.roomId, room.maxPlayers)}
                  >
                    {room.roomId === roomId ? 'Aktiv' : 'Beitreten'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {settlementRows.length > 0 && (
        <section style={{
          background: 'linear-gradient(180deg, rgba(18,22,31,0.96), rgba(9,12,18,0.96))',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '28px',
          padding: '24px',
          boxShadow: '0 24px 50px rgba(0,0,0,0.2)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fbbf24', fontWeight: 800, marginBottom: '6px' }}>
                <Trophy size={18} />
                Letzte Abrechnung
              </div>
              <div style={{ color: 'rgba(255,255,255,0.64)', fontSize: '0.92rem' }}>
                Bleibt sichtbar, bis die nächste Runde wirklich gestartet wird.
              </div>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.52)', fontSize: '0.82rem' }}>
              Hand #{recentSettlement.roundId || '-'}
            </div>
          </div>

          <div style={{ display: 'grid', gap: '10px' }}>
            {settlementRows.map((entry, index) => {
              const meta = RESULT_META[entry.result] || RESULT_META.push;
              return (
                <div
                  key={`${entry.userId}-${recentSettlement.roundId || index}`}
                  className="blackjack-settlement-card"
                  style={{
                    animationDelay: `${index * 70}ms`,
                    display: 'grid',
                    gridTemplateColumns: 'minmax(120px, 1fr) 90px 90px 90px 120px',
                    gap: '10px',
                    alignItems: 'center',
                    padding: '12px 14px',
                    borderRadius: '18px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800 }}>{entry.username}</div>
                    <div style={{ color: 'rgba(255,255,255,0.46)', fontSize: '0.8rem' }}>
                      {entry.blackjack ? 'Natural Blackjack' : entry.busted ? 'Bust' : `Hand ${entry.handValue}`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 700 }}>{formatKC(entry.bet)}</div>
                  <div style={{ textAlign: 'right', fontWeight: 700 }}>{entry.handValue}</div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ display: 'inline-flex', padding: '6px 10px', borderRadius: '999px', background: meta.bg, color: meta.color, fontWeight: 800, fontSize: '0.82rem' }}>
                      {meta.label}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 900, color: entry.netProfit >= 0 ? '#4ade80' : '#f87171' }}>
                    {formatKC(entry.netProfit)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <LeaderboardSection rows={leaderboard} sortBy={leaderboardSort} setSortBy={setLeaderboardSort} loading={leaderboardLoading} />
    </div>
  );
};

export default Blackjack;
