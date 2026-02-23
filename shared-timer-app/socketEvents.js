// Shared WebSocket Event Names
// Single source of truth used by both server (CommonJS) and client (ESM via Vite)

const EVENTS = {
    // Connection
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',

    // Room lifecycle
    JOIN_ROOM: 'join_room',
    LEAVE_ROOM: 'leave_room',
    USER_JOINED: 'user_joined',
    USER_LEFT: 'user_left',

    // State sync
    SYNC_STATE: 'sync_state',
    ACTIVE_ROOMS: 'active_rooms',

    // Timer actions
    TIMER_ACTION: 'timer_action',
    TIMER_COMPLETED: 'timer_completed',

    // Tokens & Auth
    GET_INVITE_TOKENS: 'get_invite_tokens',
    INVITE_TOKENS: 'invite_tokens',

    // Pomodoro
    SET_POMODORO: 'set_pomodoro',

    // Reactions
    SEND_REACTION: 'send_reaction',
    REACTION: 'reaction',

    // Errors
    ERROR: 'error',
};

module.exports = EVENTS;
