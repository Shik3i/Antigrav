export function getVisualSeat(seat, mySeat, maxPlayers) {
  if (!mySeat || !maxPlayers) return seat;
  return ((seat - mySeat + maxPlayers) % maxPlayers) + 1;
}

export function getTableStatusMeta(roomState, userId, turnCountdownSeconds, autoStartSeconds) {
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
