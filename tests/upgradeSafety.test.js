const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const nodeGuardPath = path.join(repoRoot, 'scripts', 'require-node-24.js');
const migrationPath = path.join(repoRoot, 'scripts', 'migrate-v3-layout.js');

test('Node 24 guard exposes an exact-major compatibility check', () => {
  assert.ok(fs.existsSync(nodeGuardPath), 'scripts/require-node-24.js must exist');
  const { checkNodeVersion } = require(nodeGuardPath);

  assert.deepEqual(checkNodeVersion('v24.16.0'), { ok: true, major: 24 });
  assert.deepEqual(checkNodeVersion('v20.19.0'), { ok: false, major: 20 });
  assert.deepEqual(checkNodeVersion('invalid'), { ok: false, major: null });
});

test('legacy layout migration moves data and environment without overwriting conflicts', () => {
  assert.ok(fs.existsSync(migrationPath), 'scripts/migrate-v3-layout.js must exist');
  const { migrateLegacyLayout } = require(migrationPath);
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koala-v3-migration-'));
  const legacyDir = path.join(rootDir, 'shared-timer-app');
  const messages = [];

  try {
    fs.mkdirSync(path.join(legacyDir, 'data'), { recursive: true });
    fs.mkdirSync(path.join(rootDir, 'data'), { recursive: true });
    fs.writeFileSync(path.join(legacyDir, '.env'), 'JWT_SECRET=legacy\n');
    fs.writeFileSync(path.join(legacyDir, 'data', 'timer.db'), 'legacy-db');
    fs.writeFileSync(path.join(legacyDir, 'data', 'keep.db'), 'legacy-keep');
    fs.writeFileSync(path.join(rootDir, 'data', 'keep.db'), 'current-keep');

    const first = migrateLegacyLayout({ rootDir, logger: message => messages.push(message) });

    assert.equal(fs.readFileSync(path.join(rootDir, '.env'), 'utf8'), 'JWT_SECRET=legacy\n');
    assert.equal(fs.readFileSync(path.join(rootDir, 'data', 'timer.db'), 'utf8'), 'legacy-db');
    assert.equal(fs.readFileSync(path.join(rootDir, 'data', 'keep.db'), 'utf8'), 'current-keep');
    assert.equal(fs.readFileSync(path.join(legacyDir, 'data', 'keep.db'), 'utf8'), 'legacy-keep');
    assert.deepEqual(first.moved.sort(), ['.env', 'data/timer.db']);
    assert.deepEqual(first.conflicts, ['data/keep.db']);
    assert.ok(messages.some(message => message.includes('data/keep.db')));

    const second = migrateLegacyLayout({ rootDir, logger: () => {} });
    assert.deepEqual(second.moved, []);
    assert.deepEqual(second.conflicts, ['data/keep.db']);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('package lifecycle, Compose image, and upgrade documentation enforce the v3 contract', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const compose = fs.readFileSync(path.join(repoRoot, 'docker-compose.yml'), 'utf8');
  const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');

  assert.equal(packageJson.scripts.preinstall, 'node scripts/require-node-24.js');
  assert.match(packageJson.scripts.prestart, /require-node-24\.js/);
  assert.match(packageJson.scripts.prestart, /migrate-v3-layout\.js/);
  assert.match(compose, /image:\s*ghcr\.io\/shik3i\/antigrav:latest/);
  assert.match(readme, /Node\.js 24/);
  assert.match(readme, /node scripts\/migrate-v3-layout\.js/);
  assert.match(readme, /docker compose build --pull/);
});
