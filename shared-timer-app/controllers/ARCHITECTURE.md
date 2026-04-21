# Backend Controllers Architecture

This directory follows a **Domain-Specific Controller** pattern to maintain logical cohesion and prevent file bloat.

## The Facade Pattern
[apiController.js](file:///Users/koala/Documents/Antigravity/shared-timer-app/controllers/apiController.js) serves as the primary entry point (Facade). It aggregates and re-exports functionality from all domain-specific controllers.

> [!IMPORTANT]
> **Rule for Future Agents**: NEVER add business logic directly to `apiController.js`. Always extract or create a new domain controller if the logic doesn't fit into the existing ones.

## Domain Controllers

### 1. [adminController.js](file:///Users/koala/Documents/Antigravity/shared-timer-app/controllers/adminController.js)
- **Scope**: Superadmin-only actions and global system configuration.
- **Responsibilities**:
  - Team mappings and cache management.
  - System/Error logs and admin action auditing.
  - Global settings (Navbar, RSS Feeds, Pokemon Configs).
  - Admin-only game settings and score management.

### 2. [userController.js](file:///Users/koala/Documents/Antigravity/shared-timer-app/controllers/userController.js)
- **Scope**: User-centric data and identity management.
- **Responsibilities**:
  - Registration and preference management.
  - User profile aggregation (recent bets, achievements).
  - Economic transactions and balance auditing.

### 3. [gameController.js](file:///Users/koala/Documents/Antigravity/shared-timer-app/controllers/gameController.js)
- **Scope**: Core game logic and minigame systems.
- **Responsibilities**:
  - Score submission and validation (Koala Flap, Tetris).
  - Scratchcard minigame engine (generation, buying, claiming).
  - Leaderboards, upgrades, and daily missions.
  - Pokemon public data.

### 4. [externalController.js](file:///Users/koala/Documents/Antigravity/shared-timer-app/controllers/externalController.js)
- **Scope**: Integrations with external data sources and betting.
- **Responsibilities**:
  - LoL Esports data (schedules, team sync).
  - Betting markets (Polymarket, The Odds API backup).
  - Public news/RSS aggregation.
  - Twitch stream status.

### 5. [roomController.js](file:///Users/koala/Documents/Antigravity/shared-timer-app/controllers/roomController.js)
- **Scope**: Real-time collaborative features and utility.
- **Responsibilities**:
  - Room lifecycle management.
  - Media broadcast commands (play/pause).
  - Countdowns and Feature Requests.
  - System maintenance (Changelog).

## Guidelines for New Functions
1. **Identify the Domain**: Determine which of the 5 domains the new function belongs to.
2. **Implement**: Add the function to the corresponding controller file.
3. **Export**: Ensure the function is exported via `exports.name = ...`.
4. **Facade Check**: Since `apiController.js` uses the spread operator (`...domainController`), new exports are automatically available to the router.
