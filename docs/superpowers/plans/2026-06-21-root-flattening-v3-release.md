# Root Flattening and v3 Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move KoalaWeb from `shared-timer-app/` into the repository root, preserve local and production data compatibility, and publish the verified result as `v3.0.0`.

**Architecture:** Perform a history-preserving Git flattening without changing internal application module boundaries. Protect the migration with a repository-layout regression test, update every active path consumer, then validate Node, Docker and SQLite against the production backup before merging, migrating local ignored data and pushing the release tag.

**Tech Stack:** Git, Node.js 24.17.0, Vitest, Vite, Docker, GitHub Actions, SQLite

---

### Task 1: Prepare an isolated, reproducible migration workspace

**Files:**
- Revert before worktree creation: `shared-timer-app/package.json`, `shared-timer-app/package-lock.json`, `shared-timer-app/src/data/changelog.json`
- Preserve untracked: `backup_2026-06-20_13-30-23.sqlite`

- [ ] **Step 1: Revert only the abandoned local `2.62.0` preparation**

Use `apply_patch` in the main checkout to restore version `2.61.0` in `shared-timer-app/package.json` and both package entries in `shared-timer-app/package-lock.json`. Remove only changelog entry `id: 102` / version `2.62.0`. Do not touch the production backup.

- [ ] **Step 2: Confirm the main checkout has no tracked changes**

Run: `git status --short`

Expected: only `?? backup_2026-06-20_13-30-23.sqlite`.

- [ ] **Step 3: Create the isolated worktree**

Run from the repository root:

```bash
git worktree add .worktrees/root-flattening-v3 -b codex/root-flattening-v3
```

Expected: worktree created from the current `main` commit.

- [ ] **Step 4: Install and build the baseline in the current app root**

Run:

```bash
cd shared-timer-app
npm install
npx --yes node@24.17.0 node_modules/vite/bin/vite.js build
```

Expected: dependency installation and Vite build exit `0`.

- [ ] **Step 5: Verify the baseline tests**

Run:

```bash
npx --yes node@24.17.0 node_modules/vitest/vitest.mjs run --passWithNoTests
```

Expected: 49 test files and 211 tests pass.

### Task 2: Add a failing repository-layout guard

**Files:**
- Create before move: `shared-timer-app/tests/repositoryLayout.test.js`
- Final location after move: `tests/repositoryLayout.test.js`

- [ ] **Step 1: Write the structural regression test**

Create:

```js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8'
}).trim();

test('application and deployment entrypoints live at repository root', () => {
  for (const file of ['package.json', 'server.js', 'Dockerfile', 'docker-compose.yml']) {
    assert.equal(fs.existsSync(path.join(repoRoot, file)), true, `${file} must exist at repo root`);
  }
  assert.equal(fs.existsSync(path.join(repoRoot, 'shared-timer-app')), false);

  const workflow = fs.readFileSync(
    path.join(repoRoot, '.github/workflows/docker-publish.yml'),
    'utf8'
  );
  assert.doesNotMatch(workflow, /context:\s*\.\/shared-timer-app/);
  assert.match(workflow, /context:\s*\./);
});

test('generated development artifacts are not tracked', () => {
  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' });
  assert.doesNotMatch(tracked, /(^|\/)\.playwright-mcp\//m);
  assert.doesNotMatch(tracked, /(^|\/)__pycache__\//m);
  assert.doesNotMatch(tracked, /(^|\/)scratch\//m);
});
```

- [ ] **Step 2: Run the guard and verify RED**

Run from `shared-timer-app/`:

```bash
npx --yes node@24.17.0 node_modules/vitest/vitest.mjs run tests/repositoryLayout.test.js
```

Expected: FAIL because root entrypoints are absent and generated/scratch files are still tracked.

- [ ] **Step 3: Commit the failing guard**

```bash
git add shared-timer-app/tests/repositoryLayout.test.js
git commit -m "test: define repository root layout"
```

### Task 3: Flatten tracked application files and clean artifacts

**Files:**
- Move: all tracked application files under `shared-timer-app/` into repository root
- Merge: `.gitignore`, `README.md`, `docs/`
- Create: `scripts/diagnostics/`
- Delete: `.playwright-mcp/`, `scripts/__pycache__/`, obsolete scratch scripts, deprecated deployment script

