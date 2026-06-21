# Direct `node:sqlite` Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the deprecated `sqlite3` npm driver with Node 24's built-in `node:sqlite` API without changing the SQLite file format or the public contracts of the database modules.

**Architecture:** A single `DatabaseSync` connection remains owned by `database/connection.js`; every SQL call site is converted directly to `prepare().get/all/run()` or `exec()`, with no callback-compatibility facade. Schema initialization becomes an explicit readiness boundary, and transaction-heavy modules use synchronous `BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK` blocks while preserving their existing exported Promise contracts.

**Tech Stack:** Node.js 24 LTS, CommonJS, built-in `node:sqlite`, SQLite WAL, Vitest, Docker Alpine

---

## File map and conversion rules

- `database/connection.js`: owns `DatabaseSync`, applies pragmas, closes test connections.
- `database/schema.js`: performs schema creation/migration synchronously and exports readiness.
- `database/index.js`: initializes once and exports `ready` alongside the existing API.
- `database/*.js`: core user, economy, timer, social, logging, and external data access.
- `database/games/*.js`: game/economy access, including all transaction-sensitive paths.
- `controllers/levelingController.js`, `controllers/backupController.js`, `services/apiDataService.js`, `controllers/gameController.js`, `create_superadmin.js`: direct legacy-driver consumers.
- `server.js`: awaits database readiness before listening or starting cron/socket work.
- `tests/database/`: focused connection, readiness, transaction, existing-file, and backup tests.

Use these exact native conversions throughout:

```js
// One row
const row = db.prepare(sql).get(...params);

// Many rows
const rows = db.prepare(sql).all(...params);

// Write metadata
const result = db.prepare(sql).run(...params);
return {
  lastID: Number(result.lastInsertRowid),
  changes: Number(result.changes),
};

// Prepared statement reused in a loop
const statement = db.prepare(sql);
for (const values of rowsToInsert) statement.run(...values);

// Transaction
db.exec('BEGIN IMMEDIATE');
try {
  // native synchronous statements only
  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}
```

Bound parameter arrays must always be spread (`...params`). Dynamic SQL identifiers must continue to come from existing internal allowlists. Do not interpolate request values.

### Task 1: Pin Node 24 and establish native-driver contract tests

**Files:**
- Create: `.nvmrc`
- Modify: `package.json`
- Modify: `Dockerfile`
- Create: `tests/database/nodeSqliteContract.test.js`

- [ ] **Step 1: Write the failing runtime and API contract test**

Create `tests/database/nodeSqliteContract.test.js`:

```js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

test('node:sqlite supports the database operations required by the app', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'koala-node-sqlite-'));
  const filename = path.join(directory, 'contract.db');
  const database = new DatabaseSync(filename);

  try {
    database.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, label TEXT NOT NULL)');
    const insert = database.prepare('INSERT INTO items (label) VALUES (?)').run('alpha');
    assert.equal(Number(insert.lastInsertRowid), 1);
    assert.equal(Number(insert.changes), 1);
    assert.deepEqual(database.prepare('SELECT * FROM items WHERE id = ?').get(1), { id: 1, label: 'alpha' });
    assert.deepEqual(database.prepare('SELECT * FROM items ORDER BY id').all(), [{ id: 1, label: 'alpha' }]);
  } finally {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Verify the contract test fails on the unsupported baseline**

Run: `npm test -- tests/database/nodeSqliteContract.test.js`

Expected: On Node below 22.5, fail with `ERR_UNKNOWN_BUILTIN_MODULE`; on Node 24, pass and establish the required API contract. Record `node --version` in the task notes.

- [ ] **Step 3: Declare Node 24 consistently**

Create `.nvmrc` containing:

```text
24
```

Add to `package.json`:

```json
"engines": {
  "node": ">=24 <25"
}
```

Change both Docker stages from `node:20-alpine` to `node:24.17.0-alpine`. Node 24.17.0 is the security release published on 2026-06-17; do not use a floating major tag.

- [ ] **Step 4: Verify runtime declarations and contract**

Run:

```bash
node --version
npm test -- tests/database/nodeSqliteContract.test.js
rg -n 'FROM node:' Dockerfile
```

Expected: Node reports v24.x for local execution, the contract test passes, and both Docker stages use the identical pinned Node 24 patch.

- [ ] **Step 5: Commit**

```bash
git add .nvmrc package.json Dockerfile tests/database/nodeSqliteContract.test.js
git commit -m "build: require Node 24 for native sqlite"
```

### Task 2: Replace connection ownership and make schema readiness deterministic

**Files:**
- Modify: `database/connection.js`
- Modify: `database/schema.js`
- Modify: `database/index.js`
- Modify: `server.js`
- Create: `tests/database/connection.test.js`
- Create: `tests/database/readiness.test.js`

- [ ] **Step 1: Write failing connection tests**

Create `tests/database/connection.test.js`:

```js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDatabaseConnection } = require('../../database/connection');

