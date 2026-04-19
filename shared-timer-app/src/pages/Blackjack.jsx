import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Coins, Crown, Loader2, LogIn, ShieldAlert, Trophy, UserRound } from 'lucide-react';
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

function ChipStack({ amount }) {
  const chips = buildChipBreakdown(amount).slice(0, 9);

  if (!chips.length) {
    return <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.82rem' }}>Kein Einsatz</div>;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', minHeight: '36px' }}>
      <div style={{ position: 'relative', width: `${Math.max(40, chips.length * 10)}px`, height: '40px' }}>
        {chips.map((chip, index) => (
          <div
            key={`${chip}-${index}`}
            style={{
              position: 'absolute',
              left: `${index * 8}px`,
              bottom: `${index * 2}px`,
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              border: '2px dashed rgba(255,255,255,0.85)',
              background: chip >= 500 ? '#7c3aed' : chip >= 100 ? '#dc2626' : chip >= 50 ? '#0ea5e9' : chip >= 10 ? '#22c55e' : chip >= 5 ? '#f59e0b' : '#f8fafc',
              color: chip >= 50 ? '#fff' : '#111827',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.66rem',
              fontWeight: 900,
              boxShadow: '0 8px 18px rgba(0,0,0,0.25)'
            }}
          >
            {chip}
          </div>
        ))}
      </div>
      <div style={{ fontSize: '0.86rem', color: '#f8fafc', fontWeight: 700 }}>{formatKC(amount)}</div>
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
  return (
    <div className="blackjack-dealer-zone">
      <div className="blackjack-dealer-header">
        <div>
          <div className="blackjack-area-kicker">Dealer</div>
          <div className="blackjack-dealer-title">House hand</div>
          <div className="blackjack-dealer-status">{getDealerStatusText(roomState)}</div>
        </div>
        <div className="blackjack-value-badge">Value {roomState?.dealerHandValue ?? 0}</div>
      </div>

      <div className="blackjack-dealer-cards">
        {(roomState?.dealerHand || []).map((card, index) => <PlayingCard key={`${card.code}-${index}`} card={card} index={index} />)}
        {!roomState?.dealerHand?.length && <div className="blackjack-seat-empty-copy">Cards will land here after the deal.</div>}
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

function PlayerSeat({ player, selectedTable, roomState, settlement, isCurrentTurn, isLocalPlayer, canSelectEmptySeat, onSelectEmptySeat }) {
  const statusLabel = getPlayerStatusLabel(player, roomState, settlement, isCurrentTurn, isLocalPlayer);
  const resultMeta = getSeatResultMeta(settlement);
  const isWinningSeat = settlement && Number(settlement.netProfit || 0) > 0;
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

  return (
    <div key={player.userId} className={seatClassName}>
      {isCurrentTurn && <div className="blackjack-turn-arrow">{isLocalPlayer ? 'YOUR TURN' : 'TURN'}</div>}
      <div className="blackjack-seat-header">
        <div className="blackjack-seat-user">
          <Avatar user={{ username: player.username, preferences: {} }} size={34} />
          <div style={{ minWidth: 0 }}>
            <div className="blackjack-seat-name">{player.displayName || player.username}</div>
            <div className="blackjack-seat-subline">Seat {player.seat}{player.isBot ? ' • Bot' : isLocalPlayer ? ' • You' : ''}</div>
          </div>
        </div>
        <div className="blackjack-seat-metrics">
          <div className="blackjack-value-badge">Value {player.handValue || 0}</div>
          <div className={`blackjack-seat-status ${resultMeta ? 'is-result' : ''}`}>{statusLabel}</div>
        </div>
      </div>

      <div className="blackjack-seat-bet-row">
        <div className="blackjack-seat-bet-label">Current bet</div>
        <div className="blackjack-seat-spot">
          <ChipStack amount={player.currentBet} />
        </div>
      </div>

      <div className="blackjack-hand-wrap">
        {(player.hand || []).map((card, index) => <PlayingCard key={`${card.code}-${index}`} card={card} index={index} compact />)}
        {!player.hand?.length && <div className="blackjack-seat-empty-copy">Waiting for cards.</div>}
      </div>

      {resultMeta && (
        <div style={{ padding: '8px 10px', borderRadius: '14px', background: resultMeta.bg, color: resultMeta.color, display: 'flex', justifyContent: 'space-between', gap: '10px', fontWeight: 800 }}>
          <span>{resultMeta.label}</span>
          <span>{formatKC(settlement.netProfit)}</span>
        </div>
      )}
    </div>
  );
}

function BlackjackActionBar({
  isGuest,
  user,
  pendingBet,
  autoBetEnabled,
  setAutoBetEnabled,
  actionBusy,
  betAdjustMode,
  setBetAdjustMode,
  config,
  roomState,
  setPendingBet,
  handleBetSubmit,
  canAct,
  handleTurnAction,
  currentTurnIsLocal
}) {
  if (isGuest) {
    return (
      <div className="blackjack-control-deck">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#fca5a5', textAlign: 'center' }}>
          <LogIn size={16} />
          Für Multiplayer-Blackjack brauchst du einen Login.
        </div>
      </div>
    );
  }

  return (
    <div className={`blackjack-control-deck${currentTurnIsLocal ? ' is-live' : ''}`}>
      <div className="blackjack-control-grid">
        <div className="blackjack-control-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc', fontWeight: 800 }}>
            <Coins size={16} color="#fbbf24" />
            Wallet
          </div>
          <div style={{ fontSize: '1.32rem', fontWeight: 900 }}>{formatKC(user?.koala_balance || 0)}</div>
          <div className="blackjack-pending-chip">
            <div className="blackjack-toggle-row">
              <div>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.56)', marginBottom: '4px' }}>
                  Auto bet
                </div>
                <strong style={{ fontSize: '1rem' }}>{formatKC(pendingBet)}</strong>
              </div>
              <button
                type="button"
                className={`blackjack-toggle${autoBetEnabled ? ' active' : ''}`}
                onClick={() => setAutoBetEnabled((prev) => !prev)}
                disabled={actionBusy}
                aria-label="Automatisch setzen umschalten"
              />
            </div>
          </div>
        </div>

        <div className="blackjack-control-panel">
          <div className="blackjack-controls-caption">Bet controls</div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div className="blackjack-chip-mode">
              <button type="button" className={betAdjustMode === 'add' ? 'active' : ''} onClick={() => setBetAdjustMode('add')} disabled={actionBusy}>+</button>
              <button type="button" className={betAdjustMode === 'subtract' ? 'active' : ''} onClick={() => setBetAdjustMode('subtract')} disabled={actionBusy}>-</button>
            </div>
          </div>
          <div className="blackjack-chip-row">
            {(config?.allowedBets || CHIP_VALUES).map((chip) => (
              <button
                key={chip}
                onClick={() => setPendingBet((prev) => (
                  betAdjustMode === 'add'
                    ? prev + chip * 100
                    : Math.max(0, prev - chip * 100)
                ))}
                disabled={actionBusy || !['waiting', 'betting'].includes(roomState?.status)}
                className="blackjack-chip-button"
              >
                {betAdjustMode === 'add' ? '+' : '-'}{chip}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn-ghost blackjack-control-button" onClick={() => setPendingBet(0)} disabled={actionBusy}>Reset</button>
            <button className="btn-ghost blackjack-control-button" onClick={handleBetSubmit} disabled={actionBusy || pendingBet <= 0 || !['waiting', 'betting'].includes(roomState?.status)}>
              {pendingBet > 0 ? `Bet ${formatKC(pendingBet)}` : 'Place bet'}
            </button>
          </div>
        </div>

        <div className={`blackjack-control-panel blackjack-action-panel${canAct ? ' active' : ''}`}>
          <div className="blackjack-controls-caption">{canAct ? 'In hand actions' : 'Waiting for turn'}</div>
          <div className="blackjack-action-row">
            <button className="btn-ghost blackjack-turn-button blackjack-control-button hit" onClick={() => handleTurnAction(EVENTS.BLACKJACK_HIT)} disabled={!canAct}>
              Hit
            </button>
            <button className="btn-ghost blackjack-turn-button blackjack-control-button stand" onClick={() => handleTurnAction(EVENTS.BLACKJACK_STAND)} disabled={!canAct}>
              Stand
            </button>
          </div>
          <div style={{ color: canAct ? '#fde68a' : 'rgba(255,255,255,0.48)', fontSize: '0.82rem', textAlign: 'center' }}>
            {canAct ? 'Your hand is live. Choose now.' : 'Action buttons unlock only on your turn.'}
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const mySeat = useMemo(() => roomState?.players?.find((player) => player.userId === user?.id) || null, [roomState?.players, user?.id]);
  const canAct = Boolean(mySeat && roomState?.status === 'player_turns' && roomState?.currentPlayerTurn === mySeat.userId && !actionBusy);
  const settlementRows = recentSettlement?.results || [];
  const tableSeats = useMemo(() => {
    const maxPlayers = roomState?.maxPlayers || selectedTable;
    const playersByVisualSeat = new Map(
      (roomState?.players || []).map((player) => [
        getVisualSeat(player.seat, mySeat?.seat || null, maxPlayers),
        player
      ])
    );

    return Array.from({ length: maxPlayers }, (_, index) => {
      const visualSeat = index + 1;
      const player = playersByVisualSeat.get(visualSeat);
      return player ? { ...player, visualSeat } : { seat: visualSeat, visualSeat };
    });
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
        })
        .catch((err) => {
        setError(err.message);
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
      await runSocketAction(EVENTS.BLACKJACK_BET, { roomId, amount: pendingBet });
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

  const handleSeatSwitch = useCallback(async (seatPlayer) => {
    if (!canSwitchSeats || !mySeat?.seat) return;

    const actualSeat = getActualSeat(seatPlayer.visualSeat, mySeat.seat, roomState?.maxPlayers || selectedTable);
    setActionBusy(true);
    setError('');
    try {
      await runSocketAction(EVENTS.BLACKJACK_SWITCH_SEAT, { roomId, seat: actualSeat });
      showToast(`Du sitzt jetzt auf Platz ${actualSeat}.`, 'success');
    } catch (err) {
      setError(err.message || 'Platzwechsel fehlgeschlagen.');
    } finally {
      setActionBusy(false);
    }
  }, [canSwitchSeats, mySeat?.seat, roomId, roomState?.maxPlayers, runSocketAction, selectedTable, showToast]);

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
            transform: translateY(-34px) rotate(-9deg) scale(0.88);
            filter: blur(4px);
          }
          100% {
            opacity: 1;
            transform: translateY(0) rotate(0deg) scale(1);
            filter: blur(0);
          }
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
          --seat-width: clamp(190px, 15vw, 250px);
          position: relative;
          min-height: clamp(720px, 62vw, 940px);
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
          top: 34%;
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
          padding: 8px 10px;
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
          align-items: flex-start;
          margin-bottom: 14px;
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
          z-index: 3;
          width: min(var(--seat-width), calc(100% - 24px));
          padding: 8px 8px 0;
          border-radius: 24px;
          background: transparent;
          border: none;
          backdrop-filter: none;
          box-shadow: none;
          transform: var(--seat-transform, none);
          transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
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

        .blackjack-seat-3-1 { --seat-transform: translateX(-50%); bottom: 148px; left: 50%; }
        .blackjack-seat-3-2 { bottom: 228px; left: 10%; }
        .blackjack-seat-3-3 { bottom: 228px; right: 10%; }

        .blackjack-seat-5-1 { --seat-transform: translateX(-50%); bottom: 132px; left: 50%; }
        .blackjack-seat-5-1,
        .blackjack-seat-5-2,
        .blackjack-seat-5-3,
        .blackjack-seat-5-4,
        .blackjack-seat-5-5 {
          width: min(clamp(156px, 11vw, 206px), calc(100% - 24px));
        }
        .blackjack-seat-5-2 { bottom: 286px; left: 3.2%; }
        .blackjack-seat-5-3 { bottom: 184px; left: 16%; }
        .blackjack-seat-5-4 { bottom: 184px; right: 16%; }
        .blackjack-seat-5-5 { bottom: 248px; right: 2.2%; }

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

        .blackjack-control-button.hit:not(:disabled) {
          background: linear-gradient(135deg, rgba(34,197,94,0.92), rgba(22,163,74,0.92));
          border-color: rgba(74,222,128,0.46);
        }

        .blackjack-control-button.stand:not(:disabled) {
          background: linear-gradient(135deg, rgba(251,191,36,0.92), rgba(217,119,6,0.92));
          border-color: rgba(245,158,11,0.44);
          color: #111827;
        }

        .blackjack-control-button:disabled {
          opacity: 0.42;
        }

        .blackjack-settlement-card {
          animation: blackjackSettlementIn 380ms cubic-bezier(0.16, 1, 0.3, 1) both;
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
            <div className="blackjack-table-center">
              <div className="blackjack-area-kicker">KoalaSync Casino</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#f8fafc', marginBottom: '6px' }}>Blackjack Table</div>
              <div style={{ color: 'rgba(255,255,255,0.58)', fontSize: '0.86rem' }}>Live seats, hidden hole card and automatic dealer flow.</div>
            </div>

            <FeltPile label="Shoe" count={roomState?.shoeRemaining ?? 0} side="right" accent="#fbbf24" />
            <FeltPile label="Discard" count={roomState?.discardCount ?? 0} side="left" accent="#93c5fd" />

            <DealerHand roomState={roomState} />

            {tableSeats.map((player) => {
              const isCurrentTurn = roomState?.currentPlayerTurn === player.userId;
              const settlement = roomState?.lastSettlement?.find((entry) => entry.userId === player.userId);
              return (
                <PlayerSeat
                  key={player.userId || `seat-${player.visualSeat}`}
                  player={player}
                  selectedTable={selectedTable}
                  roomState={roomState}
                  settlement={settlement}
                  isCurrentTurn={isCurrentTurn}
                  isLocalPlayer={player.userId === user?.id}
                  canSelectEmptySeat={canSwitchSeats}
                  onSelectEmptySeat={handleSeatSwitch}
                />
              );
            })}

          </div>

          <BlackjackActionBar
            isGuest={isGuest}
            user={user}
            pendingBet={pendingBet}
            autoBetEnabled={autoBetEnabled}
            setAutoBetEnabled={setAutoBetEnabled}
            actionBusy={actionBusy}
            betAdjustMode={betAdjustMode}
            setBetAdjustMode={setBetAdjustMode}
            config={config}
            roomState={roomState}
            setPendingBet={setPendingBet}
            handleBetSubmit={handleBetSubmit}
            canAct={canAct}
            handleTurnAction={handleTurnAction}
            currentTurnIsLocal={roomState?.currentPlayerTurn === user?.id}
          />
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
                  background: room.roomId === roomId ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${room.roomId === roomId ? 'rgba(245,158,11,0.24)' : 'rgba(255,255,255,0.06)'}`
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
