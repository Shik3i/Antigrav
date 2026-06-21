import { useCallback, useEffect, useRef, useState } from 'react';
import EVENTS from '../../../../socketEvents.json';
import { fetchJson } from '../../../utils/apiClient';
import { useSocketAction } from '../../casino/hooks/useSocketAction';
import { useCasinoBalance } from '../../casino/hooks/useCasinoBalance';
import { useChipSkin } from '../../casino/ChipSkinContext';

export function useRouletteGame({ socket, user, setUser, showToast }) {
  const [roomState, setRoomState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedChip, setSelectedChip] = useState(10);
  const [lastWheelSpin, setLastWheelSpin] = useState(null);
  const [busy, setBusy] = useState(false);
  const [roundHistory, setRoundHistory] = useState([]); // last 5 rounds
  const [lastBets, setLastBets] = useState([]); // { betType, amount }[] for rebet
  const [autobet, setAutobet] = useState(false);
  const [eraseMode, setEraseMode] = useState(false);

  useCasinoBalance(socket, setUser);
  const { skin } = useChipSkin();

  const prevPhaseRef = useRef(null);
  const prevRoundIdRef = useRef(null);
  const myBetsSnapshotRef = useRef([]); // snapshot of bets from last betting round
  const autobetRef = useRef(false);
  autobetRef.current = autobet;

  // Listen for server state broadcasts
  useEffect(() => {
    if (!socket) return;

    const handleState = (state) => {
      setRoomState(prev => {
        const prevPhase = prev?.currentPhase;
        const nextPhase = state.currentPhase;

        // When settlement arrives: record result in history + snapshot bets for rebet
        if (prevPhase === 'spin' && nextPhase === 'settlement') {
          const myResult = state.lastSettlement?.find(
            s => String(s.playerId) === String(user?.id)
          );
          if (myResult && state.spinResult) {
            const uid = String(user?.id ?? '');
            const myPayouts = uid
              ? (state.lastPayouts?.[uid] || state.lastPayouts?.[Number(uid)] || [])
              : [];
            const wonBets = myPayouts.filter(b => b.status === 'won').map(b => b.type);
            const entry = {
              roundId: state.roundId,
              number: state.spinResult.number,
              color: state.spinResult.color,
              change: myResult.displayChange,
              wonBets,
            };
            setRoundHistory(h => [entry, ...h].slice(0, 5));
          }
        }

        // Snapshot bets when betting closes (betting_closed has 0ms duration so client may
        // never see it — also catch betting_open → spin direct transition)
        if (prevPhase === 'betting_open' && (nextPhase === 'betting_closed' || nextPhase === 'spin')) {
          const uid = String(user?.id ?? '');
          const myBets = uid
            ? (prev?.currentRoundBets?.[uid] || prev?.currentRoundBets?.[Number(uid)] || [])
            : [];
          if (myBets.length > 0) {
            myBetsSnapshotRef.current = myBets.map(b => ({ betType: b.type, amount: b.amount }));
            setLastBets(myBetsSnapshotRef.current);
          }
        }

        // Autobet: when new betting phase opens, auto-place last round's bets
        if (prevPhase === 'waiting' && nextPhase === 'betting_open') {
          if (autobetRef.current && myBetsSnapshotRef.current.length > 0) {
            setTimeout(() => {
              myBetsSnapshotRef.current.forEach(({ betType, amount }) => {
                socket?.emit(EVENTS.ROULETTE_PLACE_BET, { betType, amount }, (ack) => {
                  if (!ack?.success) showToast(ack?.error || `Autobet failed: ${betType}`, 'error');
                });
              });
              // Auto-ready after placing bets
              socket?.emit(EVENTS.ROULETTE_READY, {});
            }, 500);
          }
        }

        return state;
      });

      setLoading(false);

      if (state.spinResult && state.currentPhase === 'spin') {
        setLastWheelSpin({ number: state.spinResult.number, triggerAt: Date.now() });
      }
    };

    socket.on(EVENTS.ROULETTE_STATE, handleState);
    socket.on(EVENTS.ROULETTE_ERROR, (err) => showToast(err, 'error'));

    return () => {
      socket.off(EVENTS.ROULETTE_STATE, handleState);
      socket.off(EVENTS.ROULETTE_ERROR);
    };
  }, [socket, showToast, user?.id]);

  // Fetch initial state
  useEffect(() => {
    fetchJson('/api/roulette/state')
      .then(setRoomState)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const emit = useSocketAction(socket, showToast);

  const isParticipant = roomState?.participants?.some(
    (p) => String(p.userId) === String(user?.id) && !p.left
  );

  const myUserId = String(user?.id ?? '');
  const myBets = (myUserId && roomState?.currentRoundBets
    ? (roomState.currentRoundBets[myUserId] || roomState.currentRoundBets[Number(myUserId)] || [])
    : []);

  const handleJoin = useCallback(async () => {
    if (!socket) return;
    setBusy(true);
    emit(EVENTS.ROULETTE_JOIN, { skin }, 'Failed to join')
      .finally(() => setBusy(false))
      .catch(() => {});
  }, [socket, emit, skin]);

  // Sync skin to server whenever it changes while participant
  useEffect(() => {
    if (!socket) return;
    socket.emit(EVENTS.ROULETTE_SET_SKIN, { skin });
  }, [socket, skin]);

  const handleLeave = useCallback(async () => {
    if (!socket) return;
    setBusy(true);
    emit(EVENTS.ROULETTE_LEAVE, {}, 'Failed to leave')
      .finally(() => setBusy(false))
      .catch(() => {});
  }, [socket, emit]);

  const handlePlaceBet = useCallback((betType) => {
    if (!socket || !isParticipant) return;
    if (roomState?.currentPhase !== 'betting_open') {
      showToast('Betting is closed', 'error');
      return;
    }
    emit(EVENTS.ROULETTE_PLACE_BET, { betType, amount: selectedChip }, 'Bet failed').catch(() => {});
  }, [socket, isParticipant, roomState?.currentPhase, selectedChip, showToast, emit]);

  const handleRebet = useCallback(() => {
    if (!socket || !isParticipant || roomState?.currentPhase !== 'betting_open') return;
    if (lastBets.length === 0) {
      showToast('No previous bets to repeat', 'error');
      return;
    }
    lastBets.forEach(({ betType, amount }) => {
      emit(EVENTS.ROULETTE_PLACE_BET, { betType, amount }, `Rebet failed: ${betType}`).catch(() => {});
    });
    showToast(`Rebet: ${lastBets.length} bet(s)`, 'success');
  }, [socket, isParticipant, roomState?.currentPhase, lastBets, showToast, emit]);

  const handleRemoveBet = useCallback((betType) => {
    if (!socket || !isParticipant || roomState?.currentPhase !== 'betting_open') return;
    emit(EVENTS.ROULETTE_REMOVE_BET, { betType }, 'Remove failed').catch(() => {});
  }, [socket, isParticipant, roomState?.currentPhase, emit]);

  const handleToggleAutobet = useCallback(() => {
    setAutobet(prev => {
      const next = !prev;
      if (next && roomState?.currentPhase === 'betting_open' && myBetsSnapshotRef.current.length > 0) {
        // Direct emit: fires inside setState callback where emit closure would be stale
        setTimeout(() => {
          myBetsSnapshotRef.current.forEach(({ betType, amount }) => {
            socket?.emit(EVENTS.ROULETTE_PLACE_BET, { betType, amount }, (ack) => {
              if (!ack?.success) showToast(ack?.error || `Autobet failed: ${betType}`, 'error');
            });
          });
        }, 0);
      }
      return next;
    });
  }, [roomState?.currentPhase, showToast, socket]);

  const handleReady = useCallback(() => {
    if (!socket || !isParticipant || roomState?.currentPhase !== 'betting_open') return;
    emit(EVENTS.ROULETTE_READY, {}, 'Ready failed').catch(() => {});
  }, [socket, isParticipant, roomState?.currentPhase, emit]);

  const isReady = roomState?.readyPlayers?.includes(String(user?.id));

  return {
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
  };
}