test('createDatabaseConnection applies required pragmas', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'koala-connection-'));
  const filename = path.join(directory, 'connection.db');
  const database = createDatabaseConnection(filename);

  try {
    assert.equal(database.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
    assert.equal(database.prepare('PRAGMA busy_timeout').get().timeout, 5000);
    assert.equal(database.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
  } finally {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the connection test and confirm the missing factory**

Run: `npm test -- tests/database/connection.test.js`

Expected: FAIL because `createDatabaseConnection` is not exported.

- [ ] **Step 3: Implement the native connection factory**

Rewrite `database/connection.js` around this interface:

```js
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

function createDatabaseConnection(filename) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const database = new DatabaseSync(filename);
  database.exec('PRAGMA journal_mode=WAL');
  database.exec('PRAGMA synchronous=NORMAL');
  database.exec('PRAGMA temp_store=MEMORY');
  database.exec('PRAGMA foreign_keys=ON');
  database.exec('PRAGMA busy_timeout=5000');
  database.exec('PRAGMA cache_size=-20000');
  database.exec('PRAGMA mmap_size=536870912');
  return database;
}

const dbFilePath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'timerapp.db');
const db = createDatabaseConnection(dbFilePath);

module.exports = db;
module.exports.createDatabaseConnection = createDatabaseConnection;
module.exports.dbFilePath = dbFilePath;
```

- [ ] **Step 4: Write a failing readiness test**

Create `tests/database/readiness.test.js`:

```js
const assert = require('node:assert/strict');
const dbLayer = require('../../database');

test('database readiness resolves only after required schema exists', async () => {
  await dbLayer.ready;
  const columns = dbLayer.db.prepare('PRAGMA table_info(Users)').all();
  assert(columns.some((column) => column.name === 'id'));
});
```

- [ ] **Step 5: Convert schema initialization to one synchronous operation**

In `database/schema.js`:

- Change the entry point to `function initializeDatabaseSchema(database = db)` and use the injected `database` argument for every schema statement so compatibility tests can initialize isolated files.
- Replace callback `db.run/get/all/prepare/serialize` calls with native statements.
- Replace “ignore duplicate column” callbacks with a `hasColumn(table, column)` check based on `PRAGMA table_info` before `ALTER TABLE`.
- Keep migration order unchanged.
- Make `initializeDatabaseSchema()` throw on mandatory migration failure instead of logging and continuing.
- Ensure Wordle seeding completes synchronously inside initialization; do not leave retry timers or secondary callback connections.

Export:

```js
module.exports = { initializeDatabaseSchema };
```

In `database/index.js` initialize exactly once:

```js
let initializationError;
try {
  initializeDatabaseSchema(db);
} catch (error) {
  initializationError = error;
}

const ready = initializationError
  ? Promise.reject(initializationError)
  : Promise.resolve();

module.exports = {
  db,
  ready,
  // existing exports remain unchanged
};
```

Attach a rejection handler immediately or construct readiness through an async startup function so module loading cannot produce an unhandled rejection before `server.js` awaits it.

- [ ] **Step 6: Gate server startup on readiness**

Refactor the bottom of `server.js` into:

```js
async function startServer() {
  await dbLayer.ready;
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, () => {
      server.off('error', reject);
      dbLayer.logSystemEvent('info', 'System', `Server listening on port ${PORT}`);
      apiController.initializeEsportsDb();
      startCron();
      startLottoCron(io);
      startRssCron();
      startBackupCron();
      resolve(server);
    });
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    originalConsoleError('Database initialization failed:', error);
    process.exitCode = 1;
  });
}

module.exports = { app, server, startServer };
```

- [ ] **Step 7: Verify connection and initialization**

Run:

```bash
npm test -- tests/database/connection.test.js tests/database/readiness.test.js tests/chipSkinDb.test.js
```

Expected: all selected files pass repeatedly, including three consecutive readiness runs.

- [ ] **Step 8: Commit**

```bash
git add database/connection.js database/schema.js database/index.js server.js tests/database/connection.test.js tests/database/readiness.test.js
git commit -m "refactor: initialize database with node sqlite"
```

### Task 3: Migrate simple core database modules

**Files:**
- Modify: `database/logging.js`
- Modify: `database/social.js`
- Modify: `database/timers.js`
- Modify: `database/utils.js`
- Modify: `tests/timer/timerLifecycleService.test.js`
- Create: `tests/database/coreModules.test.js`

- [ ] **Step 1: Add focused public-contract tests**

Create `tests/database/coreModules.test.js` using unique IDs and `await dbLayer.ready`. Cover one read, insert, update, and delete through exported functions, and assert Promise contracts:

```js
const assert = require('node:assert/strict');
const dbLayer = require('../../database');

test('timer completion retains its Promise contract and numeric insert id', async () => {
  await dbLayer.ready;
  const userId = `node-sqlite-user-${Date.now()}`;
  const roomId = `node-sqlite-room-${Date.now()}`;
  dbLayer.db.prepare('INSERT INTO Users (id, displayName, username) VALUES (?, ?, ?)')
    .run(userId, 'Migration User', userId);

  try {
    const resultPromise = dbLayer.recordTimerCompletion(userId, roomId, 'Migration Room', 5);
    assert(resultPromise instanceof Promise);
    const eventId = await resultPromise;
    assert.equal(typeof eventId, 'number');
  } finally {
    dbLayer.db.prepare('DELETE FROM TimerEvents WHERE userId = ?').run(userId);
    dbLayer.db.prepare('DELETE FROM Users WHERE id = ?').run(userId);
  }
});
```

- [ ] **Step 2: Confirm tests fail where callback methods remain**

Run: `npm test -- tests/database/coreModules.test.js tests/timer/timerLifecycleService.test.js`

Expected: FAIL with missing `db.run/get/all/serialize` methods after Task 2.

- [ ] **Step 3: Convert logging, social, timers, and utilities directly**

For each exported function:

- Remove `new Promise((resolve, reject) => db.get/all/run(...))` wrappers when the public function can remain `async` and return the native result directly.
- Keep `async` on functions previously returning Promises.
- Map empty result sets to the same previous fallback (`[]`, `null`, or `undefined`).
- Convert timer-room deletion to a synchronous transaction with rollback.
- Preserve `lastID` and `changes` names at public boundaries.

Example:

```js
async function deleteTimerEvent(id) {
  const result = db.prepare('DELETE FROM TimerEvents WHERE id = ?').run(id);
  return Number(result.changes);
}
```

- [ ] **Step 4: Verify focused core tests**

Run:

```bash
npm test -- tests/database/coreModules.test.js tests/timer/timerLifecycleService.test.js tests/timer/roomManagerTimer.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add database/logging.js database/social.js database/timers.js database/utils.js tests/database/coreModules.test.js tests/timer/timerLifecycleService.test.js
git commit -m "refactor: migrate core database modules to node sqlite"
```

### Task 4: Migrate users, economy, and external-data modules

**Files:**
- Modify: `database/users.js`
- Modify: `database/economy.js`
- Modify: `database/external.js`
- Create: `tests/database/usersEconomy.test.js`

- [ ] **Step 1: Add balance rollback and user-shape tests**

Create `tests/database/usersEconomy.test.js` with isolated users. Assert existing exported method names and return shapes discovered in `database/index.js`:

```js
const assert = require('node:assert/strict');
const dbLayer = require('../../database');

test('failed economic mutation leaves the user balance unchanged', async () => {
  await dbLayer.ready;
  const userId = `economy-rollback-${Date.now()}`;
  dbLayer.db.prepare('INSERT INTO Users (id, displayName, username, koala_balance) VALUES (?, ?, ?, ?)')
    .run(userId, 'Rollback User', userId, 100);
  dbLayer.db.exec(`
    CREATE TEMP TRIGGER force_koala_transaction_failure
    BEFORE INSERT ON KoalaTransactions
    WHEN NEW.reason = 'force rollback'
    BEGIN
      SELECT RAISE(ABORT, 'forced transaction failure');
    END
  `);

  try {
    const before = dbLayer.db.prepare('SELECT koala_balance FROM Users WHERE id = ?').get(userId);
    await assert.rejects(
      () => dbLayer.addKoalaCoins(userId, 50, 'force rollback'),
      /forced transaction failure/
    );
    const after = dbLayer.db.prepare('SELECT koala_balance FROM Users WHERE id = ?').get(userId);
    assert.equal(after.koala_balance, before.koala_balance);
  } finally {
    dbLayer.db.exec('DROP TRIGGER IF EXISTS force_koala_transaction_failure');
    dbLayer.db.prepare('DELETE FROM KoalaTransactions WHERE user_id = ?').run(userId);
    dbLayer.db.prepare('DELETE FROM Users WHERE id = ?').run(userId);
  }
});
```

- [ ] **Step 2: Run focused tests to expose remaining callback paths**

Run: `npm test -- tests/database/usersEconomy.test.js tests/blackjackEconomy.test.js`

Expected: FAIL on the first unconverted native connection call.

- [ ] **Step 3: Convert users and economy**

Convert all calls directly, retaining validation and public Promise contracts. For multi-write balance operations use:

```js
db.exec('BEGIN IMMEDIATE');
try {
  const user = db.prepare('SELECT koala_balance FROM Users WHERE id = ?').get(userId);
  if (!user) throw new Error('User not found');
  // existing validation and writes
  db.exec('COMMIT');
  const updated = db.prepare(
    'SELECT CAST(koala_balance AS INTEGER) AS koala_balance FROM Users WHERE id = ?'
  ).get(userId);
  return updated ? Number(updated.koala_balance) : 0;
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}
```

No transaction may resolve a Promise before commit or perform an `await` while open.

- [ ] **Step 4: Convert `database/external.js` in coherent sections**

Migrate settings, news/esports cache, countdown, feature-request, RSS, and configuration functions section by section. After each section run `npm test -- tests/database/usersEconomy.test.js tests/integration/roulette.integration.test.js`; add a focused assertion to `usersEconomy.test.js` before converting a section that those tests do not exercise. Preserve JSON parsing via `safeJsonParse` and retain existing defaults.

Use this exact read pattern:

```js
async function readRows(sql, params = []) {
  return db.prepare(sql).all(...params);
}
```

Keep helpers local to `external.js`; do not create a legacy-driver facade.

- [ ] **Step 5: Verify users/economy/external behavior**

Run:

```bash
npm test -- tests/database/usersEconomy.test.js tests/blackjackEconomy.test.js tests/integration/roulette.integration.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add database/users.js database/economy.js database/external.js tests/database/usersEconomy.test.js
git commit -m "refactor: migrate user and economy storage to node sqlite"
```

### Task 5: Migrate non-transactional game modules and chip skins

**Files:**
- Modify: `database/games/chipSkins.js`
- Modify: `database/games/scores.js`
- Modify: `database/games/speedcube.js`
- Modify: `database/games/index.js`
- Modify: `tests/chipSkinDb.test.js`
- Modify: `tests/chipSkinController.test.js`
- Create: `tests/database/gameModules.test.js`

- [ ] **Step 1: Convert test helpers first and verify red state**

Replace legacy test wrappers with native statements only after adding an assertion that public methods still return Promises:

```js
function all(sql, params = []) {
  return dbLayer.db.prepare(sql).all(...params);
}

function run(sql, params = []) {
  const result = dbLayer.db.prepare(sql).run(...params);
  return {
    lastID: Number(result.lastInsertRowid),
    changes: Number(result.changes),
  };
}
```

Run: `npm test -- tests/chipSkinDb.test.js tests/chipSkinController.test.js`

Expected: FAIL until the production chip-skin module is converted.

- [ ] **Step 2: Convert chip skins, scores, and speedcube**

Apply direct `prepare` calls, retain current validation, and normalize BigInt write metadata only at public boundaries. Ensure asset upserts and grants preserve their existing object shapes.

- [ ] **Step 3: Add and run focused game-module tests**

Create `tests/database/gameModules.test.js` covering score insert/read and speedcube insert/update/delete using unique users. Clean rows in `finally` blocks with native statements.

Run:

```bash
npm test -- tests/database/gameModules.test.js tests/chipSkinDb.test.js tests/chipSkinController.test.js
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add database/games/chipSkins.js database/games/scores.js database/games/speedcube.js database/games/index.js tests/chipSkinDb.test.js tests/chipSkinController.test.js tests/database/gameModules.test.js
git commit -m "refactor: migrate game records to node sqlite"
```

### Task 6: Migrate transaction-heavy game modules

**Files:**
- Modify: `database/games/blackjack.js`
- Modify: `database/games/fortune.js`
- Modify: `database/games/idle.js`
- Modify: `database/games/lotto.js`
- Modify: `database/games/scratchcards.js`
- Modify: `database/games/tower.js`
- Modify: `database/games/upgrades.js`
- Modify: `database/games/wordle.js`
- Modify: `tests/blackjackEconomy.test.js`
- Create: `tests/database/gameTransactions.test.js`

- [ ] **Step 1: Add transaction commit/rollback tests before conversion**

Create `tests/database/gameTransactions.test.js`. For blackjack, tower, lotto, scratchcards, idle upgrades, and Wordle, cover at least one success and one validation/constraint failure. For every failure, snapshot all affected balances, inventory/round rows, and transaction counts before the call and assert equality afterward.

Use the reusable test-only snapshot helper:

```js
function snapshotUserEconomy(userId) {
  return {
    user: dbLayer.db.prepare('SELECT koala_balance FROM Users WHERE id = ?').get(userId),
    transactions: dbLayer.db.prepare(
      'SELECT amount, reason FROM KoalaTransactions WHERE user_id = ? ORDER BY id'
    ).all(userId),
  };
}
```

- [ ] **Step 2: Run transaction tests and confirm red state**

Run: `npm test -- tests/database/gameTransactions.test.js tests/blackjackEconomy.test.js`

Expected: FAIL on legacy calls after the native connection change.

- [ ] **Step 3: Convert one transactional module at a time**

For each module:

1. Convert pure reads.
2. Convert single writes and metadata.
3. Rewrite each `serialize`/callback transaction into one synchronous `BEGIN IMMEDIATE` block.
4. Ensure all validation happens before irreversible writes where possible.
5. Run only that module's focused transaction test.

Never nest transactions. Where a public operation calls another function that starts a transaction, extract a private “inside transaction” statement function and let the outer operation own commit/rollback.

- [ ] **Step 4: Verify all economic game paths**

Run:

```bash
npm test -- tests/database/gameTransactions.test.js tests/blackjackEconomy.test.js tests/blackjackSettlement.test.js tests/blackjackRoundFlow.test.js tests/integration/roulette.integration.test.js
```

Expected: PASS with no balance or inventory differences after forced failures.

- [ ] **Step 5: Commit**

```bash
git add database/games/blackjack.js database/games/fortune.js database/games/idle.js database/games/lotto.js database/games/scratchcards.js database/games/tower.js database/games/upgrades.js database/games/wordle.js tests/blackjackEconomy.test.js tests/database/gameTransactions.test.js
git commit -m "refactor: migrate game transactions to node sqlite"
```

### Task 7: Remove direct legacy consumers and verify backup compatibility

**Files:**
- Modify: `controllers/levelingController.js`
- Modify: `controllers/backupController.js`
- Modify: `controllers/gameController.js`
- Modify: `services/apiDataService.js`
- Modify: `create_superadmin.js`
- Modify: `scratch/test_db_init.js`
- Modify: `scratch/test_db_migration.js`
- Create: `tests/database/backupCompatibility.test.js`
- Create: `tests/database/existingFileCompatibility.test.js`

- [ ] **Step 1: Add an existing-file compatibility test**

Create `tests/database/existingFileCompatibility.test.js` that copies a fixture database into a temporary directory, opens it with `createDatabaseConnection`, runs `initializeDatabaseSchema(database)` using dependency injection, verifies representative user/timer/game rows, performs a transactionally reversible insert, and confirms the original fixture remains unchanged.

Create the fixture during test setup with the pre-migration schema SQL and deterministic synthetic rows. Never copy a developer or production database.

- [ ] **Step 2: Add a backup test**

Create `tests/database/backupCompatibility.test.js`:

```js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDatabaseConnection } = require('../../database/connection');

test('VACUUM INTO creates a readable independent backup', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'koala-backup-'));
  const source = createDatabaseConnection(path.join(directory, 'source.db'));
  const destination = path.join(directory, 'backup.db');

  try {
    source.exec('CREATE TABLE marker (value TEXT NOT NULL)');
    source.prepare('INSERT INTO marker (value) VALUES (?)').run('safe');
    source.prepare('VACUUM INTO ?').run(destination);
    const backup = createDatabaseConnection(destination);
    try {
      assert.equal(backup.prepare('SELECT value FROM marker').get().value, 'safe');
    } finally {
      backup.close();
    }
  } finally {
    source.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
```

- [ ] **Step 3: Convert every direct consumer**

Replace `dbLayer.db.run/get/all/prepare/serialize` and `db.db.*` in the listed files with native statement calls. Preserve controller response timing and error handling. Make `create_superadmin.js` await `dbLayer.ready`, perform its write, report the outcome, and close only when run as a standalone process.

Delete `scratch/test_db_init.js` and `scratch/test_db_migration.js`; the repository search performed during planning confirmed that neither script has a caller.

- [ ] **Step 4: Verify compatibility and direct consumers**

Run:

```bash
npm test -- tests/database/existingFileCompatibility.test.js tests/database/backupCompatibility.test.js tests/chipSkinController.test.js
rg -n '\.(run|get|all|prepare|serialize)\([^;]*,\s*(function|\([^)]*\)\s*=>)' controllers services create_superadmin.js scratch
```

Expected: tests pass and the search returns no legacy callback-style database calls.

- [ ] **Step 5: Commit**

```bash
git add controllers/levelingController.js controllers/backupController.js controllers/gameController.js services/apiDataService.js create_superadmin.js scratch tests/database/backupCompatibility.test.js tests/database/existingFileCompatibility.test.js
git commit -m "refactor: remove remaining sqlite3 consumers"
```

### Task 8: Remove `sqlite3`, audit, and verify the complete system

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.dockerignore` only if Docker validation reveals missing exclusions

- [ ] **Step 1: Prove no legacy imports or methods remain**

Run:

```bash
rg -n "require\(['\"]sqlite3|from ['\"]sqlite3|sqlite3\.verbose|new sqlite3\.Database|\.serialize\(" . --glob '!node_modules/**' --glob '!docs/**'
```

Expected: no production, test, or retained-script matches.

- [ ] **Step 2: Remove the dependency with npm**

Run:

```bash
npm uninstall sqlite3
npm install
npm ls sqlite3 node-gyp tar
```

Expected: `sqlite3` is absent. Any remaining `node-gyp` or `tar` path must be inspected and classified rather than assumed safe.

- [ ] **Step 3: Run the complete automated verification**

Run:

```bash
npm test
npm run build
npm audit --omit=dev
git diff --check
```

Expected: all tests pass, Vite build succeeds, production audit reports zero high or critical vulnerabilities, and the diff has no whitespace errors.

- [ ] **Step 4: Build and smoke-test the Node 24 container**

Run:

```bash
docker build -t koalaweb:node24-sqlite .
docker run --rm -d --name koalaweb-node24-sqlite -p 3301:3001 -v koalaweb-node24-test:/app/data koalaweb:node24-sqlite
curl --fail --retry 10 --retry-delay 1 http://127.0.0.1:3301/api/rooms
docker logs koalaweb-node24-sqlite
docker stop koalaweb-node24-sqlite
docker volume rm koalaweb-node24-test
```

Expected: image builds, server starts after schema readiness, API responds successfully, logs contain no initialization error, and the temporary container/volume are removed.

- [ ] **Step 5: Review performance-sensitive statements**

Search for unbounded result sets and transaction loops:

```bash
rg -n 'SELECT \*|\.all\(|BEGIN IMMEDIATE' database controllers services
```

For each request-path `.all()` without `LIMIT`, confirm the result is intentionally bounded by table semantics or add an existing-behavior-preserving limit only after a focused test. Record any genuine performance follow-up separately; do not broaden this migration.

- [ ] **Step 6: Commit final dependency and verification changes**

```bash
git add package.json package-lock.json .nvmrc Dockerfile database controllers services tests create_superadmin.js scratch
git commit -m "build: remove deprecated sqlite3 dependency"
```

### Task 9: Final regression and handoff

**Files:**
- No planned code changes

- [ ] **Step 1: Run a fresh-install verification**

In a disposable worktree or clean container run:

```bash
npm ci
npm test
npm run build
npm audit --omit=dev
```

Expected: installation succeeds using Node 24 without compiling or downloading the old `sqlite3` add-on; tests and build pass; no high or critical production audit findings remain.

- [ ] **Step 2: Validate repository state**

Run:

```bash
git status --short
git log --oneline --decorate -12
git diff main...HEAD --check
git diff --stat main...HEAD
```

Expected: worktree is clean, commits correspond to the task boundaries, and the final diff contains only the migration scope.

- [ ] **Step 3: Use verification and branch-finishing workflows**

Invoke `superpowers:verification-before-completion`, then `superpowers:finishing-a-development-branch`. Present merge, PR, keep, and discard options only after fresh verification succeeds.
