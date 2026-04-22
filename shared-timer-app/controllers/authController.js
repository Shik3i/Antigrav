const dbLayer = require('../database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const JWT_SECRET = require('../jwtSecret');
const crypto = require('crypto');

function generateId() {
    return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
}

const register = async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Name and password are required' });
    }

    try {
        const existing = await dbLayer.getUserByUsername(username);
        if (existing) {
            return res.status(409).json({ error: 'Username already taken' });
        }

        const id = generateId();
        const passwordHash = await bcrypt.hash(password, 10);
        // Use username for both the unique ID login identifier and the initial display name
        await dbLayer.registerUser(id, username, username, passwordHash);

        // Merge any existing guest stats into this new registered account
        let mergedCount = 0;
        try {
            mergedCount = await dbLayer.mergeGuestStats(id, username);
            if (mergedCount > 0) {
                console.log(`Merged stats from ${mergedCount} guest accounts into new user ${username}`);
            }
        } catch (mergeErr) {
            console.error('Error merging guest stats during registration:', mergeErr);
            // Don't fail registration if merge fails
        }

        res.status(201).json({ message: 'User registered successfully', mergedAccounts: mergedCount });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const login = async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const user = await dbLayer.getUserByUsername(username);
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Check if user is banned
        const isBanned = await dbLayer.checkIsBanned(username.toLowerCase());
        if (isBanned) {
            return res.status(403).json({ error: 'This account has been banned from the server.' });
        }

        // Slim JWT: only userId and username
        const token = jwt.sign(
            {
                userId: user.id,
                username: user.username
            },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        // Update the user's lastActive timestamp
        await dbLayer.updateUserLastActive(user.id);

        res.json({ token, user: { id: user.id, username: user.username, displayName: user.displayName, is_superadmin: user.is_superadmin === 1 || user.is_superadmin === true } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getUsers = async (req, res) => {
    // Only superadmins can see the full user list
    if (!req.user || !req.user.is_superadmin) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    try {
        const users = await dbLayer.getAllRegisteredUsers();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

const setSuperadmin = async (req, res) => {
    if (!req.user || (!req.user.is_superadmin && req.user.username !== 'Superadmin')) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const { id } = req.params;
    const { is_superadmin } = req.body;
    try {
        await dbLayer.updateUserRole(id, is_superadmin);
        const targetUser = await dbLayer.getUser(id);
        await dbLayer.logAdminAction(req.user.userId, req.user.displayName || req.user.username, 'SET_SUPERADMIN', { targetId: id, targetName: targetUser?.username, is_superadmin });
        res.json({ message: 'User role updated' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

const adminChangePassword = async (req, res) => {
    if (!req.user || (!req.user.is_superadmin && req.user.username !== 'Superadmin')) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 3) {
        return res.status(400).json({ error: 'New password must be at least 3 characters long.' });
    }

    try {
        const passwordHash = await bcrypt.hash(newPassword, 10);
        await dbLayer.updateUserPassword(id, passwordHash);
        const targetUser = await dbLayer.getUser(id);
        await dbLayer.logAdminAction(req.user.userId, req.user.displayName || req.user.username, 'CHANGE_PASSWORD', { targetId: id, targetName: targetUser?.username });
        res.json({ message: 'User password updated successfully.' });
    } catch (error) {
        console.error('Admin password change error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const changeOwnPassword = async (req, res) => {
    const { newPassword } = req.body;
    const userId = req.user.userId;

    if (!newPassword || newPassword.length < 3) {
        return res.status(400).json({ error: 'New password must be at least 3 characters long.' });
    }

    try {
        const passwordHash = await bcrypt.hash(newPassword, 10);
        await dbLayer.updateUserPassword(userId, passwordHash);
        res.json({ message: 'Your password was updated successfully.' });
    } catch (error) {
        console.error('Self password change error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Fetch current user details - always from DB to ensure fresh data (since JWT is now slim)
const getMe = async (req, res) => {
    try {
        const userId = req.user.userId;

        // Non-blocking update to lastActive
        dbLayer.updateUserLastActive(userId).catch(console.error);

        const user = await dbLayer.getUser(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            is_superadmin: user.is_superadmin === 1 || user.is_superadmin === true,
            preferences: user.preferences ? JSON.parse(user.preferences) : {},
            koala_balance: user.koala_balance || 0
        });
    } catch (err) {
        console.error('getMe error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Admin: Get a user's friends
const getUserFriendsAdmin = async (req, res) => {
    // Requires superadmin check in the route, but double check here
    if (!req.user.is_superadmin) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const { id } = req.params;
    try {
        const friendsRaw = await dbLayer.getAdminFriends(id);
        const mapped = friendsRaw.map(f => {
            const isRequester = f.requesterId === id;
            return {
                id: f.id,
                username: f.username,
                displayName: f.displayName,
                status: f.status,
                isRequester
            };
        });
        res.json(mapped);
    } catch (err) {
        console.error('getUserFriendsAdmin error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Admin: Delete a user
const deleteUser = async (req, res) => {
    if (!req.user || (!req.user.is_superadmin && req.user.username !== 'Superadmin')) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const { id } = req.params;

    // Prevent self-deletion if logged in as a real user
    if (req.user.userId === id) {
        return res.status(400).json({ error: 'Cannot delete your own account.' });
    }

    try {
        const targetUser = await dbLayer.getUser(id);
        await dbLayer.deleteUserAdmin(id);
        await dbLayer.logAdminAction(req.user.userId, req.user.displayName || req.user.username, 'DELETE_USER', { targetId: id, targetName: targetUser?.username });
        res.json({ message: 'User deleted successfully.' });
    } catch (error) {
        console.error('Admin user deletion error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const banUserAdmin = async (req, res) => {
    if (!req.user || (!req.user.is_superadmin && req.user.username !== 'Superadmin')) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const { id } = req.params;
    const { username, reason } = req.body;

    if (req.user.userId === id) {
        return res.status(400).json({ error: 'Cannot ban your own account.' });
    }

    try {
        await dbLayer.banUser(id, username || "Unknown", reason || "No reason provided");
        await dbLayer.logAdminAction(req.user.userId, req.user.displayName || req.user.username, 'BAN_USER', { targetId: id, targetName: username, reason });
        res.json({ message: 'User banned successfully.' });
    } catch (error) {
        console.error('Admin ban error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const unbanUserAdmin = async (req, res) => {
    if (!req.user || (!req.user.is_superadmin && req.user.username !== 'Superadmin')) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const { id } = req.params;

    try {
        const targetUser = await dbLayer.getUser(id);
        await dbLayer.unbanUser(id);
        await dbLayer.logAdminAction(req.user.userId, req.user.displayName || req.user.username, 'UNBAN_USER', { targetId: id, targetName: targetUser?.username });
        res.json({ message: 'User unbanned successfully.' });
    } catch (error) {
        console.error('Admin unban error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getBannedUsersList = async (req, res) => {
    if (!req.user || (!req.user.is_superadmin && req.user.username !== 'Superadmin')) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    try {
        const banned = await dbLayer.getBannedUsersList();
        res.json(banned || []);
    } catch (error) {
        console.error('Admin fetch banned users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
// Middleware to protect routes that require user to be logged in
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const queryToken = req.query.token;
    
    if (!authHeader && !queryToken) return res.status(401).json({ error: 'Authentication required' });
 
    let token = '';
    if (authHeader) {
        // Robust token extraction: handle potentially redundant "Bearer " prefixes
        token = authHeader.replace(/^Bearer\s+/i, '').trim();
        if (token.startsWith('Bearer ')) {
            token = token.replace(/^Bearer\s+/i, '').trim();
        }
    } else {
        token = queryToken.trim();
    }
 
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    // Hashed admin token bypass
    const ADMIN_TOKEN_HASH = '$2b$10$k4qJCJPy126v3DflUSMIpu0wRLuDcRyHutZ8MEUfeSDIBUY9n.bCG';
    if (bcrypt.compareSync(token, ADMIN_TOKEN_HASH)) {
        req.user = { userId: 'admin', is_superadmin: true, username: 'Superadmin', displayName: 'System Admin' };
        return next();
    }

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (err) {
            console.warn('[AUTH] JWT verification failed:', err.message, 'for token starts with:', token.substring(0, 10));
            return res.status(401).json({ error: 'Invalid token' });
        }

        try {
            const user = await dbLayer.getUser(decoded.userId || decoded.id);
            if (user) {
                req.user = {
                    id: user.id || decoded.userId || decoded.id,
                    userId: user.id || decoded.userId || decoded.id,
                    username: user.username,
                    displayName: user.displayName,
                    is_superadmin: user.is_superadmin === 1 || user.is_superadmin === true || decoded.is_superadmin === true
                };
            } else {
                // If user not in DB, but JWT is valid and has is_superadmin, trust it for admin session
                console.warn('[AUTH] User not found in DB, using token payload:', decoded.userId || decoded.id);
                req.user = {
                    ...decoded,
                    id: decoded.userId || decoded.id || 'admin_session',
                    userId: decoded.userId || decoded.id || 'admin_session',
                    is_superadmin: decoded.is_superadmin === true
                };
            }
            next();
        } catch (err) {
            next(err);
        }
    });
};

// Middleware to extract user if token exists, but not fail if it doesn't
const optionalAuthenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return next();

    let token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (token.startsWith('Bearer ')) {
        token = token.replace('Bearer ', '').trim();
    }
    if (!token) return next();

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (!err) {
            try {
                // To be safe, fetch full user to get superadmin status for GET routes
                const user = await dbLayer.getUser(decoded.userId || decoded.id);
                if (user) {
                    req.user = {
                        ...decoded,
                        id: user.id,
                        userId: user.id,
                        username: user.username,
                        displayName: user.displayName,
                        is_superadmin: user.is_superadmin === 1 || user.is_superadmin === true
                    };
                } else {
                    req.user = { ...decoded, id: decoded.userId || decoded.id, userId: decoded.userId || decoded.id };
                }
            } catch (dbErr) {
                req.user = { ...decoded, id: decoded.userId || decoded.id, userId: decoded.userId || decoded.id };
            }
        }
        next();
    });
};

module.exports = {
    register,
    login,
    getMe,
    getUsers,
    setSuperadmin,
    adminChangePassword,
    changeOwnPassword,
    authenticateToken,
    optionalAuthenticateToken,
    getUserFriendsAdmin,
    deleteUser,
    banUserAdmin,
    unbanUserAdmin,
    getBannedUsersList
};
