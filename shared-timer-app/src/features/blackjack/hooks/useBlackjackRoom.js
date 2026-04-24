import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import EVENTS from '../../../../socketEvents.json';
import { fetchJson } from '../../../utils/apiClient';
import { formatKC, normalizeRoomSlug } from '../utils/formatters';

function getRoomId(maxPlayers) {
  return `blackjack-main-${maxPlayers}`;
}

export function useBlackjackRoom({ socket, user, isGuest, setUser, showToast }) {
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
  const [autoBetEnabled, setAutoBetEnabled] = useState(() => localStorage.getItem('blackjack_auto_bet') === 'true');
  const joinedRoomIdRef = useRef(null);

  const roomId = useMemo(() => currentRoomId || getRoomId(selectedTable), [currentRoomId, selectedTable]);
  const mySeat = useMemo(
    () => roomState?.players?.find((player) => String(player.userId) === String(user?.id)) || null,
    [roomState?.players, user?.id]
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

  const syncBalance = useCallback((balance) => {
    if (!Number.isFinite(balance)) return;
    setUser((prev) => (prev ? { ...prev, koala_balance: balance } : prev));
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
          setError('');
        })
        .catch(async (err) => {
          const isNotFound = err.message?.toLowerCase().includes('not found');
          if (isNotFound && eventName === EVENTS.BLACKJACK_JOIN) {
            try {
              const createResp = await runSocketAction(EVENTS.BLACKJACK_CREATE_ROOM, { roomId, maxPlayers: selectedTable });
              joinedRoomIdRef.current = createResp?.roomId || roomId;
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
  }, [isGuest, loadFallbackState, roomId, runSocketAction, selectedTable, showToast, socket]);

  useEffect(() => {
    const handleCoinUpdate = ({ balance }) => syncBalance(balance);
    socket?.on(EVENTS.COIN_BALANCE_UPDATE, handleCoinUpdate);
    return () => socket?.off(EVENTS.COIN_BALANCE_UPDATE, handleCoinUpdate);
  }, [socket, syncBalance]);

  const handleBetSubmit = useCallback(async () => {
    if (!pendingBet) {
      showToast('Bitte erst Chips zum Einsatz hinzufügen.', 'warning');
      return;
    }

    setActionBusy(true);
    setError('');
    try {
      const response = await runSocketAction(EVENTS.BLACKJACK_BET, { roomId, amount: pendingBet });
      if (response?.state) {
        setRoomState(response.state);
      }
      showToast(`Einsatz von ${formatKC(pendingBet)} gesetzt.`, 'success');
    } catch (err) {
      setError(err.message);
    } finally {
      setActionBusy(false);
    }
  }, [pendingBet, roomId, runSocketAction, showToast]);

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

  const handleTurnAction = useCallback(async (eventName) => {
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
  }, [loadLeaderboard, roomId, runSocketAction]);

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
    if (mySeat?.currentBet > 0 || !['waiting', 'betting'].includes(roomState?.status)) {
      showToast('Du kannst den Tisch während einer aktiven Runde nicht verlassen.', 'warning');
      return;
    }
    setActionBusy(true);
    try {
      await runSocketAction(EVENTS.BLACKJACK_LEAVE, { roomId });
      showToast('Sitzplatz verlassen.', 'success');
    } catch (err) {
      setError(err.message);
    } finally {
      setActionBusy(false);
    }
  }, [mySeat?.currentBet, roomId, roomState?.status, runSocketAction, showToast]);

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

  const handleRemoveBot = useCallback(async (targetRoomId, botUserId = null) => {
    setActionBusy(true);
    setError('');
    try {
      await runSocketAction(EVENTS.BLACKJACK_REMOVE_BOT, { roomId: targetRoomId, botUserId });
      showToast('Blackjack-Bot entfernt.', 'success');
    } catch (err) {
      setError(err.message || 'Bot konnte nicht entfernt werden.');
    } finally {
      setActionBusy(false);
    }
  }, [runSocketAction, showToast]);

  const handleSmartJoin = useCallback(async (seatObj) => {
    setActionBusy(true);
    setError('');
    try {
      let activeRoomState = roomState;
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

  return {
    actionBusy,
    autoBetEnabled,
    availableRooms,
    config,
    currentRoomId,
    error,
    handleAddBot,
    handleBetSubmit,
    handleCreateRoom,
    handleLeaveTable,
    handleRemoveBot,
    handleSmartJoin,
    handleSwitchRoom,
    handleTurnAction,
    leaderboard,
    leaderboardLoading,
    leaderboardSort,
    loadRooms,
    mySeat,
    pageLoading,
    pendingBet,
    recentSettlement,
    roomDraft,
    roomId,
    roomState,
    selectedTable,
    setAutoBetEnabled,
    setCurrentRoomId,
    setLeaderboardSort,
    setPendingBet,
    setRoomDraft,
    setSelectedTable,
    setUser,
    user
  };
}
