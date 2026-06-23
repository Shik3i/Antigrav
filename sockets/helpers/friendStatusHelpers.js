const dbLayer = require('../../database');
const EVENTS = require('../../socketEvents.json');

/**
 * Helper to broadcast a user's status to their mutual friends
 */
async function broadcastFriendStatus(io, userId, isOnline) {
    try {
        const friends = await dbLayer.getFriends(userId);
        const acceptedFriends = friends.filter(f => f.status === 'accepted').map(f => f.id);

        acceptedFriends.forEach(friendId => {
            const friendSockets = onlineUsers.get(friendId);
            if (friendSockets) {
                friendSockets.forEach(socketId => {
                    io.to(socketId).emit(EVENTS.FRIENDS_STATUS, { userId, isOnline });
                });
            }
        });
    } catch (err) {
        console.error('Failed to broadcast friend status:', err);
    }
}

/**
 * Helper to broadcast live coin balance updates to all sockets of a user
 */
function broadcastCoinUpdate(io, userId, newBalanceCents) {
    const userSockets = onlineUsers.get(userId);
    if (userSockets) {
        userSockets.forEach(socketId => {
            io.to(socketId).emit(EVENTS.COIN_BALANCE_UPDATE, { balance: newBalanceCents });
        });
    }
}

module.exports = {
    broadcastFriendStatus,
    broadcastCoinUpdate
};