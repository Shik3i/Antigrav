const dbLayer = require('../database');
const db = require('../database/connection');
const EVENTS = require('../socketEvents.json');

exports.searchUsers = async (req, res) => {
    const { q } = req.query;
    const { userId } = req.user;

    if (!q || q.length < 2) {
        return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    try {
        const users = db.prepare(`
            SELECT id, displayName, username
            FROM Users
            WHERE (LOWER(displayName) LIKE LOWER(?) OR LOWER(username) LIKE LOWER(?))
            AND id != ?
            LIMIT 10
        `).all(`%${q}%`, `%${q}%`, userId);

        res.status(200).json(users);
    } catch (err) {
        console.error('Error in searchUsers:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getUserProfile = async (req, res) => {
    const { userId } = req.params;
    const { userId: currentUserId } = req.user;

    try {
        const user = db.prepare(`
            SELECT id, displayName, username, lastActive
            FROM Users
            WHERE id = ?
        `).get(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if user is blocked by current user
        const isBlocked = await dbLayer.isUserBlocked(currentUserId, userId);

        // Get friend status
        const friendStatus = await dbLayer.getFriendStatus(currentUserId, userId);

        res.status(200).json({
            ...user,
            isBlocked: !!isBlocked,
            friendStatus: friendStatus ? friendStatus.status : null,
            isRequester: friendStatus ? friendStatus.requesterId === currentUserId : null
        });
    } catch (err) {
        console.error('Error in getUserProfile:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.blockUser = async (req, res) => {
    const { userId } = req.user;
    const { blockedId } = req.body;

    if (!blockedId) {
        return res.status(400).json({ error: 'blockedId is required' });
    }

    try {
        // Remove any existing friendship
        await dbLayer.removeFriend(userId, blockedId);

        // Add block
        await dbLayer.blockUser(userId, blockedId);

        res.status(200).json({ message: 'User blocked successfully' });
    } catch (err) {
        console.error('Error in blockUser:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.unblockUser = async (req, res) => {
    const { userId } = req.user;
    const { blockedId } = req.body;

    if (!blockedId) {
        return res.status(400).json({ error: 'blockedId is required' });
    }

    try {
        await dbLayer.unblockUser(userId, blockedId);
        res.status(200).json({ message: 'User unblocked successfully' });
    } catch (err) {
        console.error('Error in unblockUser:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getBlockedUsers = async (req, res) => {
    const { userId } = req.user;

    try {
        const blockedUsers = await dbLayer.getBlockedUsers(userId);
        res.status(200).json(blockedUsers);
    } catch (err) {
        console.error('Error in getBlockedUsers:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.sendRequest = async (req, res) => {
    const { userId } = req.user;
    const { friendUsername } = req.body;

    if (!friendUsername) {
        return res.status(400).json({ error: 'friendUsername is required' });
    }

    try {
        const friend = await dbLayer.getUserByUsername(friendUsername);
        if (!friend) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (friend.id === userId) {
            return res.status(400).json({ error: 'Cannot add yourself' });
        }

        // Check if there is already a relationship
        const existingStatus = await dbLayer.getFriendStatus(userId, friend.id);

        if (existingStatus) {
            if (existingStatus.status === 'accepted') {
                return res.status(400).json({ error: 'Already friends' });
            }
            if (existingStatus.status === 'pending') {
                // If they already sent US a request, accept it automatically
                if (existingStatus.requesterId === friend.id) {
                    await dbLayer.addFriend(userId, friend.id, 'accepted');
                    return res.status(200).json({ message: 'Friend request accepted' });
                }
                return res.status(400).json({ error: 'Friend request already sent' });
            }
        }

        // Check for mutual pending request (they sent us a request, we're sending them one)
        const mutualRequest = await dbLayer.getMutualPendingRequest(userId, friend.id);
        if (mutualRequest) {
            // Accept their request and create our accepted friendship
            await dbLayer.addFriend(userId, friend.id, 'accepted');
            return res.status(200).json({ message: 'Friend request accepted (mutual)' });
        }

    await dbLayer.addFriend(userId, friend.id, 'pending');

    // Broadcast friend request to recipient
    const io = req.app.get('io');
    if (io) {
        io.to(friend.id).emit(EVENTS.FRIEND_REQUEST_RECEIVED, {
            fromUserId: userId,
            fromUsername: req.user.username,
            fromDisplayName: req.user.displayName
        });
    }

    res.status(200).json({ message: 'Friend request sent' });
    } catch (err) {
        console.error('Error in sendRequest:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.acceptRequest = async (req, res) => {
    const { userId } = req.user;
    const { friendId } = req.body;

    if (!friendId) {
        return res.status(400).json({ error: 'friendId is required' });
    }

    try {
    // Accept the friendship (only one entry needed)
    await dbLayer.addFriend(userId, friendId, 'accepted');

    // Broadcast acceptance to the original requester
    const io = req.app.get('io');
    if (io) {
        io.to(friendId).emit(EVENTS.FRIEND_REQUEST_ACCEPTED, {
            fromUserId: userId,
            fromUsername: req.user.username,
            fromDisplayName: req.user.displayName
        });
    }

    res.status(200).json({ message: 'Friend request accepted' });
    } catch (err) {
        console.error('Error in acceptRequest:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.removeFriend = async (req, res) => {
    const { userId } = req.user;
    const { friendId } = req.body;

    if (!friendId) {
        return res.status(400).json({ error: 'friendId is required' });
    }

    try {
    await dbLayer.removeFriend(userId, friendId);

    // Broadcast removal to both users
    const io = req.app.get('io');
    if (io) {
        io.to(friendId).emit(EVENTS.FRIEND_REMOVED, {
            fromUserId: userId,
            fromUsername: req.user.username,
            fromDisplayName: req.user.displayName
        });
        io.to(userId).emit(EVENTS.FRIEND_REMOVED, {
            fromUserId: friendId,
            fromUsername: 'Unknown', // We don't have the friend's username here
            fromDisplayName: 'Unknown'
        });
    }

    res.status(200).json({ message: 'Friend removed' });
    } catch (err) {
        console.error('Error in removeFriend:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getFriends = async (req, res) => {
    const { userId } = req.user;

    try {
        const friendsRaw = await dbLayer.getFriends(userId);

        // Map to a clean response
        const mapped = friendsRaw.map(f => {
            const isRequester = f.requesterId === userId;
            return {
                id: f.id,
                username: f.username,
                displayName: f.displayName,
                status: f.status,
                isRequester,
                direction: isRequester ? 'outgoing' : 'incoming'
            };
        });

        res.status(200).json(mapped);
    } catch (err) {
        console.error('Error in getFriends:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
