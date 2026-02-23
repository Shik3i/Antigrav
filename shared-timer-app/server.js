const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken'); // used for secure invite links
const path = require('path');

const dbLayer = require('./database');
const roomManager = require('./roomManager');
const EVENTS = require('./socketEvents');
const sanitize = require('./sanitize');

const app = express();
app.use(cors());
app.use(express.json());

const rateLimit = require('express-rate-limit');

// DDoS Protection: Limit requests from same IP
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiter to all /api routes
app.use('/api', apiLimiter);

// Serve static compiled frontend files
app.use(express.static(path.join(__dirname, 'dist')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all for home server
        methods: ["GET", "POST"]
    }
});

const JWT_SECRET = process.env.JWT_SECRET || 'timer-app-super-secret';

// REST API Routes

// 1. Get Highscores
app.get('/api/highscores', async (req, res) => {
    try {
        const scores = await dbLayer.getHighscores(20);
        res.json(scores);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// 2. Register/Update User
app.post('/api/users', async (req, res) => {
    const { id, displayName } = req.body;
    const safeName = sanitize(displayName);
    try {
        const existing = await dbLayer.getUser(id);
        if (!existing) {
            await dbLayer.addUser(id, safeName);
        } else if (existing.displayName !== safeName) {
            await dbLayer.updateUserName(id, safeName);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// 2. Rooms - GET List of public rooms
app.get('/api/rooms', (req, res) => {
    dbLayer.db.all('SELECT * FROM Rooms WHERE isPublic = 1', (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        const activePublicRooms = rows.map(r => {
            const state = roomManager.getRoomState(r.id);
            return {
                id: r.id,
                name: r.name,
                isPublic: r.isPublic,
                defaultDurationMinutes: r.defaultDurationMinutes,
                activeUsers: state ? state.users.length : 0,
                isRunning: state ? state.state.isRunning : false
            };
        }).filter(r => r.activeUsers > 0);

        res.json(activePublicRooms);
    });
});

// 3. Create or Get Room (returns invite links as well)
app.post('/api/rooms', async (req, res) => {
    const { id, name, isPublic, defaultDurationMinutes, ownerId, defaultRole } = req.body;
    try {
        await dbLayer.addRoom(id, sanitize(name), isPublic, defaultDurationMinutes, ownerId, defaultRole);

        // Generate invite tokens
        const readToken = jwt.sign({ roomId: id, role: 'read' }, JWT_SECRET);
        const writeToken = jwt.sign({ roomId: id, role: 'write' }, JWT_SECRET);

        res.json({ success: true, readToken, writeToken });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// 4. Debug/Test APIs
app.get('/api/test/rooms', (req, res) => {
    // Returns full detailed state of all rooms in memory
    const roomsList = [];
    roomManager.rooms.forEach((room, roomId) => {
        roomsList.push(roomManager.getRoomState(roomId));
    });
    res.json(roomsList);
});

app.post('/api/test/rooms/:id/action', async (req, res) => {
    // Allows sending an action directly to a room without a socket
    const { id } = req.params;
    const { action, payload } = req.body;

    try {
        const dbRoom = await dbLayer.getRoom(id);
        if (!dbRoom) {
            return res.status(404).json({ success: false, error: 'Room not found in database' });
        }

        let room = roomManager.getRoom(id);
        if (!room) {
            room = roomManager.createRoom(id, dbRoom.name, dbRoom.defaultDurationMinutes);
        }

        let changed = false;
        switch (action) {
            case 'START':
                changed = roomManager.startTimer(id);
                break;
            case 'PAUSE':
                changed = roomManager.pauseTimer(id);
                break;
            case 'RESET':
                changed = roomManager.resetTimer(id);
                break;
            case 'SET_DURATION':
                changed = roomManager.setDuration(id, payload);
                break;
        }

        if (changed) {
            io.to(id).emit(EVENTS.SYNC_STATE, roomManager.getRoomState(id));
        }

        res.json({ success: true, changed, state: roomManager.getRoomState(id) });
    } catch (err) {
        console.error('API action error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});


// WebSocket Events
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Send initial list of active rooms to this user only
    broadcastActiveRooms(socket);

    socket.on(EVENTS.JOIN_ROOM, async ({ roomId, userId, displayName, token }) => {
        try {
            // 1. Check if room exists in DB
            const dbRoom = await dbLayer.getRoom(roomId);
            if (!dbRoom) {
                socket.emit(EVENTS.ERROR, 'Room not found. Please check the URL or create a new room.');
                return;
            }

            // 2. Determine role based on token
            let role = 'read';

            if (token) {
                try {
                    const decoded = jwt.verify(token, JWT_SECRET);
                    if (decoded.roomId === roomId) {
                        role = decoded.role;
                    }
                } catch (err) {
                    // Invalid token - if it's a private room, this is a hard failure
                    if (!dbRoom.isPublic) {
                        socket.emit(EVENTS.ERROR, 'Invalid or expired invite link for this private room.');
                        return;
                    }
                }
            } else if (!dbRoom.isPublic) {
                // No token provided for a private room
                socket.emit(EVENTS.ERROR, 'Access denied. You need an invite link to join this private room.');
                return;
            } else {
                // Public room with no token - use the room's default role (default 'read')
                role = dbRoom.defaultRole || 'read';
            }

            // 3. Ensure room exists in memory
            let room = roomManager.getRoom(roomId);
            if (!room) {
                room = roomManager.createRoom(roomId, dbRoom.name, dbRoom.defaultDurationMinutes);
            }

            // 4. Join the room
            const user = { userId, displayName: sanitize(displayName), role };
            roomManager.joinRoom(roomId, socket.id, user);
            socket.join(roomId);

            // Initial sync
            socket.emit(EVENTS.SYNC_STATE, roomManager.getRoomState(roomId));
            io.to(roomId).emit(EVENTS.USER_JOINED, user);

            // Update room list for all
            broadcastActiveRooms();
        } catch (err) {
            console.error('Error joining room:', err);
            socket.emit(EVENTS.ERROR, 'An internal server error occurred while joining the room.');
        }
    });

    socket.on(EVENTS.TIMER_ACTION, ({ roomId, action, payload }) => {
        // Check permission
        const user = roomManager.getUserBySocket(socket.id);
        if (!user || user.role !== 'write') {
            socket.emit(EVENTS.ERROR, 'You do not have permission to control the timer.');
            return;
        }

        let changed = false;
        switch (action) {
            case 'START':
                changed = roomManager.startTimer(roomId);
                break;
            case 'PAUSE':
                changed = roomManager.pauseTimer(roomId);
                break;
            case 'RESET':
                changed = roomManager.resetTimer(roomId);
                break;
            case 'SET_DURATION':
                changed = roomManager.setDuration(roomId, payload); // payload is minutes
                break;
        }

        if (changed) {
            io.to(roomId).emit(EVENTS.SYNC_STATE, roomManager.getRoomState(roomId));
        }
    });

    socket.on(EVENTS.GET_INVITE_TOKENS, ({ roomId }) => {
        const user = roomManager.getUserBySocket(socket.id);
        if (user && user.role === 'write') {
            const readToken = jwt.sign({ roomId, role: 'read' }, JWT_SECRET);
            const writeToken = jwt.sign({ roomId, role: 'write' }, JWT_SECRET);
            socket.emit(EVENTS.INVITE_TOKENS, { readToken, writeToken });
        }
    });

    socket.on(EVENTS.SET_POMODORO, ({ roomId, enabled, workMinutes, breakMinutes }) => {
        const user = roomManager.getUserBySocket(socket.id);
        if (user && user.role === 'write') {
            const room = roomManager.getRoom(roomId);
            if (room) {
                if (workMinutes && breakMinutes) {
                    room.config.pomodoro = { workMinutes, breakMinutes };
                }
                roomManager.togglePomodoro(roomId, enabled);
                io.to(roomId).emit(EVENTS.SYNC_STATE, roomManager.getRoomState(roomId));
            }
        }
    });

    socket.on(EVENTS.SEND_REACTION, ({ roomId, emoji }) => {
        io.to(roomId).emit(EVENTS.REACTION, { emoji, userId: socket.id, timestamp: Date.now() });
    });

    socket.on(EVENTS.LEAVE_ROOM, () => {
        const roomId = roomManager.leaveRoom(socket.id);
        if (roomId) {
            socket.leave(roomId);
            io.to(roomId).emit(EVENTS.USER_LEFT, socket.id);
            broadcastActiveRooms();
        }
    });

    socket.on(EVENTS.DISCONNECT, () => {
        const roomId = roomManager.leaveRoom(socket.id);
        if (roomId) {
            io.to(roomId).emit(EVENTS.USER_LEFT, socket.id);

            // Update room list for all
            broadcastActiveRooms();
        }
        console.log(`User disconnected: ${socket.id}`);
    });
});

function broadcastActiveRooms(targetSocket = null) {
    // Only broadcast rooms that are public
    dbLayer.db.all('SELECT * FROM Rooms WHERE isPublic = 1', (err, rows) => {
        if (!err && rows) {
            const activePublicRooms = rows.map(r => {
                const state = roomManager.getRoomState(r.id);
                return {
                    id: r.id,
                    name: r.name,
                    isPublic: r.isPublic,
                    defaultDurationMinutes: r.defaultDurationMinutes,
                    activeUsers: state ? state.users.length : 0,
                    isRunning: state ? state.state.isRunning : false
                };
            }).filter(r => r.activeUsers > 0); // Only show rooms with at least one person

            if (targetSocket) {
                targetSocket.emit(EVENTS.ACTIVE_ROOMS, activePublicRooms);
            } else {
                io.emit(EVENTS.ACTIVE_ROOMS, activePublicRooms);
            }
        }
    });
}

// Timer Tick Interval (10Hz) for precise calculation sync
setInterval(() => {
    const completedRooms = roomManager.tick();

    // Emit timer_completed event
    completedRooms.forEach(room => {
        io.to(room.id).emit(EVENTS.TIMER_COMPLETED, { roomId: room.id, timestamp: Date.now() });
        io.to(room.id).emit(EVENTS.SYNC_STATE, roomManager.getRoomState(room.id));

        // Record completion in DB for every user present
        room.users.forEach(user => {
            dbLayer.recordTimerCompletion(user.userId, room.id).catch(console.error);
        });

        // Pomodoro auto-advance
        if (room.state.isPomodoro) {
            setTimeout(() => {
                const nextPhase = roomManager.advancePomodoro(room.id);
                if (nextPhase) {
                    io.to(room.id).emit(EVENTS.SYNC_STATE, roomManager.getRoomState(room.id));
                }
            }, 3000); // 3 second delay for a nice breather
        }
    });

    // To keep clients synced exactly without drift, broadcast state every second
    roomManager.rooms.forEach((room, roomId) => {
        if (room.state.isRunning) {
            io.to(roomId).emit(EVENTS.SYNC_STATE, roomManager.getRoomState(roomId));
        }
    });
}, 1000); // 1Hz sync is enough since clients will animate the visual themselves

// Create a default public room on startup
dbLayer.addRoom('default', 'General Timer', 1, 20, 'System');

// Catch-all route to serve the React app for any other URL (client-side routing)
app.get('*catchall', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
