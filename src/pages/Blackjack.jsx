import React, { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import BlackjackLeaderboard from '../features/blackjack/components/BlackjackLeaderboard';
import BlackjackLobby from '../features/blackjack/components/BlackjackLobby';
import BlackjackSettlement from '../features/blackjack/components/BlackjackSettlement';
import BlackjackTable from '../features/blackjack/components/BlackjackTable';
import '../features/blackjack/blackjack.css';
import { useBlackjackRoom } from '../features/blackjack/hooks/useBlackjackRoom';
import { useBlackjackTimers } from '../features/blackjack/hooks/useBlackjackTimers';
import { getTableStatusMeta, getVisualSeat } from '../features/blackjack/utils/tableViewModel';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Blackjack({ socket }) {
  const { user, isGuest, setUser } = useAuth();
  const { showToast } = useToast();
  const {
    actionBusy,
    autoJoinRoom,
    autoBetEnabled,
    availableRooms,
    config,
    error,
    handleAddBot,
    handleAutoBetToggle,
    handleBetSubmit,
    handleCreateRoom,
    handleLeaveTable,
    handleRemoveBot,
    handleSmartJoin,
    handleSideBetSubmit,
    handleSwitchRoom,
    handleTimerConfigUpdate,
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
    setCurrentRoomId,
    setLeaderboardSort,
    setPendingBet,
    setRoomDraft,
    setRoomState,
    setSelectedTable
  } = useBlackjackRoom({ socket, user, isGuest, setUser, showToast });

  const tableSeats = useMemo(() => {
    const maxPlayers = roomState?.maxPlayers || selectedTable;
    const playersBySeat = new Map((roomState?.players || []).map((player) => [player.seat, player]));
    const mySeatNum = mySeat?.seat || null;

    return Array.from({ length: maxPlayers }, (_, index) => {
      const seat = index + 1;
      const player = playersBySeat.get(seat);
      const visualSeat = getVisualSeat(seat, mySeatNum, maxPlayers);
      return player ? { ...player, visualSeat } : { seat, visualSeat };
    }).sort((left, right) => left.visualSeat - right.visualSeat);
  }, [mySeat?.seat, roomState?.maxPlayers, roomState?.players, selectedTable]);

  const { turnCountdownSeconds, autoStartSeconds } = useBlackjackTimers(roomState);
  const tableStatusMeta = useMemo(
    () => getTableStatusMeta(roomState, user?.id, turnCountdownSeconds, autoStartSeconds),
    [autoStartSeconds, roomState, turnCountdownSeconds, user?.id]
  );

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
      {roomState && (
        <BlackjackTable
          actionBusy={actionBusy}
          autoBetEnabled={autoBetEnabled}
          config={config}
          error={error}
          handleBetSubmit={handleBetSubmit}
          handleLeaveTable={handleLeaveTable}
          handleSmartJoin={handleSmartJoin}
          handleSideBetSubmit={handleSideBetSubmit}
          handleTimerConfigUpdate={handleTimerConfigUpdate}
          handleTurnAction={handleTurnAction}
          isGuest={isGuest}
          mySeat={mySeat}
          pendingBet={pendingBet}
          roomState={roomState}
          selectedTable={selectedTable}
          setAutoBetEnabled={handleAutoBetToggle}
          setPendingBet={setPendingBet}
          tableSeats={tableSeats}
          tableStatusMeta={tableStatusMeta}
          user={user}
        />
      )}

      <BlackjackLobby
        actionBusy={actionBusy}
        availableRooms={availableRooms}
        handleAddBot={handleAddBot}
        handleCreateRoom={handleCreateRoom}
        handleRemoveBot={handleRemoveBot}
        handleSwitchRoom={handleSwitchRoom}
        handleWatchRoom={handleWatchRoom}
        loadRooms={loadRooms}
        roomDraft={roomDraft}
        roomId={autoJoinRoom ? roomId : null}
        selectedTable={selectedTable}
        setCurrentRoomId={setCurrentRoomId}
        setRoomDraft={setRoomDraft}
        setRoomState={setRoomState}
        setSelectedTable={setSelectedTable}
      />

      <BlackjackSettlement recentSettlement={recentSettlement} settlementRows={recentSettlement?.results || []} />

      <BlackjackLeaderboard rows={leaderboard} sortBy={leaderboardSort} setSortBy={setLeaderboardSort} loading={leaderboardLoading} />
    </div>
  );
}
