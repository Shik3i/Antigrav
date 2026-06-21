# AI Development Guidelines

This document outlines critical rules and best practices for AI agents collaborating on the **KoalaWeb** codebase. Adherence to these guidelines is mandatory to ensure environmental stability and deployment integrity.

---

## 0. Git Branch Verification & Hygiene (MANDATORY)

> [!IMPORTANT]
> **BEFORE writing any code or executing any modification commands, you MUST verify the active Git branch.**

- **Reasoning**: Working on a wrong, stale, or deprecated feature branch causes severe merge conflicts, compilation failures, and deployment desynchronization.
- **Mandatory First Steps for every Agent Session**:
    1. Run `git branch` and `git status` immediately to determine the active branch.
    2. Default to **`main`** unless the user explicitly instructs you to work on a specific feature branch.
    3. Run `git pull` to fetch the latest upstream changes before introducing any modifications.
    4. If the active branch is not `main` and the user did not request a custom branch, explicitly warn the user and check out the correct branch (e.g. `git checkout main`).

---

## 1. Database Schema Management (CODE-FIRST ONLY)

> [!IMPORTANT]
> **NEVER** perform manual database mutations (CREATE TABLE, ALTER TABLE, etc.) via the terminal or external SQL tools for production features. 

- **Reasoning**: Manual terminal commands only affect the local SQLite file (`data/timerapp.db`). These changes will NOT exist in the production environment or for other developers.
- **Mandatory Workflow**:
    1. All schema changes must be implemented in `database/schema.js` within the `initializeDatabaseSchema()` function.
    2. Use `CREATE TABLE IF NOT EXISTS` for new tables.
    3. Use `ALTER TABLE` within the migration section (near the bottom of the schema function) to add columns to existing tables.
    4. Always include safety checks (e.g., catching error code for "duplicate column name") to ensure migrations are idempotent.

---

## 2. Version Control (NO AUTO-COMMITS)

> [!WARNING]
> **NEVER** execute `git commit` or `git push` without an explicit user request or an automated DevOps Routine execution approved by the user.

- **Reasoning**: The user maintains control over the repository history and deployment triggers.
- **Best Practice**: Suggest commit messages if needed, but wait for the user to confirm they are ready to package the current changes.

---

## 3. Web & UI Standards

- **Visual Excellence**: Always prioritize premium, state-of-the-art designs. Avoid generic layouts.
- **Glassmorphism & Gradients**: Use modern CSS techniques (backdrop-blur, HSL gradients) to keep the app looking premium.
- **Animations**: Implement subtle micro-interactions (shake, flip, hover states) to improve UX.

---

## 4. Operational Safety

- **Atomic Transactions**: When handling financial data (Koala Coins) or synchronized game states (Wordle, Roulette, Blackjack), always use database transactions (`BEGIN`, `COMMIT`, `ROLLBACK`) to ensure data integrity.
- **Environment Context**: Be aware that your view is limited to the local environment. Always design for cloud/production deployment where resources might be isolated or read-only.

---

## 5. Command & Build Integrity

> [!CAUTION]
> **ALWAYS** verify the literal output and exit codes of your commands. 

- **Build Verification**: If you modify frontend files (`.jsx`, `.js`, `.css`), you MUST run `npm run build` and ensure it completes with `Exit code: 0`.
- **Immediate Correction**: If a build fails or a server restart throws an error, you are DISALLOWED from telling the user "Everything is done" or "Please test it". You must fix the error first.
- **Log Monitoring**: After running `restart_server.bat` or `./restart_server.sh`, always check the command status/output to ensure the server is actually "Listening on port XXXX" and not crashing.

---
*Last Updated: 2026-05-18 (Added Git Branch Verification Protocols)*
*Signed, Shik3i & KoalaWeb Core Team*
