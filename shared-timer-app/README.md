# Shared Timer App

Realtime timer and mini-game app with:

- React + Vite frontend
- Express + Socket.IO backend
- SQLite persistence
- in-memory room state via `roomManager.js`

## Scripts

- `npm run build`: build the frontend into `dist/`
- `npm run start`: start the production server
- `npm run dev`: start the Vite dev server

## Structure

- `src/`: frontend app, pages, contexts, hooks, and utilities
- `controllers/`: HTTP route handlers and feature modules
- `routes/`: Express route registration
- `services/`: shared backend data services and caches
- `sockets/`: Socket.IO event handling
- `database.js`: schema setup and SQLite helpers
- `roomManager.js`: in-memory room lifecycle and timer state

## Notes

- Socket event names are defined once in `socketEvents.shared.json` and consumed by both server and client wrappers.
- Several maintenance and debug scripts live in the repository root. They are not part of the runtime path and should be treated as manual tools only.
