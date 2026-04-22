# cron/ - AI Context

**🎯 Purpose:** Manages automated background tasks and periodic system maintenance. Ensures data integrity for bets, lottery draws, and database backups without user intervention.

**🏛️ Architecture & Patterns:**
- **In-Process Scheduling:** Uses Node.js `setInterval` and `setTimeout` for task execution (no external cron dependencies).
- **Initialization:** Modules export a `startCron()` function, typically invoked in `server.js` with a staggered delay.
- **Atomic Operations:** Critical financial/betting resolutions use `dbLayer` atomic methods to prevent race conditions.
- **System Logging:** Every cycle and failure is logged via `dbLayer.logSystemEvent` to maintain a searchable audit trail in the Admin Dashboard.

**🚨 Strict Rules:**
- **Non-Blocking:** Async logic is mandatory. Cron jobs must never block the Node.js event loop.
- **Staggered Start:** Always use a `setTimeout` (5s-30s) before the first execution to ensure the DB and server are fully ready.
- **Error Resilience:** Jobs must use `try-catch` blocks to ensure a single failure doesn't halt future iterations.
- **Zero Hallucination:** Check `unresolvedCount` before fetching external API data to save bandwidth and rate limits.

**⚠️ Known Pitfalls:**
- **Timing Drift:** `setInterval` is not precision-guaranteed; heavy event loop load can delay execution.
- **Rate Limiting:** External API calls (Polymarket, RSS) are subject to external limits; implement proper timeouts and error handling.
- **No Global Registry:** Jobs are independent; monitoring requires checking individual logs in the database.

**🔗 Key Files:**
- [betResolver.js](file:///c:/Users/s3ish/Documents/Workspace/AntiGravity/Antigrav/shared-timer-app/cron/betResolver.js): Fuzzy-matching winner resolution logic for Polymarket bets.
- [backupCron.js](file:///c:/Users/s3ish/Documents/Workspace/AntiGravity/Antigrav/shared-timer-app/cron/backupCron.js): Automated SQLite snapshot management.
- [lottoDrawCron.js](file:///c:/Users/s3ish/Documents/Workspace/AntiGravity/Antigrav/shared-timer-app/cron/lottoDrawCron.js): Economy-driven periodic drawing logic.
