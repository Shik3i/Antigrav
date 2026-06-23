const roomController = require('../../controllers/roomController');
const EVENTS = require('../../socketEvents.json');

function setupTimerTickHandler(io, roomManager, blackjackRoomManager, timerLifecycleService) {
    // Timer Tick Interval (1Hz) for precise calculation sync
    setInterval(() => {
        const completedRooms = roomManager.tick();
        const blackjackChangedRooms = blackjackRoomManager.tick();

        completedRooms.forEach(({ room, completion }) => {
            timerLifecycleService.handleCompletion(room, completion).catch(error => {
                console.error('Timer completion failed:', error);
            });
        });

        // To keep clients synced exactly without drift, broadcast state every second
        roomManager.rooms.forEach((room, roomId) => {
            if (room.state.isRunning) {
                io.volatile.to(roomId).emit(EVENTS.SYNC_STATE, roomManager.getRoomState(roomId));
            }
        });

        blackjackChangedRooms.forEach(async (roomId) => {
            try {
                const room = blackjackRoomManager.getRoom(roomId);
                if (room?.pendingRoundStartByUserId) {
                    await startBlackjackRoundWithBuyIn(roomId, room.pendingRoundStartByUserId);
                }
                await persistBlackjackSettlementIfNeeded(roomId);
                emitBlackjackState(io, roomId);
            } catch (err) {
                console.error('Blackjack tick failed:', err);
            }
        });
        if (blackjackChangedRooms.length > 0) {
            emitBlackjackRooms(io);
        }
        // Roulette phase sync
        try {
            emitRouletteState(io);
        } catch (err) {
            console.error('[roulette] state broadcast error:', err);
        }
    }, 1000); // 1Hz sync is enough since clients will animate the visual themselves
}

function emitRouletteState(io) {
    const state = roomController.rouletteGetRoom();
    io.emit(EVENTS.ROULETTE_STATE, state);
}

module.exports = {
    setupTimerTickHandler,
    emitRouletteState
};