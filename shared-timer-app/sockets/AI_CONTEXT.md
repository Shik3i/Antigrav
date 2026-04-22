# sockets/ - AI Context

**🎯 Purpose:** Core real-time engine for bidirectional communication. Manages memory-resident state for shared timers, social games, and live user presence.

**🏛️ Architecture & Patterns:**
- **Global Orchestrator:** `socketHandler.js` exports a single initialization function for the `io` instance.
- **JWT Middleware:** `io.use` verifies authentication during the handshake phase, populating `socket.user`.
- **Room Management:** Uses `roomManager.js` for productivity timers and `blackjackRoomManager.js` for blackjack logic.
- **Targeted Broadcasting:** 
    - `roomId`: Broadest scope for timer/game updates.
    - `userId`: Private room for targeted updates like coin balance or notifications.
    - `blackjack:roomId`: Specialized namespace for blackjack game state.
- **User Tracking:** Maintains an `onlineUsers` Map (`userId` -> `Set of socket.ids`) for presence and friend-status syncing.

**🚨 Strict Rules:**
- **Event Constants:** Never hardcode event strings. Always import and use `socketEvents.json`.
- **Sanitization:** All broadcasted user-generated content MUST be processed by `sanitize.js`.
- **Safe Emit:** Use `safeEmit` and `safeStringify` from `utils/safeSerialization.js` to prevent "circular reference" crashes.
- **Atomic Persistence:** When syncing memory state to the DB (e.g., blackjack winnings), use atomic database methods.

**⚠️ Known Pitfalls:**
- **God File Complexity:** `socketHandler.js` is over 1,500 lines and mixes multiple domain logics.
- **Memory vs DB Sync:** Discrepancies can occur if the server restarts; memory state is volatile.
- **Socket ID Volatility:** A single user can have multiple socket IDs (multiple tabs); always iterate through the set in `onlineUsers`.

**🔗 Key Files:**
- [socketHandler.js](file:///c:/Users/s3ish/Documents/Workspace/AntiGravity/Antigrav/shared-timer-app/sockets/socketHandler.js): The primary real-time logic handler.
- [socketEvents.json](file:///c:/Users/s3ish/Documents/Workspace/AntiGravity/Antigrav/shared-timer-app/socketEvents.json): The single source of truth for all real-time events.
