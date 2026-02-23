// Room Manager to keep track of active timers in memory
// This ensures fast response times and perfect sync across clients

class RoomManager {
    constructor() {
        // rooms: { roomId: { config, state, users: Map } }
        this.rooms = new Map();
    }

    // Create a new room in memory (called after DB validation)
    createRoom(roomId, name = 'Focus Session', defaultDurationMinutes = 20) {
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, {
                id: roomId,
                config: {
                    name: name,
                    durationMs: defaultDurationMinutes * 60 * 1000,
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
                },
                users: new Map(), // socketId -> { userId, displayName, role }
            });
        }
        return this.rooms.get(roomId);
    }

    // Get an existing room
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }

    joinRoom(roomId, socketId, user) {
        const room = this.getRoom(roomId);
        room.users.set(socketId, user);
        return room;
    }

    leaveRoom(socketId) {
        for (const [roomId, room] of this.rooms.entries()) {
            if (room.users.has(socketId)) {
                room.users.delete(socketId);
                // Optional: delete room if empty and not running
                if (room.users.size === 0 && !room.state.isRunning) {
                    this.rooms.delete(roomId);
                }
                return roomId;
            }
        }
        return null;
    }

    startTimer(roomId) {
        const room = this.getRoom(roomId);
        if (!room) return false;

        // If timer is finished (at 0), automatically reset to full duration before starting
        if (room.state.remainingMs <= 0) {
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
        room.config.durationMs = minutes * 60 * 1000;
        // If not started yet, adjust current remaining time
        if (!room.state.hasStarted || (!room.state.isRunning && room.state.remainingMs === room.config.durationMs)) {
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
            if (room.state.remainingMs <= 0) {
                room.state.remainingMs = 0;
                room.state.isRunning = false;
            }
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
        return {
            id: room.id,
            config: { ...room.config },
            state: { ...room.state },
            users: Array.from(room.users.values())
        };
    }

    togglePomodoro(roomId, enabled) {
        const room = this.getRoom(roomId);
        if (room) {
            room.state.isPomodoro = enabled;
            if (enabled) {
                room.state.pomodoroPhase = 'work';
                // Reset to 25/5 defaults when enabling if not already set
                if (!room.config.pomodoro) {
                    room.config.pomodoro = { workMinutes: 25, breakMinutes: 5 };
                }
                // Also set current duration to work minutes
                room.config.durationMs = room.config.pomodoro.workMinutes * 60 * 1000;
                room.state.remainingMs = room.config.durationMs;
            }
            return true;
        }
        return false;
    }

    advancePomodoro(roomId) {
        const room = this.getRoom(roomId);
        if (!room || !room.state.isPomodoro) return null;

        const config = room.config.pomodoro || { workMinutes: 25, breakMinutes: 5 };

        if (room.state.pomodoroPhase === 'work') {
            room.state.pomodoroPhase = 'break';
            room.state.pomodoroCycles++;
            room.config.durationMs = config.breakMinutes * 60 * 1000;
        } else {
            room.state.pomodoroPhase = 'work';
            room.config.durationMs = config.workMinutes * 60 * 1000;
        }

        room.state.remainingMs = room.config.durationMs;
        room.state.isRunning = true;
        room.state.lastTickTime = Date.now();
        room.state.hasStarted = true;

        return room.state.pomodoroPhase;
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
