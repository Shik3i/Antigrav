// Room Manager to keep track of active timers in memory
// This ensures fast response times and perfect sync across clients

class RoomManager {
    constructor() {
        // rooms: { roomId: { config, state, users: Map } }
        this.rooms = new Map();
        this.pendingDisconnects = new Map();
    }

    // Create a new room in memory
    createRoom(roomId, name = 'Focus Session', defaultDurationMinutes = 20, isPublic = true, visibleToFriends = false, ownerId = null, defaultRole = 'read') {
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, {
                id: roomId,
                config: {
                    name: name,
                    durationMs: defaultDurationMinutes * 60 * 1000,
                    defaultDurationMinutes: defaultDurationMinutes,
                    isPublic: isPublic,
                    visibleToFriends: visibleToFriends,
                    ownerId: ownerId,
                    defaultRole: defaultRole
                },
                state: {
                    isRunning: false,
                    remainingMs: defaultDurationMinutes * 60 * 1000,
                    lastTickTime: null,
                    hasStarted: false,
                    // Pomodoro state
                    isPomodoro: false,
                    pomodoroPhase: 'work', // 'work' or 'break'
                    pomodoroCycles: 0,
                    // Auto-Restart
                    autoRestart: true,
                    // Workspace Features
                    todos: [], // { id, text, completed, author }
                    canvasLines: [], // array of lines drawn
                    eventHistory: [], // array of { type, message, timestamp, userId }
                    stats: {
                        totalCompletions: 0,
                        userCompletions: {} // userId -> Number
                    },
                    // Minigames
                    activeDeathroll: null
                },
                users: new Map(), // socketId -> { userId, displayName, role }
                timeoutId: null // Reference to clear room if empty after 5 mins
            });
        }
        return this.rooms.get(roomId);
    }

    updateRoomInfo(roomId, newName, defaultRole) {
        const room = this.getRoom(roomId);
        if (room) {
            if (newName) room.config.name = newName;
            if (defaultRole) room.config.defaultRole = defaultRole;
            return true;
        }
        return false;
    }

    // Workspace Methods
    addTodo(roomId, todo) {
        const room = this.getRoom(roomId);
        if (room) {
            room.state.todos.push(todo);
            return true;
        }
        return false;
    }

    toggleTodo(roomId, todoId) {
        const room = this.getRoom(roomId);
        if (room) {
            const todo = room.state.todos.find(t => t.id === todoId);
            if (todo) {
                todo.completed = !todo.completed;
                return true;
            }
        }
        return false;
    }

    deleteTodo(roomId, todoId) {
        const room = this.getRoom(roomId);
        if (room) {
            room.state.todos = room.state.todos.filter(t => t.id !== todoId);
            return true;
        }
        return false;
    }

    drawCanvasLine(roomId, line) {
        const room = this.getRoom(roomId);
        if (room) {
            room.state.canvasLines.push(line);
            return true;
        }
        return false;
    }

    clearCanvas(roomId) {
        const room = this.getRoom(roomId);
        if (room) {
            room.state.canvasLines = [];
            return true;
        }
        return false;
    }

    // Minigames 
    startDeathroll(roomId, userName) {
        const room = this.getRoom(roomId);
        if (room) {
            const roll = Math.floor(Math.random() * 1000) + 1;
            room.state.activeDeathroll = {
                currentMax: roll,
                lastRoller: userName,
                history: [{ roller: userName, max: 1000, roll }],
                isComplete: roll === 1
            };
            if (roll === 1) {
                setTimeout(() => {
                    const r = this.getRoom(roomId);
                    if (r && r.state.activeDeathroll?.isComplete) r.state.activeDeathroll = null;
                }, 5000);
            }
            return room.state.activeDeathroll;
        }
        return null;
    }

    rollDeathroll(roomId, userName) {
        const room = this.getRoom(roomId);
        if (room && room.state.activeDeathroll && !room.state.activeDeathroll.isComplete) {
            const currentMax = room.state.activeDeathroll.currentMax;
            const roll = Math.floor(Math.random() * currentMax) + 1;
            room.state.activeDeathroll.currentMax = roll;
            room.state.activeDeathroll.lastRoller = userName;
            room.state.activeDeathroll.history.push({ roller: userName, max: currentMax, roll });
            room.state.activeDeathroll.isComplete = roll === 1;

            if (roll === 1) {
                setTimeout(() => {
                    const r = this.getRoom(roomId);
                    if (r && r.state.activeDeathroll?.isComplete) r.state.activeDeathroll = null;
                }, 5000);
            }
            return room.state.activeDeathroll;
        }
        return null;
    }

    clearDeathroll(roomId) {
        const room = this.getRoom(roomId);
        if (room) {
            room.state.activeDeathroll = null;
            return true;
        }
        return false;
    }

    // Event History
    addEvent(roomId, type, message, userId = null) {
        const room = this.getRoom(roomId);
        if (room) {
            const newEvent = { type, message, timestamp: Date.now(), userId };
            room.state.eventHistory.push(newEvent);

            // Keep history lean (max 50 items)
            if (room.state.eventHistory.length > 50) {
                room.state.eventHistory.shift();
            }
            return newEvent;
        }
        return null;
    }

    // Get an existing room
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }

    joinRoom(roomId, socketId, user) {
        const room = this.getRoom(roomId);
        if (room.timeoutId) {
            clearTimeout(room.timeoutId);
            room.timeoutId = null;
        }

        const existingDisconnectedEntry = Array.from(room.users.entries()).find(([, existingUser]) => {
            if (!existingUser?.disconnectedAt) return false;

            if (user.userId && existingUser.userId) {
                return String(existingUser.userId) === String(user.userId);
            }

            return existingUser.displayName === user.displayName;
        });

        if (existingDisconnectedEntry) {
            const [oldSocketId, existingUser] = existingDisconnectedEntry;
            this.cancelPendingDisconnect(oldSocketId);
            room.users.delete(oldSocketId);
            room.users.set(socketId, {
                ...existingUser,
                ...user,
                socketId,
                disconnectedAt: null,
                metrics: existingUser.metrics || { ping: 0, offset: 0 }
            });
            return { room, replacedSocketId: oldSocketId, resumedSession: true };
        }

        room.users.set(socketId, { ...user, socketId, disconnectedAt: null, metrics: { ping: 0, offset: 0 } });
        return { room, replacedSocketId: null, resumedSession: false };
    }

    scheduleDisconnect(socketId, graceMs = 60000) {
        for (const [roomId, room] of this.rooms.entries()) {
            if (!room.users.has(socketId)) continue;

            const user = room.users.get(socketId);
            if (!user) return null;

            this.cancelPendingDisconnect(socketId);
            user.disconnectedAt = Date.now();

            const timeoutId = setTimeout(() => {
                this.pendingDisconnects.delete(socketId);
                this.leaveRoom(socketId);
            }, graceMs);

            this.pendingDisconnects.set(socketId, { roomId, timeoutId });
            return { roomId, user };
        }
        return null;
    }

    cancelPendingDisconnect(socketId) {
        const pending = this.pendingDisconnects.get(socketId);
        if (pending?.timeoutId) {
            clearTimeout(pending.timeoutId);
        }
        this.pendingDisconnects.delete(socketId);
    }

    finalizePendingDisconnect(socketId) {
        const pending = this.pendingDisconnects.get(socketId);
        if (!pending) return null;
        this.cancelPendingDisconnect(socketId);
        return this.leaveRoom(socketId);
    }

    promoteUser(roomId, targetSocketId) {
        const room = this.getRoom(roomId);
        if (!room) return false;

        console.log(`[DEBUG] promoteUser called for target: ${targetSocketId}`);
        console.log(`[DEBUG] Current users in room:`, Array.from(room.users.keys()));

        const targetUser = room.users.get(targetSocketId);
        if (targetUser && targetUser.role !== 'write') {
            targetUser.role = 'write';
            return true;
        }
        return false;
    }

    leaveRoom(socketId) {
        this.cancelPendingDisconnect(socketId);
        for (const [roomId, room] of this.rooms.entries()) {
            if (room.users.has(socketId)) {
                room.users.delete(socketId);
                // Start a 5-minute timeout to delete room if it remains empty
                if (room.users.size === 0) {
                    room.timeoutId = setTimeout(() => {
                        const r = this.getRoom(roomId);
                        if (r && r.users.size === 0) {
                            r.state.isRunning = false; // stop ticking
                            this.rooms.delete(roomId);
                        }
                    }, 5 * 60 * 1000); // 5 minutes
                }
                return roomId;
            }
        }
        return null;
    }

    startTimer(roomId) {
        const room = this.getRoom(roomId);
        if (!room) return false;

        // If timer is finished (at 0, or tiny floating negative), automatically reset to full duration before starting
        if (room.state.remainingMs <= 50) {
            room.state.remainingMs = room.config.durationMs;
        }

        if (!room.state.isRunning && room.state.remainingMs > 0) {
            room.state.isRunning = true;
            room.state.hasStarted = true;
            room.state.lastTickTime = Date.now();
            return true;
        }
        return false;
    }

    pauseTimer(roomId) {
        const room = this.getRoom(roomId);
        if (room.state.isRunning) {
            this._updateRemaining(room);
            room.state.isRunning = false;
            room.state.lastTickTime = null;
            return true;
        }
        return false;
    }

    resetTimer(roomId) {
        const room = this.getRoom(roomId);
        room.state.isRunning = false;
        room.state.remainingMs = room.config.durationMs;
        room.state.lastTickTime = null;
        room.state.hasStarted = false;
        return true;
    }

    setDuration(roomId, minutes) {
        const room = this.getRoom(roomId);
        room.config.durationMs = Math.round(minutes * 60 * 1000); // Ensures no floating point ms issues
        // If the timer is not actively running, resetting the duration ALWAYS resets the remaining time
        if (!room.state.isRunning) {
            room.state.remainingMs = room.config.durationMs;
        }
        return true;
    }

    _updateRemaining(room) {
        if (room.state.isRunning && room.state.lastTickTime) {
            const now = Date.now();
            const elapsed = now - room.state.lastTickTime;
            room.state.remainingMs -= elapsed;
            room.state.lastTickTime = now;
            // We DO NOT set isRunning = false here. 
            // tick() must be the one to complete the timer so events fire properly.
        }
    }

    tick() {
        // Process all running rooms, return ones that just completed
        const completedRooms = [];
        const now = Date.now();

        for (const [roomId, room] of this.rooms.entries()) {
            if (room.state.isRunning) {
                const elapsed = now - room.state.lastTickTime;
                room.state.remainingMs -= elapsed;
                room.state.lastTickTime = now;

                if (room.state.remainingMs <= 0) {
                    room.state.remainingMs = 0;
                    room.state.isRunning = false;

                    // Track completions
                    if (!room.state.stats) room.state.stats = { totalCompletions: 0, userCompletions: {} };
                    room.state.stats.totalCompletions++;
                    for (const user of room.users.values()) {
                        const uid = user.userId || user.id;
                        if (uid) {
                            room.state.stats.userCompletions[uid] = (room.state.stats.userCompletions[uid] || 0) + 1;
                        }
                    }

                    completedRooms.push(room);
                }
            }
        }
        return completedRooms;
    }

    getRoomState(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return null;
        // Always calculate precise remaining right before returning
        if (room.state.isRunning) {
            this._updateRemaining(room);
        }

        // Return a safe copy of the state
        const safeState = { ...room.state };
        if (safeState.remainingMs < 0) safeState.remainingMs = 0;

        return {
            id: room.id,
            config: { ...room.config },
            state: safeState,
            users: Array.from(room.users.values()).filter(user => !user.disconnectedAt)
        };
    }

    togglePomodoro(roomId, enabled, pauseMinutes, workName, breakName) {
        const room = this.getRoom(roomId);
        if (room) {
            room.state.isPomodoro = enabled;
            if (enabled) {
                if (!room.config.pomodoro) room.config.pomodoro = {};
                if (pauseMinutes !== undefined && pauseMinutes !== null) {
                    room.config.pomodoro.pauseMinutes = parseFloat(pauseMinutes) || 5;
                }
                if (workName !== undefined) room.config.pomodoro.workName = workName;
                if (breakName !== undefined) room.config.pomodoro.breakName = breakName;
            }
            return true;
        }
        return false;
    }

    advancePomodoro(roomId) {
        const room = this.getRoom(roomId);
        if (!room || !room.state.isPomodoro) return null;

        // Toggle phase
        room.state.pomodoroPhase = room.state.pomodoroPhase === 'work' ? 'break' : 'work';
        
        if (room.state.pomodoroPhase === 'work') {
            room.state.pomodoroCycles++;
            room.state.remainingMs = room.config.durationMs; // Use default work duration
        } else {
            const pauseMinutes = room.config.pomodoro?.pauseMinutes || 5;
            room.state.remainingMs = pauseMinutes * 60 * 1000;
        }

        this.startTimer(roomId);
        return room.state.pomodoroPhase;
    }

    toggleAutoRestart(roomId, enabled) {
        const room = this.getRoom(roomId);
        if (room) {
            room.state.autoRestart = enabled;
            return true;
        }
        return false;
    }



    updateMetrics(socketId, ping, offset) {
        for (const room of this.rooms.values()) {
            if (room.users.has(socketId)) {
                const user = room.users.get(socketId);
                user.metrics = { ping, offset };
                return room.id; // Return roomId so we can broadcast
            }
        }
        return null;
    }

    getUserBySocket(socketId) {
        for (const room of this.rooms.values()) {
            if (room.users.has(socketId)) {
                return room.users.get(socketId);
            }
        }
        return null;
    }
}

// Export singleton instance
const instance = new RoomManager();
module.exports = instance;
