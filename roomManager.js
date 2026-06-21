// Room Manager to keep track of active timers in memory
// This ensures fast response times and perfect sync across clients

const {
    createTimerState,
    applyTimerAction,
    tickTimer
} = require('./utils/timer/timerDomain');

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
                    ...createTimerState(defaultDurationMinutes * 60 * 1000),
                    // Pomodoro state
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
            room.state.activeDeathroll = {
                currentMax: 1000,
                lastRoller: null,
                history: [],
                isComplete: false
            };
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

    _applyTimerAction(roomId, action, now = Date.now()) {
        const room = this.getRoom(roomId);
        if (!room) return { ok: false, changed: false, error: 'ROOM_NOT_FOUND', completion: null };
        const result = applyTimerAction({ config: room.config, state: room.state }, action, now);
        if (!result.ok) return { ...result, changed: false };
        const changed = result.value.state.timerRevision !== room.state.timerRevision
            || result.value.state.completionSequence !== room.state.completionSequence;
        room.config = result.value.config;
        room.state = result.value.state;
        return { ...result, changed, room };
    }

    startTimer(roomId, now = Date.now()) {
        return this._applyTimerAction(roomId, { type: 'START' }, now).changed;
    }

    pauseTimer(roomId, now = Date.now()) {
        return this._applyTimerAction(roomId, { type: 'PAUSE' }, now).changed;
    }

    resetTimer(roomId, now = Date.now()) {
        return this._applyTimerAction(roomId, { type: 'RESET' }, now).changed;
    }

    setDuration(roomId, minutes, now = Date.now()) {
        return this._applyTimerAction(roomId, { type: 'SET_DURATION', payload: minutes }, now).changed;
    }

    setRemaining(roomId, remainingMs, now = Date.now()) {
        return this._applyTimerAction(roomId, { type: 'SET_REMAINING', payload: remainingMs }, now);
    }

    endEarly(roomId, now = Date.now()) {
        return this._applyTimerAction(roomId, { type: 'END_EARLY' }, now);
    }

    _updateRemaining(room, now = Date.now()) {
        if (!room) return null;
        const result = tickTimer({ config: room.config, state: room.state }, now);
        room.config = result.value.config;
        room.state = result.value.state;
        return result.completion;
    }

    tick(now = Date.now()) {
        // Process all running rooms, return ones that just completed
        const completedRooms = [];

        for (const room of this.rooms.values()) {
            if (room.state.isRunning) {
                const completion = this._updateRemaining(room, now);
                if (completion) completedRooms.push({ room, completion: { ...completion, roomId: room.id } });
            }
        }
        return completedRooms;
    }

    getRoomState(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return null;
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

    togglePomodoro(roomId, enabled, pauseMinutes, workName, breakName, now = Date.now()) {
        const room = this.getRoom(roomId);
        if (!room) return false;
        const parsedPause = pauseMinutes === undefined || pauseMinutes === null
            ? undefined
            : Number.parseFloat(pauseMinutes);
        const result = this._applyTimerAction(roomId, {
            type: 'SET_POMODORO',
            payload: { enabled, pauseMinutes: parsedPause }
        }, now);
        if (!result.ok) return false;
        if (enabled) {
            room.config.pomodoro = room.config.pomodoro || {};
            if (workName !== undefined) room.config.pomodoro.workName = workName;
            if (breakName !== undefined) room.config.pomodoro.breakName = breakName;
        }
        return result.changed;
    }

    advancePomodoro(roomId, now = Date.now()) {
        const result = this._applyTimerAction(roomId, { type: 'ADVANCE_POMODORO' }, now);
        return result.ok && result.changed ? result.room.state.pomodoroPhase : null;
    }

    toggleAutoRestart(roomId, enabled, now = Date.now()) {
        return this._applyTimerAction(roomId, { type: 'TOGGLE_AUTO_RESTART', payload: enabled }, now).changed;
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
