# Antigrav AI Initialization & Context Guide

**MANDATORY FIRST READ.** This file defines the architectural constraints and development protocols for the Antigrav platform. AI agents must strictly adhere to these rules to maintain system integrity and prevent regressions.

---

## 🏗️ Project Persona & Tech Stack
Antigrav is a **Full-Stack Monolith** optimized for real-time collaborative productivity and social gaming.

- **Backend**: Node.js (CommonJS), Express 5.x, SQLite 3.
- **Frontend**: React 19, Vite 7.x, React Router 7.
- **Real-Time**: Socket.io 4.x.
- **Design System**: **Vanilla CSS** with a "Premium Glassmorphic" aesthetic.
- **🚫 BANNED**: Tailwind CSS, MUI, Bootstrap, or any atomic/utility CSS libraries. All styling must be written in standard CSS.

---

## 🤖 AI Working Directives
1. **Atomic Iterations**: Perform changes in small, verifiable steps. Never refactor multiple domains simultaneously.
2. **Context Management**: Be aware of token limits. Keep files logically cohesive. Aim for < 800 lines. Absolute hard limit is 1000 lines before applying the Strangler Fig Pattern to break it down.
3. **Planning Mode**: For complex features, create an `implementation_plan.md` and wait for user approval before execution.

---

## 🗄️ Backend & Database Rules
- **Entry Point**: Always import the database via `const db = require('./database');`. This facade re-exports all domain modules.
- **Singleton**: All domain files must import the database instance from `./connection.js`.
- **Domain Isolation**: Domain modules (`users.js`, `economy.js`, etc.) must **never** require each other. Use direct SQL queries for cross-domain data access.
- **Logging**: Use `logging.js` for all system events and error persistence. Avoid `console.log` for production events.

---

## 🔌 Socket & Security Protocols
- **Sanitization (CRITICAL)**: Every user-controlled string received via a socket event MUST be processed by `sanitize.js` before being broadcast or saved.
- **Event Constants**: Never hardcode socket event strings. Always import and use the constants from `socketEvents.json`.
- **Validation**: Validate all payloads (stake amounts, game moves) on the server side. Never trust client-side state.

---

## 🖥️ Frontend Architecture
- **State Management**: Use React Context (located in `src/context/`) for global state and custom hooks for business logic.
- **Styling**: 
  - Global styles, CSS variables, and glassmorphic tokens are defined in `src/index.css`.
  - Prefer standard CSS classes over inline styles.
  - Maintain the high-blur, dark-mode, vibrant-gradient aesthetic.
- **Entry Point**: `src/main.jsx` bootstraps the app; `App.jsx` handles global socket initialization and routing.

---

## 📂 Key Architecture Documents
- `database/ARCHITECTURE.md`: Deep dive into the DB layer.
- `socketEvents.json`: Source of truth for real-time events.

**By proceeding, you acknowledge these constraints and commit to maintaining the modular integrity of the Antigrav codebase.**
