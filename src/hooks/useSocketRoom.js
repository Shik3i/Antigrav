import { useEffect, useState } from 'react';
import EVENTS from '../../socketEvents.json';

export function useSocketRoom(socket, { activeRoomId, activeToken, user, enabled = true }) {
    const [roomState, setRoomState] = useState(null);
    const [roomError, setRoomError] = useState(null);
    const [roomTokens, setRoomTokens] = useState({ readToken: null, writeToken: null });

    useEffect(() => {
        if (!enabled || !socket || !activeRoomId || !user?.id) {
            return undefined;
        }

        const join = () => {
            setRoomError(null);
            socket.emit(EVENTS.JOIN_ROOM, {
                roomId: activeRoomId,
                userId: user.id,
                displayName: user.displayName,
                preferences: user.preferences,
                token: activeToken
            });
        };

        const handleConnect = () => join();
        const handleSync = (state) => {
            setRoomState(state);
            const myUser = state.users.find((entry) => entry.userId === user.id || entry.socketId === socket.id);
            if (myUser?.role === 'write' && socket.connected) {
                socket.emit(EVENTS.GET_INVITE_TOKENS, { roomId: state.id });
            }
        };
        const handleError = (message) => setRoomError(message);
        const handleTokens = (data) => setRoomTokens(data);

        if (socket.connected) {
            join();
        } else {
            socket.on(EVENTS.CONNECT, handleConnect);
        }

        socket.on(EVENTS.SYNC_STATE, handleSync);
        socket.on(EVENTS.ERROR, handleError);
        socket.on(EVENTS.INVITE_TOKENS, handleTokens);

        return () => {
            socket.off(EVENTS.CONNECT, handleConnect);
            socket.off(EVENTS.SYNC_STATE, handleSync);
            socket.off(EVENTS.ERROR, handleError);
            socket.off(EVENTS.INVITE_TOKENS, handleTokens);
        };
    }, [activeRoomId, activeToken, enabled, socket, user]);

    return {
        roomState,
        roomError,
        roomTokens
    };
}
