# utils/ - AI Context

**🎯 Purpose:** Specialized state managers and pure helper functions shared across the platform. Split between root `utils/` (backend/shared) and `src/utils/` (frontend).

**🏛️ Architecture & Patterns:**
- **Domain Managers:** Complex root utilities like `blackjackRoomManager.js` act as memory-resident "Singletons" for game state.
- **Safe Serialization:** `safeSerialization.js` provides wrappers for socket emits to prevent circular reference errors.
- **Frontend Helpers:** `src/utils/` handles browser-specific logic like `soundGenerator.js` (AudioContext) and `clientStorage.js` (localStorage).
- **Formatters:** Centralized logic for time, currency, and string manipulation to ensure UI consistency.

**🚨 Strict Rules:**
- **Side-Effect Free:** General utilities must be pure functions. State-bearing utils (Managers) must expose clear getter/setter patterns.
- **No Node.js in SRC:** Files in `src/utils/` must never import `fs`, `path`, or other Node-only modules.
- **Stability First:** All socket-bound objects must be processed by `safeStringify` if they contain complex nested structures.

**⚠️ Known Pitfalls:**
- **Path Fragmentation:** Duplicate functionality can emerge between the two `utils` folders; check both before adding new helpers.
- **Complexity Bloat:** `blackjackRoomManager.js` and `soundGenerator.js` are large and brittle; treat with extreme caution.
- **Volatile State:** Root managers (Blackjack) hold state in RAM; it is NOT persistent across server restarts unless explicitly synced to DB.

**🔗 Key Files:**
- [blackjackRoomManager.js](file:///c:/Users/s3ish/Documents/Workspace/AntiGravity/Antigrav/shared-timer-app/utils/blackjackRoomManager.js): High-complexity memory state for the blackjack engine.
- [safeSerialization.js](file:///c:/Users/s3ish/Documents/Workspace/AntiGravity/Antigrav/shared-timer-app/utils/safeSerialization.js): Critical stability layer for socket communication.
- [apiClient.js](file:///c:/Users/s3ish/Documents/Workspace/AntiGravity/Antigrav/shared-timer-app/src/utils/apiClient.js): Standardized frontend fetch wrapper.
- [timerUtils.js](file:///c:/Users/s3ish/Documents/Workspace/AntiGravity/Antigrav/shared-timer-app/src/utils/timerUtils.js): Shared time calculation logic.
