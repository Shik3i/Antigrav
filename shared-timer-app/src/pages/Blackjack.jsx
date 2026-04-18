import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Coins, Crown, Loader2, LogIn, ShieldAlert, Swords, Trophy, UserRound } from 'lucide-react';
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
  push: { label: 'Push', color: '#facc15', bg: 'rgba(250,204,21,0.18)' }
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

function PlayingCard({ card, index = 0 }) {
  return (
    <div
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
    loadRooms();
  }, [loadRooms, roomState?.players?.length, roomState?.status, roomId]);

  useEffect(() => {
    if (isGuest || !socket) return undefined;

    const handleState = (state) => {
      setRoomState(state);
      setError('');
    };
    const handleError = (message) => {
      setError(message || 'Blackjack-Fehler');
      showToast(message || 'Blackjack-Fehler', 'warning');
      loadFallbackState();
    };
    const handleConnect = () => {
      runSocketAction(EVENTS.BLACKJACK_JOIN, { roomId, maxPlayers: selectedTable }).catch((err) => {
        setError(err.message);
      });
    };

    socket.on(EVENTS.BLACKJACK_STATE, handleState);
    socket.on(EVENTS.BLACKJACK_ERROR, handleError);
    socket.on(EVENTS.CONNECT, handleConnect);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off(EVENTS.BLACKJACK_STATE, handleState);
      socket.off(EVENTS.BLACKJACK_ERROR, handleError);
      socket.off(EVENTS.CONNECT, handleConnect);
      if (socket.connected) {
        socket.emit(EVENTS.BLACKJACK_LEAVE, { roomId });
      }
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
      await loadRooms();
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
      .then(() => loadRooms())
      .catch((err) => {
        setError(err.message);
      });
  }, [
    actionBusy,
    autoBetEnabled,
    isGuest,
    loadRooms,
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
      await loadRooms();
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

  const handleCreateRoom = useCallback(() => {
    const nextRoomId = normalizeRoomSlug(roomDraft, selectedTable);
    setRoomDraft('');
    handleSwitchRoom(nextRoomId, selectedTable);
  }, [handleSwitchRoom, roomDraft, selectedTable]);

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
          position: relative;
          min-height: 820px;
          border-radius: 38px;
          overflow: hidden;
          background:
            radial-gradient(circle at 50% 30%, rgba(255,255,255,0.05), transparent 28%),
            linear-gradient(180deg, rgba(44, 18, 10, 0.95), rgba(24, 10, 6, 0.98));
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 30px 80px rgba(0,0,0,0.28);
        }

        .blackjack-stage::before {
          content: "";
          position: absolute;
          inset: 24px;
          border-radius: 999px;
          background:
            radial-gradient(circle at 50% 35%, rgba(34, 197, 94, 0.12), transparent 40%),
            linear-gradient(180deg, rgba(14, 86, 52, 0.98), rgba(8, 54, 34, 0.98));
          border: 14px solid rgba(66, 26, 16, 0.92);
          box-shadow:
            inset 0 0 0 2px rgba(245,158,11,0.20),
            inset 0 18px 32px rgba(255,255,255,0.04),
            inset 0 -22px 44px rgba(0,0,0,0.28);
        }

        .blackjack-stage::after {
          content: "";
          position: absolute;
          inset: 58px;
          border-radius: 999px;
          border: 1px dashed rgba(245, 158, 11, 0.22);
          pointer-events: none;
        }

        .blackjack-table-center {
          position: absolute;
          left: 50%;
          top: 35%;
          transform: translate(-50%, -50%);
          z-index: 2;
          width: min(520px, 72%);
          padding: 18px 20px;
          border-radius: 999px;
          text-align: center;
          background: radial-gradient(circle, rgba(255,255,255,0.10), rgba(255,255,255,0.02));
          border: 1px solid rgba(255,255,255,0.10);
          backdrop-filter: blur(8px);
        }

        .blackjack-dealer-zone {
          position: absolute;
          top: 82px;
          left: 50%;
          transform: translateX(-50%);
          width: min(520px, calc(100% - 80px));
          z-index: 3;
        }

        .blackjack-corner-status {
          position: absolute;
          top: 28px;
          right: 28px;
          z-index: 5;
          min-width: 210px;
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
          width: min(260px, calc(100% - 40px));
          padding: 18px;
          border-radius: 26px;
          background: linear-gradient(180deg, rgba(9, 18, 14, 0.72), rgba(9, 13, 18, 0.78));
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(8px);
          box-shadow: 0 18px 30px rgba(0,0,0,0.18);
          transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }

        .blackjack-seat.current-turn {
          border-color: rgba(245, 158, 11, 0.34);
          transform: translateY(-4px);
          animation: blackjackGlowPulse 2.2s ease-in-out infinite;
        }

        .blackjack-seat.winner-seat {
          border-color: rgba(245, 158, 11, 0.85);
          box-shadow: 0 0 0 1px rgba(245,158,11,0.35), 0 18px 34px rgba(245,158,11,0.22);
          background: linear-gradient(180deg, rgba(42, 28, 8, 0.82), rgba(18, 16, 10, 0.82));
        }

        .blackjack-seat-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(245,158,11,0.16);
          border: 1px solid rgba(245,158,11,0.35);
          color: #fde68a;
          font-size: 0.76rem;
          font-weight: 800;
        }

        .blackjack-seat-3-1 { bottom: 228px; left: 50%; transform: translateX(-50%); }
        .blackjack-seat-3-2 { bottom: 252px; left: 70px; }
        .blackjack-seat-3-3 { bottom: 252px; right: 70px; }

        .blackjack-seat-5-1 { bottom: 242px; left: 50%; transform: translateX(-50%); }
        .blackjack-seat-5-2 { bottom: 166px; left: 72px; }
        .blackjack-seat-5-3 { bottom: 286px; left: 142px; }
        .blackjack-seat-5-4 { bottom: 286px; right: 142px; }
        .blackjack-seat-5-5 { bottom: 166px; right: 72px; }

        .blackjack-control-deck {
          position: absolute;
          left: 50%;
          bottom: 18px;
          transform: translateX(-50%);
          width: min(920px, calc(100% - 44px));
          z-index: 4;
          padding: 16px 18px;
          border-radius: 28px;
          background: linear-gradient(180deg, rgba(8,18,14,0.96), rgba(7,12,18,0.96));
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 24px 44px rgba(0,0,0,0.34);
          backdrop-filter: blur(12px);
        }

        .blackjack-control-grid {
          display: grid;
          grid-template-columns: minmax(180px, 220px) minmax(0, 1fr) minmax(220px, 280px);
          gap: 16px;
          align-items: center;
        }

        .blackjack-chip-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
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
          min-width: 52px;
          border: none;
          border-radius: 999px;
          padding: 8px 12px;
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
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          flex-wrap: wrap;
        }

        .blackjack-countdown-clock {
          display: inline-flex;
          min-width: 110px;
          justify-content: center;
          align-items: center;
          padding: 10px 14px;
          border-radius: 18px;
          font-size: 1.55rem;
          font-weight: 900;
          letter-spacing: 0.04em;
          background: rgba(10,16,24,0.82);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
        }

        .blackjack-pending-chip {
          display: grid;
          gap: 8px;
          padding: 12px 14px;
          border-radius: 18px;
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
          width: 54px;
          height: 30px;
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
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #fff;
          transition: transform 180ms ease;
        }

        .blackjack-toggle.active::after {
          transform: translateX(24px);
        }

        .blackjack-amount-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: #f8fafc;
          font-weight: 800;
        }

        .blackjack-turn-button {
          min-width: 132px;
          min-height: 54px;
          border-radius: 18px;
          font-size: 1rem;
          font-weight: 900;
        }

        .blackjack-control-button {
          min-height: 54px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: #f8fafc;
          font-weight: 800;
          box-shadow: none;
        }

        .blackjack-control-button:disabled {
          opacity: 0.5;
        }

        .blackjack-settlement-card {
          animation: blackjackSettlementIn 380ms cubic-bezier(0.16, 1, 0.3, 1) both;
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
          .blackjack-corner-status,
          .blackjack-dealer-zone,
          .blackjack-seat,
          .blackjack-control-deck {
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
            justify-content: stretch;
          }
        }
      `}</style>

      <section style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '36px',
        padding: '28px',
        background: 'radial-gradient(circle at top, rgba(20,83,45,0.95), rgba(9,37,24,0.98) 50%, rgba(7,18,12,0.98) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.28)'
      }}>
        <div style={{ position: 'absolute', inset: '18px', border: '1px solid rgba(245,158,11,0.14)', borderRadius: '28px', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '22px', paddingRight: '96px' }}>
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

          <div style={{ display: 'grid', gap: '12px', minWidth: 'min(100%, 220px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
              <span style={{ color: 'rgba(255,255,255,0.72)' }}>Tischgröße</span>
              <div style={{ display: 'flex', gap: '8px' }}>
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
                      padding: '10px 16px',
                      background: selectedTable === option ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(255,255,255,0.07)',
                      color: '#fff',
                      fontWeight: 800
                    }}
                  >
                    {option} Seats
                  </button>
                ))}
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
            <div className="blackjack-corner-status">
              <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.56)', marginBottom: '8px' }}>
                {roomState?.currentPlayerTurn === user?.id ? 'Dein Zugtimer' : autoStartSeconds !== null ? 'Nächste Runde' : 'Tischstatus'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div className="blackjack-countdown-clock" style={{ color: roomState?.currentPlayerTurn === user?.id ? '#fbbf24' : '#f8fafc' }}>
                  {String(roomState?.currentPlayerTurn === user?.id ? turnCountdownSeconds : (autoStartSeconds ?? 0)).padStart(2, '0')}s
                </div>
                <div style={{ fontSize: '0.82rem', lineHeight: 1.35, maxWidth: '180px', color: 'rgba(255,255,255,0.8)' }}>
                  {roomState?.currentPlayerTurn === user?.id ? 'Zeit fuer Hit oder Stand.' : autoStartSeconds !== null ? 'Der Tisch teilt danach automatisch aus.' : 'Warte auf den naechsten Einsatz.'}
                </div>
              </div>
            </div>

            <div className="blackjack-table-center">
              <div style={{ fontSize: '0.76rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                KoalaSync Casino
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#f8fafc', marginBottom: '6px' }}>
                {STATUS_LABELS[roomState?.status] || 'Bereit'}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.58)', fontSize: '0.86rem' }}>
                {roomState?.currentPlayerTurn ? `Aktiver Zug läuft. Auto-Stand in ${turnCountdownSeconds}s.` : autoStartSeconds !== null ? `Nächste Runde startet automatisch in ${autoStartSeconds}s.` : 'Neue Einsätze können gesetzt werden.'}
              </div>
            </div>

            <div className="blackjack-dealer-zone" style={{
              padding: '22px',
              borderRadius: '28px',
              background: 'linear-gradient(180deg, rgba(18,28,21,0.84), rgba(9,15,12,0.82))',
              border: '1px solid rgba(255,255,255,0.08)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc', fontWeight: 800, marginBottom: '4px' }}>
                    <Swords size={16} color="#fbbf24" />
                    Dealer
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.58)', fontSize: '0.88rem' }}>Hole Card bleibt bis zum Reveal versteckt.</div>
                </div>
                <div style={{ fontWeight: 700, color: '#fbbf24' }}>Hand Value: {roomState?.dealerHandValue ?? 0}</div>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
                {(roomState?.dealerHand || []).map((card, index) => <PlayingCard key={`${card.code}-${index}`} card={card} index={index} />)}
                {!roomState?.dealerHand?.length && <div style={{ color: 'rgba(255,255,255,0.46)' }}>Noch keine Karten verteilt.</div>}
              </div>
            </div>

            {tableSeats.map((player) => {
              const isCurrentTurn = roomState?.currentPlayerTurn === player.userId;
              const settlement = roomState?.lastSettlement?.find((entry) => entry.userId === player.userId);
              const resultMeta = settlement ? RESULT_META[settlement.result] : null;
              const isWinningSeat = roomState?.status === 'settlement' && settlement?.result === 'win';

              return (
                <div
                  key={player.userId || `seat-${player.visualSeat}`}
                  className={`${getSeatClass(roomState?.maxPlayers || selectedTable, player.visualSeat)}${isCurrentTurn ? ' current-turn' : ''}${isWinningSeat ? ' winner-seat' : ''}`}
                  style={{ minHeight: '250px', display: 'grid', alignContent: 'start', gap: '14px' }}
                >
                  {player.userId ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', minWidth: 0 }}>
                          <Avatar user={{ username: player.username, preferences: {} }} size={34} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{player.displayName || player.username}</div>
                            <div style={{ color: 'rgba(255,255,255,0.54)', fontSize: '0.82rem' }}>Seat {player.seat}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {isWinningSeat && <div className="blackjack-seat-badge">🏆 Gewinner</div>}
                          {player.userId === user?.id && <div style={{ fontSize: '0.76rem', color: '#fbbf24', fontWeight: 800 }}>DU</div>}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <ChipStack amount={player.currentBet} />
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 800 }}>Wert: {player.handValue || 0}</div>
                          <div style={{ fontSize: '0.78rem', color: player.busted ? '#f87171' : 'rgba(255,255,255,0.52)' }}>
                            {player.blackjack ? 'Blackjack' : player.busted ? 'Bust' : player.stood ? 'Stand' : isCurrentTurn ? 'Am Zug' : 'Wartet'}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {(player.hand || []).map((card, index) => <PlayingCard key={`${card.code}-${index}`} card={card} index={index} />)}
                        {!player.hand?.length && <div style={{ color: 'rgba(255,255,255,0.4)' }}>Noch keine Karten.</div>}
                      </div>

                      {resultMeta && (
                        <div style={{ padding: '10px 12px', borderRadius: '14px', background: resultMeta.bg, color: resultMeta.color, display: 'flex', justifyContent: 'space-between', gap: '12px', fontWeight: 800 }}>
                          <span>{resultMeta.label}</span>
                          <span>{formatKC(settlement.netProfit)}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.38)', textAlign: 'center' }}>
                      <div>
                        <UserRound size={22} style={{ marginBottom: '10px' }} />
                        Freier Seat {player.visualSeat}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="blackjack-control-deck">
              {isGuest ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#fca5a5', textAlign: 'center' }}>
                  <LogIn size={16} />
                  Für Multiplayer-Blackjack brauchst du einen Login.
                </div>
              ) : (
                <div className="blackjack-control-grid">
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc', fontWeight: 800 }}>
                      <Coins size={16} color="#fbbf24" />
                      Wallet
                    </div>
                    <div style={{ fontSize: '1.32rem', fontWeight: 900 }}>{formatKC(user?.koala_balance || 0)}</div>
                    <div className="blackjack-pending-chip">
                      <div className="blackjack-toggle-row">
                        <div>
                          <div style={{ fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.56)', marginBottom: '4px' }}>
                            Automatisch setzen
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

                  <div style={{ display: 'grid', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <div className="blackjack-chip-mode">
                        <button
                          type="button"
                          className={betAdjustMode === 'add' ? 'active' : ''}
                          onClick={() => setBetAdjustMode('add')}
                          disabled={actionBusy}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          className={betAdjustMode === 'subtract' ? 'active' : ''}
                          onClick={() => setBetAdjustMode('subtract')}
                          disabled={actionBusy}
                        >
                          -
                        </button>
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
                          style={{
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.05)',
                            color: '#fff',
                            borderRadius: '999px',
                            padding: '10px 14px',
                            cursor: 'pointer',
                            fontWeight: 700
                          }}
                        >
                          {betAdjustMode === 'add' ? '+' : '-'}{chip}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <button className="btn-ghost blackjack-control-button" onClick={() => setPendingBet(0)} disabled={actionBusy}>Reset</button>
                      <button className="btn-ghost blackjack-control-button" onClick={handleBetSubmit} disabled={actionBusy || pendingBet <= 0 || !['waiting', 'betting'].includes(roomState?.status)}>
                        {pendingBet > 0 ? `Setzen ${formatKC(pendingBet)}` : 'Setzen'}
                      </button>
                    </div>
                  </div>

                  <div className="blackjack-action-row">
                    <button className="btn-ghost blackjack-turn-button blackjack-control-button" onClick={() => handleTurnAction(EVENTS.BLACKJACK_HIT)} disabled={!canAct}>
                      Hit
                    </button>
                    <button className="btn-ghost blackjack-turn-button blackjack-control-button" onClick={() => handleTurnAction(EVENTS.BLACKJACK_STAND)} disabled={!canAct}>
                      Stand
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
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
            <button className="btn-primary" onClick={handleCreateRoom}>
              Tisch erstellen und beitreten
            </button>
          </div>

          <div style={{ display: 'grid', gap: '10px' }}>
            <div style={{ fontWeight: 800 }}>Offene {selectedTable}er-Tische</div>
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
                  gridTemplateColumns: 'minmax(160px, 1fr) 90px 120px 120px',
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
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
