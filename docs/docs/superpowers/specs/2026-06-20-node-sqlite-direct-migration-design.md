# Direct `node:sqlite` Migration Design

**Date:** 2026-06-20

## Objective

Replace the deprecated and unmaintained `sqlite3` npm package with Node.js' built-in `node:sqlite` module. The application will require Node.js 24 LTS, retain the existing SQLite database file and schema, and preserve the public contracts of the database modules while removing the legacy callback driver completely.

## Scope

The migration covers every production and test reference to `sqlite3`, including database initialization, schema migrations, prepared statements, transactions, backups, controllers that access the connection directly, cron jobs, sockets, command-line scripts, and database tests.

The migration does not redesign the schema, move to another database engine, change application features, or combine the work with a Vite major-version upgrade. Scratch-only scripts may be migrated or removed if they are still useful, but no production code may retain the old driver.

## Runtime Baseline

Node.js 24 LTS becomes mandatory and is declared consistently:

- Docker builder and runtime images use a pinned Node 24 Alpine release.
- `package.json` declares the supported Node engine.
- `.nvmrc` provides the local development version.
- Dependency installation and CI fail clearly on unsupported Node versions.

The `sqlite3` dependency is removed. Production database access uses only `node:sqlite` and therefore no longer depends on the old native add-on, its bundled `node-gyp`, or its vulnerable `tar` chain.

## Architecture

`database/connection.js` owns a single `DatabaseSync` connection to the existing database path. It applies the current WAL, synchronous, temporary storage, foreign-key, busy-timeout, cache, and memory-map pragmas before exposing the connection.

Database modules use the built-in API directly:

- `database.prepare(sql).get(...params)` for one row.
- `database.prepare(sql).all(...params)` for result sets.
- `database.prepare(sql).run(...params)` for writes.
- `database.exec(sql)` for fixed multi-statement schema operations.
- `lastInsertRowid` and `changes` replace callback-bound `this.lastID` and `this.changes`.

There is no general callback-compatibility adapter. Each call site is converted to the native synchronous statement API. Public database-module functions keep their existing observable return contract: Promise-returning functions remain Promise-returning, synchronous functions remain synchronous, and returned object shapes do not change. Controllers, sockets, services, and cron jobs change only where they directly use the legacy connection API.

## Initialization

Opening the database or applying mandatory pragmas is fail-fast. The server must not continue with a missing or partially initialized database.

Schema creation and data migrations expose one shared readiness Promise. Server startup awaits it before accepting requests or socket connections. Tests await the same readiness boundary. This removes timing-dependent schema access and makes initialization failures observable.

The database file path remains controlled by `DB_PATH`, with the current local fallback retained. The SQLite file format and all existing data remain compatible.

## Transactions and Concurrency

Transactions are rewritten as explicit synchronous blocks:

```js
database.exec('BEGIN IMMEDIATE');
try {
  // related statements
  database.exec('COMMIT');
} catch (error) {
  database.exec('ROLLBACK');
  throw error;
}
```

Each block guarantees rollback on failure and preserves the original error. Transaction boundaries must not contain `await`, timers, network operations, or callbacks. Existing WAL and busy-timeout configuration remains in place.

Because `DatabaseSync` runs on the Node.js event loop, statements must remain short and local. Existing potentially expensive queries are identified during migration. No request path may add filesystem reads, remote calls, or unbounded loops inside a transaction. Moving database access to worker threads is outside this migration unless measurement shows a concrete blocking regression.

## Parameter Binding and Security

User-controlled values remain bound parameters. SQL identifiers that cannot be bound, such as dynamic column names or sort keys, must originate from explicit internal allowlists. The migration must not replace placeholders with string interpolation.

Backup destinations passed to `VACUUM INTO` are validated and bound where supported by SQLite. Database errors are propagated to existing application-level error handlers without leaking SQL or filesystem details to clients.

## Migration Sequence

The direct conversion proceeds in reviewable groups:

1. Runtime declaration, connection ownership, initialization boundary, and connection tests.
2. Schema creation and migration code.
3. Core user, room, timer, social, and settings modules.
4. Game and economy modules, with special attention to transactional balance updates.
5. Direct consumers in controllers, services, sockets, cron jobs, and administrative scripts.
6. Backup/restore behavior and test utilities.
7. Removal of `sqlite3`, clean installation, audit, Docker validation, and full regression verification.

Every group uses test-first changes and receives its own commit. Mechanical conversion must not include unrelated cleanup.

## Verification

Verification includes:

- Connection tests for file opening, pragmas, parameter binding, `get`, `all`, `run`, and write metadata.
- Initialization tests proving callers cannot observe a partially migrated schema.
- Transaction tests proving commit and rollback behavior for balance- and inventory-sensitive operations.
- A compatibility test that copies an existing SQLite fixture, initializes it with `node:sqlite`, and verifies representative reads and writes without schema or data loss.
- Backup tests for `VACUUM INTO` and reopening the generated file.
- Existing project tests after every migration group and the complete test suite at the end.
- A successful production frontend build.
- A successful Node 24 Docker image build and server/database smoke test.
- `npm audit --omit=dev` with zero high or critical findings.
- A repository search proving no production or test import of the `sqlite3` package remains.

The known low-severity Vite/esbuild development-server advisory is handled separately. It does not block this database migration when production audit results contain no high or critical findings.

## Rollout and Rollback

Before deployment, create and verify a database backup. Deployment replaces the runtime and application code but does not transform the SQLite file format. Health checks must cover server startup, schema readiness, a representative read, and a reversible write.

If rollout fails, stop the new process and deploy the previous application image. The original database file remains usable by the previous driver. Restore the backup only if the health checks or application logs show an actual data mutation problem.

## Success Criteria

- Production and development use Node.js 24 LTS.
- `sqlite3` is absent from `package.json`, the lockfile, imports, and installed dependency tree.
- All database behavior is implemented with `node:sqlite`.
- Existing database-module public contracts and application behavior remain stable.
- Initialization is deterministic and fail-fast.
- Transaction rollback behavior is covered by tests.
- Existing databases and backups remain readable and writable.
- Tests, production build, Docker smoke test, and security audit meet the verification requirements.
