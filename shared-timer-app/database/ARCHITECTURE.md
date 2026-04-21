# Database Architecture Guide

This document defines the modular database architecture of the Shared Timer App. It is intended for both developers and AI agents to ensure long-term maintainability and prevent architectural drift.

## 🏗️ Directory Layout

The database logic is divided into domain-specific modules located in the `/database` directory:

| File | Domain / Responsibility |
| :--- | :--- |
| `connection.js` | **Singleton Connection**: Manages the SQLite connection, PRAGMAs, and WAL mode. |
| `index.js` | **The Facade**: The primary entry point. It re-exports all modules and handles initialization. |
| `schema.js` | **Schema & Migrations**: Contains all DDL (`CREATE TABLE`, `ALTER TABLE`) and seeding logic. |
| `utils.js` | **Utilities**: Global helper functions (e.g., `safeJsonParse`) and the `dbLayer` compatibility object. |
| `logging.js` | **Observability**: Centralized logging for system events and errors. |
| `users.js` | **Users**: Auth, profile management, roles, and ban logic. |
| `economy.js` | **Economy**: KoalaCoins, transactions, daily missions, and achievements. |
| `timers.js` | **Timers & Rooms**: Room state persistence, timer history, and session tracking. |
| `social.js` | **Social**: Friends list, requests, and social interactions. |
| `external.js` | **Integrations**: RSS, Esports, Countdowns, and Feature Requests. |
| `games.js` | **Games**: All minigame logic (Wordle, Blackjack, Lotto, Tower Climb, etc.). |

---

## 📜 Core Rules (DO NOT BREAK)

### 1. Unified Entry Point
**Always** import the database via the index facade:
```javascript
const db = require('./database'); // Points to database/index.js
```
Never import a specific domain file (e.g., `require('./database/users')`) from outside the database directory.

### 2. No Circular Dependencies
Domain files (e.g., `users.js`, `economy.js`) **must never require each other**. 
- If `economy.js` needs a user's display name, it should perform a direct SQL query via the `db` singleton.
- If shared logic is needed, move it to a utility file or `logging.js`.

### 3. Singleton Database Instance
All domain modules must import the `db` instance from `connection.js`:
```javascript
const db = require('./connection');
```
This ensures a single connection pool and consistent PRAGMA settings.

### 4. Mandatory Logging
Use `logging.js` for all significant events and errors. Avoid using `console.log` directly for database-related events.

---

## 🛠️ How to Add a New Feature

1.  **Identify the Domain**: Decide which file (e.g., `games.js`) the function belongs in.
2.  **Implement the Function**: Add the function using the `db` singleton. Use Promises for all asynchronous operations.
3.  **Export the Function**: Add the function name to the `module.exports` object at the bottom of the domain file.
4.  **Automatic Exposure**: The function is automatically available via `require('./database')` because `index.js` uses the spread operator (`...games`).

## 📁 How to Add a New Domain

1.  **Create the File**: Create `database/my_domain.js`.
2.  **Import Connection**: Add `const db = require('./connection');` at the top.
3.  **Wire into Facade**: In `database/index.js`:
    *   Import the new file: `const myDomain = require('./my_domain');`
    *   Spread it into the exports: `...myDomain`

---

## ⚠️ Important Note on /data Directory
The `/data` directory is strictly for the SQLite database files. **Never** write application code, configuration, or temporary artifacts to this directory, as it may be overwritten or ignored in production environments.
