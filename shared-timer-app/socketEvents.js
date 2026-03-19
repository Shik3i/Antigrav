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
    ROOM_EVENT: 'room_event',
    ROOM_EVENT_SYNC: 'room_event_sync',

    // State sync
    SYNC_STATE: 'sync_state',
    ACTIVE_ROOMS: 'active_rooms',

    // Timer actions
    TIMER_ACTION: 'timer_action',
    TIMER_COMPLETED: 'timer_completed',
    TOGGLE_AUTO_RESTART: 'toggle_auto_restart',

    // Latency Tracking
    PING: 'ping',
    PONG: 'pong',
    REPORT_METRICS: 'report_metrics',

    // Tokens & Auth
    GET_INVITE_TOKENS: 'get_invite_tokens',
    INVITE_TOKENS: 'invite_tokens',

    // Pomodoro
    SET_POMODORO: 'set_pomodoro',

    // Reactions
    SEND_REACTION: 'send_reaction',
    REACTION: 'reaction',

    // Errors (use 'app_error' not 'error' - socket.io reserves 'error' for protocol errors which causes client disconnect)
    ERROR: 'app_error',

    // Workspace Tools
    ADD_TODO: 'add_todo',
    TOGGLE_TODO: 'toggle_todo',
    DELETE_TODO: 'delete_todo',
    DRAW_LINE: 'draw_line',
    CLEAR_CANVAS: 'clear_canvas',

    // Room Management
    RENAME_ROOM: 'rename_room',
    PROMOTE_USER: 'promote_user',

    // Extension Addons
    EXTENSION_MESSAGE: 'extension_message',

    // Global API Fetching (to bypass HTTP rate limits)
    GET_API_NEWS: 'get_api_news',
    API_NEWS_DATA: 'api_news_data',
    GET_API_ESPORTS: 'get_api_esports',
    API_ESPORTS_DATA: 'api_esports_data',
    GET_API_ALL_TEAMS: 'get_api_all_teams',
    API_ALL_TEAMS_DATA: 'api_all_teams_data',
    GET_DB_ESPORTS_TEAMS: 'get_db_esports_teams',
    DB_ESPORTS_TEAMS_DATA: 'db_esports_teams_data',
    TRIGGER_FETCH_ALL_TEAMS: 'trigger_fetch_all_teams',
    GET_API_ODDS: 'get_api_odds',
    API_ODDS_DATA: 'api_odds_data',

    // Friends
    GET_FRIENDS_STATUS: 'get_friends_status',
    FRIENDS_STATUS: 'friends_status',

    // Live Coin Balance
    COIN_BALANCE_UPDATE: 'coin_balance_update',

    // Invites
    INVITE_FRIEND: 'invite_friend',
    ROOM_INVITE: 'room_invite',

    // Admin
    GET_ADMIN_MAPPINGS: 'get_admin_mappings',
    ADMIN_MAPPINGS_DATA: 'admin_mappings_data',
    ADD_ADMIN_MAPPING: 'add_admin_mapping',
    DELETE_ADMIN_MAPPING: 'delete_admin_mapping',

    GET_ADMIN_CACHE: 'get_admin_cache',
    ADMIN_CACHE_DATA: 'admin_cache_data',
    FLUSH_ADMIN_CACHE: 'flush_admin_cache',

    GET_ADMIN_ACTIVITY: 'get_admin_activity',
    ADMIN_ACTIVITY_DATA: 'admin_activity_data',
    DELETE_ADMIN_ACTIVITY: 'delete_admin_activity',

    GET_ADMIN_ROOMS: 'get_admin_rooms',
    ADMIN_ROOMS_DATA: 'admin_rooms_data',
    DELETE_ADMIN_ROOM: 'delete_admin_room',
    EDIT_ADMIN_ROOM: 'edit_admin_room',

    ADMIN_BROADCAST_MESSAGE: 'admin_broadcast_message',
    GLOBAL_ANNOUNCEMENT: 'global_announcement',
};

module.exports = EVENTS;