- [ ] **Step 1: Move collision-free tracked directories**

From the worktree root, use `git mv` for:

```bash
git mv shared-timer-app/assets_static .
git mv shared-timer-app/config .
git mv shared-timer-app/controllers .
git mv shared-timer-app/cron .
git mv shared-timer-app/database .
git mv shared-timer-app/public .
git mv shared-timer-app/routes .
git mv shared-timer-app/services .
git mv shared-timer-app/sockets .
git mv shared-timer-app/src .
git mv shared-timer-app/tests .
git mv shared-timer-app/utils .
git mv shared-timer-app/scripts .
mkdir -p data
git mv shared-timer-app/data/.gitkeep data/.gitkeep
```

- [ ] **Step 2: Move collision-free root files**

Use `git mv` for every tracked top-level app file except `.gitignore` and `README.md`, including:

```bash
git mv shared-timer-app/.dockerignore .
git mv shared-timer-app/.env.example .
git mv shared-timer-app/.nvmrc .
git mv shared-timer-app/Dockerfile .
git mv shared-timer-app/docker-compose.yml .
git mv shared-timer-app/package.json .
git mv shared-timer-app/package-lock.json .
git mv shared-timer-app/server.js .
git mv shared-timer-app/roomManager.js .
git mv shared-timer-app/socketEvents.json .
git mv shared-timer-app/vite.config.js .
git mv shared-timer-app/AI_DEVELOPMENT_GUIDELINES.md .
git mv shared-timer-app/AI_INIT.md .
git mv shared-timer-app/DEVELOPMENT_GUIDELINES.md .
git mv shared-timer-app/DEVOPS_ROUTINE.md .
git mv shared-timer-app/Test_Routine.md .
git mv shared-timer-app/WordleWordList.json .
git mv shared-timer-app/create_superadmin.js .
git mv shared-timer-app/detect_react_error.js .
git mv shared-timer-app/eslint.config.js .
git mv shared-timer-app/index.html .
git mv shared-timer-app/jwtSecret.js .
git mv shared-timer-app/restart_server.bat .
git mv shared-timer-app/restart_server.sh .
git mv shared-timer-app/sanitize.js .
git mv shared-timer-app/testSetup.js .
```

Run `git ls-files shared-timer-app` afterward. Expected remaining tracked paths are limited to collision/merge inputs under `docs/`, `scratch/`, `.playwright-mcp/`, `.gitignore` and `README.md`.

- [ ] **Step 3: Merge documentation trees**

Move every file from:

```text
shared-timer-app/docs/superpowers/plans/  -> docs/superpowers/plans/
shared-timer-app/docs/superpowers/specs/ -> docs/superpowers/specs/
```

Use `git mv` per file so history remains visible. Remove the now-empty app documentation directories.

- [ ] **Step 4: Consolidate scratch diagnostics**

Create `scripts/diagnostics/` and run:

```bash
git mv shared-timer-app/scratch/check_wordle_api.js scripts/diagnostics/check_wordle_api.js
git mv shared-timer-app/scratch/verify_lotto_v2.js scripts/diagnostics/verify_lotto_v2.js
git rm shared-timer-app/scratch/stress_test_dashboard.js
git rm shared-timer-app/scratch/test_date.js
git rm scripts/deprecated_deploy_to_unraid.bat
```

- [ ] **Step 5: Remove tracked generated artifacts**

Run:

```bash
git rm -r shared-timer-app/.playwright-mcp
git rm scripts/__pycache__/wordle_enricher.cpython-313.pyc
```

- [ ] **Step 6: Merge ignores and README**

Use `apply_patch` to make root `.gitignore` include the existing root exclusions plus Node dependencies, build outputs, environment files, SQLite files, `data/*` with `!data/.gitkeep`, `.playwright-mcp/`, `__pycache__/`, `*.pyc`, logs and deploy artifacts. Then `git rm shared-timer-app/.gitignore`.

Use `apply_patch` to replace root `README.md` with one consolidated KoalaWeb README that describes the flattened structure and root-level commands. Then `git rm shared-timer-app/README.md`.

- [ ] **Step 7: Remove worktree-only ignored artifacts from the old wrapper**

Run from the worktree root:

