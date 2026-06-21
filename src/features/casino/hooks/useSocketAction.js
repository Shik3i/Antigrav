import { useCallback } from 'react';

/**
 * Returns emit(event, payload, fallbackError) → Promise<ack>.
 * On ACK failure: calls showToast with server error or fallbackError, rejects.
 */
export function useSocketAction(socket, showToast) {
  return useCallback((event, payload = {}, fallbackError = 'Action failed') => {
    return new Promise((resolve, reject) => {
      if (!socket) {
        showToast('Keine Verbindung', 'error');
        return reject(new Error('No socket'));
      }
      socket.emit(event, payload, (ack) => {
        if (!ack?.success) {
          showToast(ack?.error || fallbackError, 'error');
          return reject(new Error(ack?.error || fallbackError));
        }
        resolve(ack);
      });
    });
  }, [socket, showToast]);
}
