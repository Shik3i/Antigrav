const jwt = require('jsonwebtoken');
const JWT_SECRET = require('../../jwtSecret');

/**
 * Middleware to extract and verify user token
 */
function authMiddleware() {
    return (socket, next) => {
        const token = socket.handshake.auth?.token;
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                if (decoded.userId) { // distinguish from invite tokens
                    socket.user = decoded;
                }
            } catch (err) {
                // fallback to guest if token invalid
            }
        }
        next();
    };
}

module.exports = authMiddleware;