```bash
mv shared-timer-app/node_modules node_modules
rsync -a shared-timer-app/data/ data/
rm -rf shared-timer-app/dist
rm -rf shared-timer-app/data
rmdir shared-timer-app
```

Before each removal, confirm `git ls-files shared-timer-app` is empty. These paths contain only worktree-generated dependencies, build output and test data; no production data is present in the isolated worktree.

- [ ] **Step 8: Run the layout guard and verify GREEN**

Run from repository root:

```bash
npx --yes node@24.17.0 node_modules/vitest/vitest.mjs run tests/repositoryLayout.test.js
```

Expected: 2 tests pass.

- [ ] **Step 9: Commit the structural move**

```bash
git add -A
git commit -m "refactor: flatten application into repository root"
```

### Task 4: Update active path consumers and release metadata

**Files:**
- Modify: `.github/workflows/docker-publish.yml`
- Modify: `docker-compose.yml`
- Modify: documentation containing active wrapper paths
- Modify: `package.json`, `package-lock.json`, `src/data/changelog.json`

- [ ] **Step 1: Update GitHub Actions Docker context**

Change:

```yaml
context: ./shared-timer-app
```

to:

```yaml
context: .
```

Remove the obsolete comment that says the Dockerfile lives under the wrapper directory.

- [ ] **Step 2: Remove the committed API secret from Compose**

Change the environment entry to:

```yaml
- THE_ODDS_API_KEY=${THE_ODDS_API_KEY:-}
```

Keep Twitch credentials environment-driven in the same form. The exposed key must be rotated outside Git; do not copy it into another tracked file.

- [ ] **Step 3: Update active documentation references**

Update setup, Docker and structure commands in `README.md`, `DEVOPS_ROUTINE.md`, `DEVELOPMENT_GUIDELINES.md`, AI guides and architecture files so active instructions run from repository root. Historical plans/specs may retain old paths when they describe completed migrations.

- [ ] **Step 4: Add the active-reference guard**

Extend `tests/repositoryLayout.test.js` with:

```js
test('active repository configuration does not reference the removed wrapper', () => {
  const activeFiles = [
    '.github/workflows/docker-publish.yml',
    'README.md',
    'DEVOPS_ROUTINE.md',
    'DEVELOPMENT_GUIDELINES.md',
    'docker-compose.yml'
  ];
  for (const file of activeFiles) {
    const source = fs.readFileSync(path.join(repoRoot, file), 'utf8');
    assert.doesNotMatch(source, /shared-timer-app/);
  }
});
```

- [ ] **Step 5: Set version `3.0.0`**

Use `apply_patch` to set version `3.0.0` in `package.json` and the two root package entries in `package-lock.json`. Add changelog entry `id: 102`, version `3.0.0`, date `2026-06-21`, covering root flattening, native Node SQLite, central timer refactor and release hardening.

- [ ] **Step 6: Run guards and focused configuration checks**

Run:

```bash
npx --yes node@24.17.0 node_modules/vitest/vitest.mjs run tests/repositoryLayout.test.js
rg -n "shared-timer-app" .github README.md DEVOPS_ROUTINE.md DEVELOPMENT_GUIDELINES.md docker-compose.yml package.json
```

Expected: layout tests pass and `rg` returns no active wrapper references.

- [ ] **Step 7: Commit release metadata and references**

```bash
git add -A
git commit -m "release: prepare KoalaWeb v3.0.0"
```

### Task 5: Verify the flattened application and production database

**Files:**
- Verify only; generated files remain ignored

- [ ] **Step 1: Reinstall from the root lockfile**

Run from repository root:

```bash
npm install
```

Expected: installation succeeds; the known low-severity dev-only esbuild advisory may remain, but production dependencies must be audited separately.

- [ ] **Step 2: Build before the SPA test**

Run:

```bash
npx --yes node@24.17.0 node_modules/vite/bin/vite.js build
```

Expected: production build exits `0` and creates root `dist/index.html`.

- [ ] **Step 3: Run the full Node 24 test suite**

Run:

```bash
npx --yes node@24.17.0 node_modules/vitest/vitest.mjs run --passWithNoTests
```

Expected: all test files pass, including the new layout tests.

- [ ] **Step 4: Remove only synthetic database-test logs**

Run the existing Node 24 cleanup query against root `data/timerapp.db`, restricted to message `addKoalaCoins failed: forced transaction failure` and context reason `force rollback`.

