import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import EVENTS from '../socketEvents';

export function useSocketRoom(activeRoomId, activeToken, user) {
    const [globalSocket, setGlobalSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [roomState, setRoomState] = useState(null);
    const [roomError, setRoomError] = useState(null);
    const [roomTokens, setRoomTokens] = useState({ readToken: null, writeToken: null });

    useEffect(() => {
        const newSocket = io('/', { autoConnect: true });
        setGlobalSocket(newSocket);
        newSocket.on(EVENTS.CONNECT, () => {
            console.log('[useSocketRoom] globalSocket connected! ID:', newSocket.id);
            setIsConnected(true);
        });
        newSocket.on(EVENTS.DISCONNECT, () => setIsConnected(false));
        return () => newSocket.disconnect();
    }, []);

    useEffect(() => {
        if (!activeRoomId || !user || !globalSocket) return;

        const join = () => {
            console.log('[useSocketRoom] Joining room:', activeRoomId);
            setRoomError(null);
            globalSocket.emit(EVENTS.JOIN_ROOM, {
                roomId: activeRoomId,
                userId: user.id,
                displayName: user.displayName,
                token: activeToken
            });
        };

        const handleConnect = () => join();

        if (globalSocket.connected) {
            join();
        } else {
            globalSocket.on(EVENTS.CONNECT, handleConnect);
        }

        const handleSync = (state) => {
            setRoomState(state);
            const myUser = state.users.find(u => u.userId === user.id);
            if (myUser && myUser.role === 'write' && globalSocket) {
                globalSocket.emit(EVENTS.GET_INVITE_TOKENS, { roomId: state.id });
            }
        };
        const handleError = (msg) => setRoomError(msg);
        const handleTokens = (data) => setRoomTokens(data);

        globalSocket.on(EVENTS.SYNC_STATE, handleSync);
        globalSocket.on(EVENTS.ERROR, handleError);
        globalSocket.on(EVENTS.INVITE_TOKENS, handleTokens);

        return () => {
            globalSocket.off(EVENTS.CONNECT, handleConnect);
            globalSocket.off(EVENTS.SYNC_STATE, handleSync);
            globalSocket.off(EVENTS.ERROR, handleError);
            globalSocket.off(EVENTS.INVITE_TOKENS, handleTokens);
        };
    }, [activeRoomId, activeToken, user.id, user.displayName, globalSocket]);

    return { globalSocket, isConnected, roomState, roomError, roomTokens };
}
