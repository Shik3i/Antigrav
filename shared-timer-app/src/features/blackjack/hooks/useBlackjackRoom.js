import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import EVENTS from '../../../../socketEvents.json';
import { fetchJson } from '../../../utils/apiClient';
import { formatKC, normalizeRoomSlug } from '../utils/formatters';

function getRoomId(maxPlayers) {
  return `blackjack-main-${maxPlayers}`;
}

export function useBlackjackRoom({ socket, user, isGuest, setUser, showToast }) {
  const [autoJoinRoom, setAutoJoinRoom] = useState(() => localStorage.getItem('blackjack_auto_join_room') === 'true');
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
  const [watchOnlyRoom, setWatchOnlyRoom] = useState(() => localStorage.getItem('blackjack_watch_only_room') === 'true');
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
    localStorage.setItem('blackjack_auto_join_room', autoJoinRoom ? 'true' : 'false');
  }, [autoJoinRoom]);

  useEffect(() => {
    localStorage.setItem('blackjack_watch_only_room', watchOnlyRoom ? 'true' : 'false');
  }, [watchOnlyRoom]);

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
    if (isGuest || !autoJoinRoom) {
      setRoomState(null);
      return;
    }
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
  }, [autoJoinRoom, isGuest, roomId, selectedTable]);

  const loadRoomStateById = useCallback(async (targetRoomId, targetMaxPlayers = selectedTable) => {
    if (isGuest) {
      setRoomState(null);
      return null;
    }

    const data = await fetchJson(
      `/api/blackjack/state?roomId=${encodeURIComponent(targetRoomId)}&maxPlayers=${targetMaxPlayers === 3 ? 3 : 5}`
    );
    setRoomState(data.state || null);
    return data.state || null;
  }, [isGuest, selectedTable]);

  const joinRoomByApi = useCallback(async (targetRoomId, targetMaxPlayers = selectedTable) => {
    const data = await fetchJson('/api/blackjack/table/join', {
      method: 'POST',
      body: JSON.stringify({
        roomId: targetRoomId,
        maxPlayers: targetMaxPlayers === 3 ? 3 : 5
      })
    });

    joinedRoomIdRef.current = data?.roomId || targetRoomId;
    setRoomState(data?.state || null);
    return data?.state || null;
  }, [selectedTable]);

  const waitForSocketConnection = useCallback(() => new Promise((resolve, reject) => {
    if (!socket) {
      reject(new Error('Socket unavailable.'));
      return;
    }

    if (socket.connected) {
      resolve(socket);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      socket.off(EVENTS.CONNECT, handleConnect);
      socket.off(EVENTS.CONNECT_ERROR, handleConnectError);
      reject(new Error('Socket connection unavailable.'));
    }, 4000);

    const handleConnect = () => {
      window.clearTimeout(timeoutId);
      socket.off(EVENTS.CONNECT_ERROR, handleConnectError);
      resolve(socket);
    };

    const handleConnectError = () => {
      window.clearTimeout(timeoutId);
      socket.off(EVENTS.CONNECT, handleConnect);
      reject(new Error('Socket connection unavailable.'));
    };

    socket.once(EVENTS.CONNECT, handleConnect);
    socket.once(EVENTS.CONNECT_ERROR, handleConnectError);
    socket.connect?.();
  }), [socket]);

  const runSocketAction = useCallback(async (eventName, payload = {}) => {
    const activeSocket = await waitForSocketConnection();

    return new Promise((resolve, reject) => {
      activeSocket.emit(eventName, payload, (response) => {
        if (!response?.success) {
          reject(new Error(response?.error || 'Blackjack action failed.'));
          return;
        }
        if (response && Object.prototype.hasOwnProperty.call(response, 'state')) {
          setRoomState(response.state);
        }
        resolve(response);
      });
    });
  }, [waitForSocketConnection]);

  useEffect(() => {
    setPageLoading(true);
    Promise.all([loadConfig(), loadLeaderboard(), loadRooms(), loadFallbackState()])
      .finally(() => setPageLoading(false));
  }, [loadConfig, loadLeaderboard, loadRooms, loadFallbackState]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  useEffect(() => {
    if (isGuest || !autoJoinRoom || roomState || !roomId) {
      return;
    }

    const activeRoom = (availableRooms || []).find((room) => String(room.roomId) === String(roomId));
    if (!activeRoom) {
      return;
    }

    loadRoomStateById(activeRoom.roomId, activeRoom.maxPlayers).catch((err) => {
      setError(err.message || 'Blackjack-Raum konnte nicht geladen werden.');
    });
  }, [autoJoinRoom, availableRooms, isGuest, loadRoomStateById, roomId, roomState]);

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
      if (!autoJoinRoom) {
        setRoomState(null);
        return;
      }
      const previouslyJoinedRoom = joinedRoomIdRef.current;
      const eventName = watchOnlyRoom
        ? EVENTS.BLACKJACK_WATCH
        : previouslyJoinedRoom && previouslyJoinedRoom !== roomId
        ? EVENTS.BLACKJACK_SWITCH_ROOM
        : EVENTS.BLACKJACK_JOIN;
      const payload = eventName === EVENTS.BLACKJACK_SWITCH_ROOM
        ? { fromRoomId: previouslyJoinedRoom, roomId, maxPlayers: selectedTable }
        : { roomId };

      runSocketAction(eventName, payload)
        .then((response) => {
          joinedRoomIdRef.current = watchOnlyRoom ? null : response?.roomId || roomId;
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
  }, [autoJoinRoom, isGuest, loadFallbackState, roomId, runSocketAction, selectedTable, showToast, socket, watchOnlyRoom]);

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

  const handleSideBetSubmit = useCallback(async (sideBetKey, amount) => {
    const nextAmount = Number(amount || 0);
    const sideBetLabel = sideBetKey === 'twins' ? 'Twins' : sideBetKey === 'bust' ? 'Bust' : 'Side-Bet';
    setActionBusy(true);
    setError('');
    try {
      const response = await runSocketAction(EVENTS.BLACKJACK_SIDE_BET, { roomId, sideBetKey, amount: nextAmount });
      if (response?.state) {
        setRoomState(response.state);
      }
      showToast(nextAmount > 0 ? `${sideBetLabel} Side-Bet gesetzt.` : `${sideBetLabel} Side-Bet entfernt.`, 'success');
    } catch (err) {
      setError(err.message);
    } finally {
      setActionBusy(false);
    }
  }, [roomId, runSocketAction, showToast]);

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

  const handleSwitchRoom = useCallback(async (nextRoomId, nextMaxPlayers = selectedTable) => {
    const safeMaxPlayers = nextMaxPlayers === 3 ? 3 : 5;
    setActionBusy(true);
    setError('');
    try {
      setAutoJoinRoom(true);
      setWatchOnlyRoom(false);
      setSelectedTable(safeMaxPlayers);
      setCurrentRoomId(nextRoomId);

      const previousRoomId = joinedRoomIdRef.current;
      const eventName = previousRoomId && previousRoomId !== nextRoomId
        ? EVENTS.BLACKJACK_SWITCH_ROOM
        : EVENTS.BLACKJACK_JOIN;
      const payload = eventName === EVENTS.BLACKJACK_SWITCH_ROOM
        ? { fromRoomId: previousRoomId, roomId: nextRoomId, maxPlayers: safeMaxPlayers }
        : { roomId: nextRoomId, maxPlayers: safeMaxPlayers };

      const response = await runSocketAction(eventName, payload);
      joinedRoomIdRef.current = response?.roomId || nextRoomId;
      if (response && Object.prototype.hasOwnProperty.call(response, 'state')) {
        setRoomState(response.state);
      } else {
        await loadRoomStateById(nextRoomId, safeMaxPlayers);
      }
    } catch (err) {
      try {
        const state = await joinRoomByApi(nextRoomId, safeMaxPlayers);
        if (!state) {
          await loadRoomStateById(nextRoomId, safeMaxPlayers);
        }
      } catch (stateErr) {
        setError(err.message || stateErr.message || 'Raumwechsel fehlgeschlagen.');
      }
    } finally {
      setActionBusy(false);
    }
  }, [joinRoomByApi, loadRoomStateById, runSocketAction, selectedTable]);

  const handleWatchRoom = useCallback(async (nextRoomId, nextMaxPlayers = selectedTable) => {
    const safeMaxPlayers = nextMaxPlayers === 3 ? 3 : 5;
    setActionBusy(true);
    setError('');
    try {
      setAutoJoinRoom(true);
      setWatchOnlyRoom(true);
      joinedRoomIdRef.current = null;
      setSelectedTable(safeMaxPlayers);
      setCurrentRoomId(nextRoomId);
      const response = await runSocketAction(EVENTS.BLACKJACK_WATCH, { roomId: nextRoomId, maxPlayers: safeMaxPlayers });
      setRoomState(response?.state || null);
    } catch (err) {
      try {
        await loadRoomStateById(nextRoomId, safeMaxPlayers);
      } catch (stateErr) {
        setError(err.message || stateErr.message || 'Zuschauen fehlgeschlagen.');
      }
    } finally {
      setActionBusy(false);
    }
  }, [loadRoomStateById, runSocketAction, selectedTable]);

  const handleCreateRoom = useCallback(async () => {
    const nextRoomId = normalizeRoomSlug(roomDraft, selectedTable);
    setActionBusy(true);
    setError('');
    try {
      setAutoJoinRoom(true);
      setWatchOnlyRoom(false);
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
    setActionBusy(true);
    try {
      await runSocketAction(EVENTS.BLACKJACK_LEAVE, { roomId });
      joinedRoomIdRef.current = null;
      setAutoJoinRoom(false);
      setWatchOnlyRoom(false);
      setRoomState(null);
      showToast('Sitzplatz verlassen.', 'success');
    } catch (err) {
      setError(err.message);
    } finally {
      setActionBusy(false);
    }
  }, [roomId, runSocketAction, showToast]);

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
      setAutoJoinRoom(true);
      setWatchOnlyRoom(false);
      try {
        const joinResp = await runSocketAction(EVENTS.BLACKJACK_JOIN, { roomId });
        if (joinResp?.roomId) {
          joinedRoomIdRef.current = joinResp.roomId;
        }
      } catch (err) {
        const isNotFound = err.message?.toLowerCase().includes('not found');
        const roomExistsInLobby = (availableRooms || []).some((room) => String(room.roomId) === String(roomId));

        if (isNotFound && !roomState && !roomExistsInLobby) {
          const createResp = await runSocketAction(EVENTS.BLACKJACK_CREATE_ROOM, { roomId, maxPlayers: selectedTable });
          await runSocketAction(EVENTS.BLACKJACK_JOIN, { roomId });
          joinedRoomIdRef.current = createResp?.roomId || roomId;
        } else {
          throw err;
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
  }, [availableRooms, roomId, roomState, runSocketAction, selectedTable, showToast]);

  return {
    actionBusy,
    autoJoinRoom,
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
    handleSideBetSubmit,
    handleSwitchRoom,
    handleWatchRoom,
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
    setRoomState,
    setSelectedTable,
    setUser,
    user
  };
}