- [ ] **Step 5: Audit production dependencies**

Run:

```bash
npm audit --omit=dev
npm ls sqlite3 node-gyp tar prebuild-install --all
```

Expected: zero production vulnerabilities and no deprecated SQLite dependency chain.

- [ ] **Step 6: Build the final Docker image from root**

Run:

```bash
docker build -t koalaweb:v3-release-check .
```

Expected: both build stages succeed with Node 24.17.0.

- [ ] **Step 7: Create an isolated production-backup test directory**

Create a new `/tmp/koala-v3-production-smoke.*` directory and copy `/Users/justus/Documents/Git/Antigrav/backup_2026-06-20_13-30-23.sqlite` into it as `timer.db`. Never modify the original backup.

- [ ] **Step 8: Run the release image against the backup copy**

Run the image as `koalaweb-v3-release-check`, bind host port `3002` to container port `3001`, and mount the temporary directory at `/app/data`.

Expected: server starts without migration or schema errors.

- [ ] **Step 9: Execute HTTP and SQLite smoke tests**

Verify HTTP 200 for `/`, `/admin`, `/leveling` and `/api/rooms`. Inside the container, assert Node `v24.17.0`, `PRAGMA integrity_check = ok`, 11 users, a successful transaction that is rolled back, and a readable backup created by `backupController.createBackup`.

- [ ] **Step 10: Compare error logs and stop the container**

Confirm the backup copy has no new `ErrorLogs` compared with the original, inspect container logs, then stop the test container.

- [ ] **Step 11: Verify repository hygiene**

Run:

```bash
git diff --check
git status --short
git ls-files | rg '(^|/)(\.playwright-mcp|__pycache__|scratch)/'
```

Expected: clean tracked worktree and no generated/scratch paths.

### Task 6: Merge, migrate local ignored data and publish `v3.0.0`

**Files:**
- Runtime migration: ignored `shared-timer-app/data/` to root `data/`
- Git operations: `main`, tag `v3.0.0`

- [ ] **Step 1: Obtain final independent review**

Review the complete branch diff against the design and require no open Critical or Important findings before merge.

- [ ] **Step 2: Merge the feature branch locally**

From the main checkout:

```bash
git pull
git merge codex/root-flattening-v3
```

Expected: merge succeeds without touching the untracked production backup.

- [ ] **Step 3: Stop the old server and migrate ignored local data**

Stop the process listening on port 3001. Then run:

```bash
mkdir -p data
rsync -a shared-timer-app/data/ data/
```

Open both source and destination databases read-only with Node 24. Assert `PRAGMA integrity_check = ok` for both and equal counts for `Users` and `ErrorLogs` before deleting any old local data.

- [ ] **Step 4: Install, build and test on merged `main`**

Run from repository root:

```bash
npm install
npx --yes node@24.17.0 node_modules/vite/bin/vite.js build
npx --yes node@24.17.0 node_modules/vitest/vitest.mjs run --passWithNoTests
```

Expected: build and all tests pass from the new root.

- [ ] **Step 5: Start the local server from root and smoke test**

Run `npx --yes node@24.17.0 server.js`, then verify HTTP 200 for `/leveling` and `/admin` on port 3001.

- [ ] **Step 6: Clean obsolete ignored wrapper artifacts**

Only after successful data verification and server startup, remove old ignored `shared-timer-app/node_modules`, `shared-timer-app/dist`, and the verified duplicate `shared-timer-app/data`; confirm `shared-timer-app/` no longer exists.

- [ ] **Step 7: Push main**

```bash
git push origin main
```

Expected: remote `main` points at the verified v3 release commit.

- [ ] **Step 8: Create and push the annotated release tag**

```bash
git tag -a v3.0.0 -m "KoalaWeb v3.0.0"
git push origin v3.0.0
```

Expected: tag exists locally and remotely and points at `main`.

- [ ] **Step 9: Monitor the release workflow**

Use `gh run list` and `gh run watch` for `.github/workflows/docker-publish.yml` until the tag-triggered GHCR build completes. If it fails, inspect logs and do not claim the release is complete.

- [ ] **Step 10: Clean the worktree and branch**

After successful push and workflow, remove the Superpowers worktree, prune worktree metadata and delete the merged local feature branch.
