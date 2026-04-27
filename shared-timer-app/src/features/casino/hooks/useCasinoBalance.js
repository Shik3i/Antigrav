import { useCallback, useEffect } from 'react';
import EVENTS from '../../../../socketEvents.json';

export function useCasinoBalance(socket, setUser) {
  const syncBalance = useCallback((balance) => {
    if (!Number.isFinite(balance)) return;
    setUser((prev) => (prev ? { ...prev, koala_balance: balance } : prev));
  }, [setUser]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = ({ balance }) => syncBalance(balance);
    socket.on(EVENTS.COIN_BALANCE_UPDATE, handleUpdate);
    return () => socket.off(EVENTS.COIN_BALANCE_UPDATE, handleUpdate);
  }, [socket, syncBalance]);
}
