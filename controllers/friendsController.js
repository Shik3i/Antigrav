const dbLayer = require('../database');

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

        await dbLayer.addFriend(userId, friend.id, 'pending');
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
        await dbLayer.addFriend(userId, friendId, 'accepted');
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
                isRequester
            };
        });

        res.status(200).json(mapped);
    } catch (err) {
        console.error('Error in getFriends:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
