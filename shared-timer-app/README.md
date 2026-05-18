# KoalaWeb

A real-time social platform with a premium glassmorphic aesthetic. KoalaWeb combines synchronized rooms, games (Wordle, Tetris, KoalaFlap, ...), a Koala Coins economy, Esports data, betting, countdowns, achievements and more in a single full-stack application.

## 🏗️ Architecture Overview

The system is designed as a Full-Stack Monolith with a clear separation between memory-resident real-time state and persistent storage.

### 🔌 Real-Time Engine (Socket.io)
Real-time features are the core of Antigrav.
- **State Management**: The server uses `roomManager.js` to maintain active room states (timers, user lists, game states) in memory. This ensures high-performance updates without database latency.
- **Event-Driven**: All real-time communication is handled via Socket.io. Event names are centralized in `socketEvents.json`.
- **Logic**: Sockets handle everything from timer sync and pomodoro transitions to minigame rolls (Deathroll, Coinflip) and live balance updates.

### 🖥️ Frontend (React + Vite)
- **Framework**: React 19 SPA.
- **Styling**: Vanilla CSS with a heavy focus on glassmorphism, gradients, and micro-animations for a premium feel.
- **State**: Mix of React context (`AuthContext`) and local component state. Live data is synchronized via a global socket connection in `App.jsx`.

### 🗄️ Backend (Node.js + Express + SQLite)
- **API**: Express handles RESTful endpoints for authentication, historical data fetching, and administrative tasks.
- **Persistence**: Modular SQLite architecture (in `/database`) stores users, currency (Koala Coins), achievements, and system metrics.
- **Security**: JWT-based authentication for users and invite links. Admins have elevated privileges verified via tokens.
- **Background Tasks**: Cron jobs (`cron/`) handle recurring logic like Lotto draws and bet resolutions.

## 📂 Project Structure

```bash
├── controllers/      # Backend business logic (API, Games, Auth)
├── sockets/          # Socket.io event handlers
├── services/         # External integrations (Polymarket, Esports APIs)
├── cron/             # Scheduled background tasks
├── routes/           # REST API route definitions
├── src/              # React Frontend source
├── database/         # Modular database architecture (Schema, Domains, Utils)
├── roomManager.js    # Core real-time state engine
├── server.js         # Entry point (Express + Socket.io setup)
└── socketEvents.json # Source of truth for event string names
```

## 🎮 Key Features

- **Shared Timer**: Multi-room support with Pomodoro mode, Auto-Restart, and Admin/Member roles.
- **Economy**: "Koala Coins" currency earned via productivity or minigames.
- **Minigames**:
  - **Lotto**: Active draw-based simulation with categorized history.
  - **Gamified**: Tetris (Chill/Speed), Wordle, Tower Climb, KoalaFlap.
  - **Social**: Coinflip, Deathroll, Friends System.
- **Real-time Data**: Live Esports schedules and Polymarket betting odds integration.

## 🤖 Guidelines for AI Agents

When working on this codebase, follow these principles:

1.  **State Reactivity**: Ensure frontend changes react to socket events. Use the central `socketEvents.json` for all event strings.
2.  **Database Pattern**: Follow the **[Database Architecture Guide](database/ARCHITECTURE.md)**. Use domain-specific modules in `/database` (e.g., `users.js`, `economy.js`) and never break domain isolation.
3.  **Logging**: Fatal errors should be logged via `logging.js`. Do not just use `console.error`.
4.  **Premium UI**: Maintain the "Premium Glassmorphic" design language. Use standard CSS variables for colors and spacing where possible.
5.  **Sanitization**: Always use the `sanitize.js` utility for user-generated content (like room names or chat) before broadcasting over sockets.
6.  **DevOps**: Refer to `DEVOPS_ROUTINE.md` for versioning and deployment steps.

## 🚀 Getting Started

1.  **Install**: `npm install`
2.  **Environment**: Configure `.env` (JWT_SECRET, PORT, etc.).
3.  **Development**: `npm run dev` (Frontend) and `npm start` (Backend).
4.  **Build**: `npm run build`
