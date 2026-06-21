# V3 Upgrade Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make v3 upgrades preserve legacy runtime state, require Node 24, and support registry-based Docker updates.

**Architecture:** Two small CommonJS scripts own environment validation and legacy-layout migration. Package lifecycle hooks invoke them before installation/start, while Compose declares the published GHCR image and the README documents both registry and local-build flows.

**Tech Stack:** Node.js 24, CommonJS, Vitest, Docker Compose, Markdown

---

### Task 1: Define upgrade safety contracts

**Files:**
- Create: `tests/upgradeSafety.test.js`

- [ ] Write failing tests that import `checkNodeVersion` and `migrateLegacyLayout`, exercise migration/conflict/idempotency with temporary directories, and assert the Compose image plus README requirements.
- [ ] Run `npm.cmd test -- tests/upgradeSafety.test.js` and confirm failure because the scripts and configuration do not exist.
- [ ] Commit the failing contract test.

### Task 2: Implement Node 24 validation

**Files:**
- Create: `scripts/require-node-24.js`
- Modify: `package.json`

- [ ] Implement `checkNodeVersion(version)` returning `{ ok, major }` and a CLI that exits nonzero unless `major === 24`.
- [ ] Add `preinstall` and compose `prestart` so validation precedes migration and server startup.
- [ ] Run the focused tests and confirm the Node-version cases pass.
- [ ] Commit the Node validation.

### Task 3: Implement safe legacy-layout migration

**Files:**
- Create: `scripts/migrate-v3-layout.js`

- [ ] Implement an exported `migrateLegacyLayout({ rootDir, logger })` using `fs.renameSync`, cross-device copy/delete fallback, no-overwrite conflict handling, and safe empty-directory cleanup.
- [ ] Run the focused tests and confirm migration, conflict, and idempotency cases pass.
- [ ] Commit the migration.

### Task 4: Correct Docker update behavior and documentation

**Files:**
- Modify: `docker-compose.yml`
- Modify: `README.md`

- [ ] Add `image: ghcr.io/shik3i/antigrav:latest` while retaining `build: .`.
- [ ] Document Node 24, the migration command before first v3 startup, GHCR pull/update, and the separate local-build command.
- [ ] Run the focused tests and confirm all upgrade contracts pass.
- [ ] Commit Compose and documentation changes.

### Task 5: Full verification

**Files:**
- Modify only if verification reveals an in-scope defect.

- [ ] Run `npm.cmd test` and require all tests to pass.
- [ ] Run `npm.cmd run build` and require a successful production build.
- [ ] Run `npm.cmd audit --omit=dev` and require no production vulnerabilities.
- [ ] Run `git diff --check` and inspect `git status --short`.
