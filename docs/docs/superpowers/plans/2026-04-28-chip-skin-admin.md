# Chip Skin Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin-managed casino chip skin system with file-based PNG assets, SQLite metadata, release-date visibility, rarity, and manual user grants.

**Architecture:** Store uploaded chip images under `data/chip-skins/<slug>/<value>.png` and store metadata/grants in SQLite. Add backend services/controllers/routes for admin and user visibility, then update the settings and casino chip rendering paths to consume a unified static-plus-managed skin catalog.

**Tech Stack:** Express 5, SQLite3, React 19, axios, Jest, existing CSS/components, no new upload dependency. PNG upload uses JSON `{ value, fileName, dataUrl }` to keep the first version small.

---

## File Structure

- Modify: `database/schema.js` - create `chip_skins`, `chip_skin_assets`, `chip_skin_grants`.
- Create: `database/games/chipSkins.js` - DB API for metadata, validation, grants, and user-visible catalog.
- Modify: `database/games/index.js` - export chip skin DB functions.
- Create: `controllers/chipSkinController.js` - HTTP handlers, PNG Data URL validation, filesystem writes, asset route.
- Modify: `routes/api.js` - mount admin/user chip skin endpoints.
- Modify: `src/features/casino/chipConfig.js` - expose built-in skin metadata and catalog helpers.
- Modify: `src/features/casino/ChipSkinContext.jsx` - fetch user-visible skins and provide image lookup.
- Modify: `src/pages/Settings.jsx` - render available skins from context and fallback unavailable selections.
- Create: `src/components/admin/ChipSkinsTab.jsx` - admin UI for CRUD, uploads, preview, grants.
- Modify: `src/pages/Admin.jsx` - add tab state, fetch/save handlers, tab button, and component.
- Modify: `src/features/blackjack/components/ChipStack.jsx` - render managed skin images.
- Modify: `src/features/blackjack/components/BlackjackSeat.jsx` - render managed skin images for player bets.
- Modify: `src/features/roulette/components/RouletteBettingTable.jsx` - render managed skin images for table bets.
- Modify: `src/features/roulette/components/RouletteChipSelector.jsx` - render managed skin images for selected chip.
- Create: `tests/chipSkinDb.test.js` - DB behavior and visibility filtering.
- Create: `tests/chipSkinController.test.js` - upload validation and asset path safety.
- Create: `tests/chipSkinFrontend.test.js` - source-level regression checks for context/UI integration.

## Task 1: Database Schema

**Files:**
- Modify: `database/schema.js`
- Test: `tests/chipSkinDb.test.js`

- [ ] **Step 1: Write the failing schema test**

Create `tests/chipSkinDb.test.js` with this initial test:

```js
const assert = require('assert');
const dbLayer = require('../database');

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    dbLayer.db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

test('chip skin tables exist with required columns', async () => {
  const skinsColumns = await all('PRAGMA table_info(chip_skins)');
  const assetsColumns = await all('PRAGMA table_info(chip_skin_assets)');
  const grantsColumns = await all('PRAGMA table_info(chip_skin_grants)');

  assert(skinsColumns.some((col) => col.name === 'release_date'), 'chip_skins.release_date is required');
  assert(skinsColumns.some((col) => col.name === 'rarity'), 'chip_skins.rarity is required');
  assert(skinsColumns.some((col) => col.name === 'status'), 'chip_skins.status is required');
  assert(assetsColumns.some((col) => col.name === 'chip_value'), 'chip_skin_assets.chip_value is required');
  assert(grantsColumns.some((col) => col.name === 'user_id'), 'chip_skin_grants.user_id is required');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/chipSkinDb.test.js --runInBand`

Expected: FAIL because `chip_skins`, `chip_skin_assets`, or `chip_skin_grants` do not exist.

- [ ] **Step 3: Add schema tables**

In `database/schema.js`, inside `initializeDatabaseSchema()` after `ServerSettings`, add:

```js
    db.run(`CREATE TABLE IF NOT EXISTS chip_skins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      rarity TEXT NOT NULL DEFAULT 'common',
      release_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CHECK(status IN ('draft', 'public', 'restricted', 'disabled')),
      CHECK(rarity IN ('common', 'rare', 'epic', 'legendary', 'limited', 'exclusive'))
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS chip_skin_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skin_id INTEGER NOT NULL,
      chip_value INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      original_filename TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(skin_id) REFERENCES chip_skins(id) ON DELETE CASCADE,
      UNIQUE(skin_id, chip_value),
      CHECK(chip_value IN (1, 5, 10, 25, 50, 100, 500, 1000))
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS chip_skin_grants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skin_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      granted_by TEXT,
      FOREIGN KEY(skin_id) REFERENCES chip_skins(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE,
      UNIQUE(skin_id, user_id)
    )`);

    db.run('CREATE INDEX IF NOT EXISTS idx_chip_skins_status_release ON chip_skins(status, release_date)');
    db.run('CREATE INDEX IF NOT EXISTS idx_chip_skin_grants_user ON chip_skin_grants(user_id)');
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/chipSkinDb.test.js --runInBand`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add database/schema.js tests/chipSkinDb.test.js
git commit -m "feat: add chip skin schema"
```

## Task 2: Database Access Layer

**Files:**
- Create: `database/games/chipSkins.js`
- Modify: `database/games/index.js`
- Test: `tests/chipSkinDb.test.js`

- [ ] **Step 1: Add failing DB behavior tests**

Append these tests to `tests/chipSkinDb.test.js`:

```js
const CHIP_VALUES = [1, 5, 10, 25, 50, 100, 500, 1000];

async function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    dbLayer.db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function clearChipSkinRows() {
  await run('DELETE FROM chip_skin_grants');
  await run('DELETE FROM chip_skin_assets');
  await run('DELETE FROM chip_skins');
  await run("DELETE FROM Users WHERE id IN ('skin-user-1', 'skin-user-2', 'skin-admin-1')");
}

async function addCompleteAssets(skinId, slug) {
  for (const value of CHIP_VALUES) {
    await dbLayer.upsertChipSkinAsset(skinId, value, `data/chip-skins/${slug}/${value}.png`, `${value}.png`);
  }
}

test('managed chip skins enforce release date, status, completeness, and grants', async () => {
  await clearChipSkinRows();
  await run(
    "INSERT INTO Users (id, displayName, username, is_superadmin) VALUES ('skin-user-1', 'Skin User', 'skinuser1', 0)"
  );

  const publicSkin = await dbLayer.createChipSkin({
    name: 'Released Public',
    slug: 'released-public',
    description: 'Visible public skin',
    status: 'public',
    rarity: 'rare',
    release_date: '2026-01-01T00:00:00.000Z',
  });
  await addCompleteAssets(publicSkin.id, publicSkin.slug);

  const futureSkin = await dbLayer.createChipSkin({
    name: 'Future Public',
    slug: 'future-public',
    description: 'Hidden until release date',
    status: 'public',
    rarity: 'epic',
    release_date: '2999-01-01T00:00:00.000Z',
  });
  await addCompleteAssets(futureSkin.id, futureSkin.slug);

  const restrictedSkin = await dbLayer.createChipSkin({
    name: 'Restricted Skin',
    slug: 'restricted-skin',
    description: 'Needs grant',
    status: 'restricted',
    rarity: 'legendary',
    release_date: '2026-01-01T00:00:00.000Z',
  });
  await addCompleteAssets(restrictedSkin.id, restrictedSkin.slug);

  let visible = await dbLayer.getAvailableChipSkinsForUser('skin-user-1', '2026-04-28T00:00:00.000Z');
  assert(visible.some((skin) => skin.slug === 'released-public'), 'released public skin should be visible');
  assert(!visible.some((skin) => skin.slug === 'future-public'), 'future skin should not be visible');
  assert(!visible.some((skin) => skin.slug === 'restricted-skin'), 'restricted skin should require a grant');

  await dbLayer.grantChipSkin(restrictedSkin.id, 'skin-user-1', 'skin-admin-1');
  visible = await dbLayer.getAvailableChipSkinsForUser('skin-user-1', '2026-04-28T00:00:00.000Z');
  assert(visible.some((skin) => skin.slug === 'restricted-skin'), 'restricted skin should be visible after grant');

  await dbLayer.revokeChipSkinGrant(restrictedSkin.id, 'skin-user-1');
  visible = await dbLayer.getAvailableChipSkinsForUser('skin-user-1', '2026-04-28T00:00:00.000Z');
  assert(!visible.some((skin) => skin.slug === 'restricted-skin'), 'restricted skin should disappear after revoke');
});

test('chip skin validation rejects invalid status and rarity', async () => {
  await clearChipSkinRows();

  await assert.rejects(
    () => dbLayer.createChipSkin({
      name: 'Bad Status',
      slug: 'bad-status',
      description: '',
      status: 'live',
      rarity: 'rare',
      release_date: '2026-01-01T00:00:00.000Z',
    }),
    /Invalid status/
  );

  await assert.rejects(
    () => dbLayer.createChipSkin({
      name: 'Bad Rarity',
      slug: 'bad-rarity',
      description: '',
      status: 'draft',
      rarity: 'mythic',
      release_date: '2026-01-01T00:00:00.000Z',
    }),
    /Invalid rarity/
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/chipSkinDb.test.js --runInBand`

Expected: FAIL with missing functions such as `createChipSkin`.

- [ ] **Step 3: Create database functions**

Create `database/games/chipSkins.js`:

```js
const db = require('../connection');

const CHIP_VALUES = [1, 5, 10, 25, 50, 100, 500, 1000];
const VALID_STATUSES = ['draft', 'public', 'restricted', 'disabled'];
const VALID_RARITIES = ['common', 'rare', 'epic', 'legendary', 'limited', 'exclusive'];

function assertValidSkinPayload(payload, { requirePublishable = false } = {}) {
  if (!payload.name || !String(payload.name).trim()) throw new Error('Missing skin name');
  if (!payload.slug || !/^[a-z0-9-]{2,40}$/.test(payload.slug)) throw new Error('Invalid slug');
  if (!VALID_STATUSES.includes(payload.status)) throw new Error('Invalid status');
  if (!VALID_RARITIES.includes(payload.rarity)) throw new Error('Invalid rarity');
  if (!payload.release_date || Number.isNaN(Date.parse(payload.release_date))) throw new Error('Invalid release date');
  if (requirePublishable && payload.status !== 'draft' && payload.status !== 'disabled') {
    if (!payload.isComplete) throw new Error('Skin must include all chip assets before publishing');
  }
}

function mapSkinRow(row, assets = []) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description || '',
    status: row.status,
    rarity: row.rarity,
    release_date: row.release_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
    isComplete: Number(row.asset_count || assets.length || 0) === CHIP_VALUES.length,
    assets: assets.reduce((acc, asset) => {
      acc[asset.chip_value] = {
        value: asset.chip_value,
        filePath: asset.file_path,
        originalFilename: asset.original_filename,
        url: `/api/chip-skins/assets/${row.slug}/${asset.chip_value}.png`,
      };
      return acc;
    }, {}),
  };
}

function getAssetsForSkinId(skinId) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM chip_skin_assets WHERE skin_id = ? ORDER BY chip_value ASC',
      [skinId],
      (err, rows) => (err ? reject(err) : resolve(rows || []))
    );
  });
}

function getChipSkinById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM chip_skins WHERE id = ?', [id], async (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      try {
        const assets = await getAssetsForSkinId(row.id);
        resolve(mapSkinRow(row, assets));
      } catch (assetErr) {
        reject(assetErr);
      }
    });
  });
}

function createChipSkin(payload) {
  assertValidSkinPayload(payload);
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO chip_skins (name, slug, description, status, rarity, release_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        payload.name.trim(),
        payload.slug.trim(),
        payload.description || '',
        payload.status,
        payload.rarity,
        new Date(payload.release_date).toISOString(),
      ],
      async function onInsert(err) {
        if (err) return reject(err);
        try {
          resolve(await getChipSkinById(this.lastID));
        } catch (fetchErr) {
          reject(fetchErr);
        }
      }
    );
  });
}

async function updateChipSkin(id, payload) {
  const existing = await getChipSkinById(id);
  if (!existing) throw new Error('Skin not found');
  const next = {
    ...existing,
    ...payload,
    isComplete: existing.isComplete,
  };
  assertValidSkinPayload(next, { requirePublishable: true });
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE chip_skins
       SET name = ?, slug = ?, description = ?, status = ?, rarity = ?, release_date = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        next.name.trim(),
        next.slug.trim(),
        next.description || '',
        next.status,
        next.rarity,
        new Date(next.release_date).toISOString(),
        id,
      ],
      async (err) => {
        if (err) return reject(err);
        try {
          resolve(await getChipSkinById(id));
        } catch (fetchErr) {
          reject(fetchErr);
        }
      }
    );
  });
}

function upsertChipSkinAsset(skinId, chipValue, filePath, originalFilename = '') {
  if (!CHIP_VALUES.includes(Number(chipValue))) throw new Error('Invalid chip value');
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO chip_skin_assets (skin_id, chip_value, file_path, original_filename)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(skin_id, chip_value) DO UPDATE SET
         file_path = excluded.file_path,
         original_filename = excluded.original_filename,
         updated_at = CURRENT_TIMESTAMP`,
      [skinId, Number(chipValue), filePath, originalFilename],
      function onUpsert(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      }
    );
  });
}

function getAdminChipSkins() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT s.*, COUNT(a.id) as asset_count
       FROM chip_skins s
       LEFT JOIN chip_skin_assets a ON a.skin_id = s.id
       GROUP BY s.id
       ORDER BY datetime(s.release_date) DESC, s.name ASC`,
      [],
      async (err, rows) => {
        if (err) return reject(err);
        try {
          const skins = [];
          for (const row of rows || []) {
            skins.push(mapSkinRow(row, await getAssetsForSkinId(row.id)));
          }
          resolve(skins);
        } catch (assetErr) {
          reject(assetErr);
        }
      }
    );
  });
}

function getAvailableChipSkinsForUser(userId, nowIso = new Date().toISOString()) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT s.*, COUNT(a.id) as asset_count
       FROM chip_skins s
       LEFT JOIN chip_skin_assets a ON a.skin_id = s.id
       LEFT JOIN chip_skin_grants g ON g.skin_id = s.id AND g.user_id = ?
       WHERE datetime(s.release_date) <= datetime(?)
         AND s.status IN ('public', 'restricted')
         AND (s.status = 'public' OR g.user_id IS NOT NULL)
       GROUP BY s.id
       HAVING asset_count = ?
       ORDER BY datetime(s.release_date) DESC, s.name ASC`,
      [userId, nowIso, CHIP_VALUES.length],
      async (err, rows) => {
        if (err) return reject(err);
        try {
          const skins = [];
          for (const row of rows || []) {
            skins.push(mapSkinRow(row, await getAssetsForSkinId(row.id)));
          }
          resolve(skins);
        } catch (assetErr) {
          reject(assetErr);
        }
      }
    );
  });
}

function getChipSkinGrants(skinId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT g.*, u.username, u.displayName
       FROM chip_skin_grants g
       JOIN Users u ON u.id = g.user_id
       WHERE g.skin_id = ?
       ORDER BY g.granted_at DESC`,
      [skinId],
      (err, rows) => (err ? reject(err) : resolve(rows || []))
    );
  });
}

function grantChipSkin(skinId, userId, grantedBy) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR IGNORE INTO chip_skin_grants (skin_id, user_id, granted_by)
       VALUES (?, ?, ?)`,
      [skinId, userId, grantedBy || null],
      function onGrant(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      }
    );
  });
}

function revokeChipSkinGrant(skinId, userId) {
  return new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM chip_skin_grants WHERE skin_id = ? AND user_id = ?',
      [skinId, userId],
      function onRevoke(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      }
    );
  });
}

module.exports = {
  CHIP_VALUES,
  VALID_STATUSES,
  VALID_RARITIES,
  createChipSkin,
  updateChipSkin,
  getChipSkinById,
  getAdminChipSkins,
  getAvailableChipSkinsForUser,
  getChipSkinGrants,
  grantChipSkin,
  revokeChipSkinGrant,
  upsertChipSkinAsset,
};
```

- [ ] **Step 4: Export DB functions**

Modify `database/games/index.js`:

```js
const chipSkins = require('./chipSkins');
```

and include it in `module.exports`:

```js
  ...chipSkins,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/chipSkinDb.test.js --runInBand`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add database/games/chipSkins.js database/games/index.js tests/chipSkinDb.test.js
git commit -m "feat: add chip skin data access"
```

## Task 3: Backend Controller And Routes

**Files:**
- Create: `controllers/chipSkinController.js`
- Modify: `routes/api.js`
- Test: `tests/chipSkinController.test.js`

- [ ] **Step 1: Write failing controller tests**

Create `tests/chipSkinController.test.js`:

```js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const controller = require('../controllers/chipSkinController');

test('parsePngDataUrl accepts PNG data URLs', () => {
  const parsed = controller.parsePngDataUrl('data:image/png;base64,iVBORw0KGgo=');
  assert(Buffer.isBuffer(parsed));
  assert(parsed.length > 0);
});

test('parsePngDataUrl rejects non-PNG uploads', () => {
  assert.throws(
    () => controller.parsePngDataUrl('data:image/jpeg;base64,abcd'),
    /Only PNG chip assets are supported/
  );
});

test('getChipSkinAssetPath blocks path traversal', () => {
  assert.throws(
    () => controller.getChipSkinAssetPath('../bad', '1.png'),
    /Invalid asset path/
  );
});

test('getChipSkinAssetPath resolves inside data chip skin directory', () => {
  const assetPath = controller.getChipSkinAssetPath('safe-skin', '1.png');
  assert(assetPath.endsWith(path.join('data', 'chip-skins', 'safe-skin', '1.png')));
  assert(fs.existsSync(path.dirname(path.dirname(assetPath))), 'data directory parent should be resolvable');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/chipSkinController.test.js --runInBand`

Expected: FAIL because `controllers/chipSkinController.js` does not exist.

- [ ] **Step 3: Create controller**

Create `controllers/chipSkinController.js`:

```js
const fs = require('fs');
const path = require('path');
const dbLayer = require('../database');

const chipSkinRoot = path.join(__dirname, '..', 'data', 'chip-skins');

function requireSuperadmin(req, res) {
  if (!req.user || !req.user.is_superadmin) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

function parsePngDataUrl(dataUrl) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!match) throw new Error('Only PNG chip assets are supported');
  return Buffer.from(match[1], 'base64');
}

function getChipSkinAssetPath(skinSlug, fileName) {
  if (!/^[a-z0-9-]{2,40}$/.test(String(skinSlug || ''))) throw new Error('Invalid asset path');
  if (!/^(1|5|10|25|50|100|500|1000)\.png$/.test(String(fileName || ''))) throw new Error('Invalid asset path');
  const resolved = path.join(chipSkinRoot, skinSlug, fileName);
  const rootWithSep = chipSkinRoot.endsWith(path.sep) ? chipSkinRoot : `${chipSkinRoot}${path.sep}`;
  if (!resolved.startsWith(rootWithSep)) throw new Error('Invalid asset path');
  return resolved;
}

async function getAdminChipSkins(req, res) {
  if (!requireSuperadmin(req, res)) return;
  res.json({ skins: await dbLayer.getAdminChipSkins() });
}

async function createAdminChipSkin(req, res) {
  if (!requireSuperadmin(req, res)) return;
  const skin = await dbLayer.createChipSkin(req.body);
  res.status(201).json({ skin });
}

async function updateAdminChipSkin(req, res) {
  if (!requireSuperadmin(req, res)) return;
  const skin = await dbLayer.updateChipSkin(Number(req.params.id), req.body);
  res.json({ skin });
}

async function uploadAdminChipSkinAsset(req, res) {
  if (!requireSuperadmin(req, res)) return;
  const skin = await dbLayer.getChipSkinById(Number(req.params.id));
  if (!skin) return res.status(404).json({ error: 'Skin not found' });

  const value = Number(req.body.value);
  if (!dbLayer.CHIP_VALUES.includes(value)) return res.status(400).json({ error: 'Invalid chip value' });

  const buffer = parsePngDataUrl(req.body.dataUrl);
  const filePath = getChipSkinAssetPath(skin.slug, `${value}.png`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);

  const relativePath = path.relative(path.join(__dirname, '..'), filePath);
  await dbLayer.upsertChipSkinAsset(skin.id, value, relativePath, req.body.fileName || `${value}.png`);
  res.json({ skin: await dbLayer.getChipSkinById(skin.id) });
}

async function getAdminChipSkinGrants(req, res) {
  if (!requireSuperadmin(req, res)) return;
  res.json({ grants: await dbLayer.getChipSkinGrants(Number(req.params.id)) });
}

async function grantAdminChipSkin(req, res) {
  if (!requireSuperadmin(req, res)) return;
  const userId = String(req.body.userId || '').trim();
  const user = await dbLayer.getUser(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  await dbLayer.grantChipSkin(Number(req.params.id), userId, req.user.id || req.user.userId);
  res.json({ grants: await dbLayer.getChipSkinGrants(Number(req.params.id)) });
}

async function revokeAdminChipSkinGrant(req, res) {
  if (!requireSuperadmin(req, res)) return;
  await dbLayer.revokeChipSkinGrant(Number(req.params.id), req.params.userId);
  res.json({ grants: await dbLayer.getChipSkinGrants(Number(req.params.id)) });
}

async function getPublicChipSkins(req, res) {
  res.json({ skins: await dbLayer.getAvailableChipSkinsForUser(req.user?.id || req.user?.userId || null) });
}

async function getMyChipSkins(req, res) {
  res.json({ skins: await dbLayer.getAvailableChipSkinsForUser(req.user.id || req.user.userId) });
}

function serveChipSkinAsset(req, res) {
  try {
    const filePath = getChipSkinAssetPath(req.params.skinSlug, req.params.fileName);
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
    res.sendFile(filePath);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

function wrap(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

module.exports = {
  parsePngDataUrl,
  getChipSkinAssetPath,
  getAdminChipSkins: wrap(getAdminChipSkins),
  createAdminChipSkin: wrap(createAdminChipSkin),
  updateAdminChipSkin: wrap(updateAdminChipSkin),
  uploadAdminChipSkinAsset: wrap(uploadAdminChipSkinAsset),
  getAdminChipSkinGrants: wrap(getAdminChipSkinGrants),
  grantAdminChipSkin: wrap(grantAdminChipSkin),
  revokeAdminChipSkinGrant: wrap(revokeAdminChipSkinGrant),
  getPublicChipSkins: wrap(getPublicChipSkins),
  getMyChipSkins: wrap(getMyChipSkins),
  serveChipSkinAsset,
};
```

- [ ] **Step 4: Add routes**

In `routes/api.js`, add near other controller imports:

```js
const chipSkinController = require('../controllers/chipSkinController');
```

Add routes near the admin routes:

```js
router.get('/admin/chip-skins', authController.authenticateToken, chipSkinController.getAdminChipSkins);
router.post('/admin/chip-skins', authController.authenticateToken, chipSkinController.createAdminChipSkin);
router.put('/admin/chip-skins/:id', authController.authenticateToken, chipSkinController.updateAdminChipSkin);
router.post('/admin/chip-skins/:id/assets', authController.authenticateToken, chipSkinController.uploadAdminChipSkinAsset);
router.get('/admin/chip-skins/:id/grants', authController.authenticateToken, chipSkinController.getAdminChipSkinGrants);
router.post('/admin/chip-skins/:id/grants', authController.authenticateToken, chipSkinController.grantAdminChipSkin);
router.delete('/admin/chip-skins/:id/grants/:userId', authController.authenticateToken, chipSkinController.revokeAdminChipSkinGrant);
router.get('/chip-skins', authController.optionalAuthenticateToken, chipSkinController.getPublicChipSkins);
router.get('/chip-skins/me', authController.authenticateToken, chipSkinController.getMyChipSkins);
router.get('/chip-skins/assets/:skinSlug/:fileName', chipSkinController.serveChipSkinAsset);
```

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/chipSkinController.test.js tests/chipSkinDb.test.js --runInBand`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add controllers/chipSkinController.js routes/api.js tests/chipSkinController.test.js
git commit -m "feat: add chip skin api"
```

## Task 4: User Skin Catalog Context

**Files:**
- Modify: `src/features/casino/chipConfig.js`
- Modify: `src/features/casino/ChipSkinContext.jsx`
- Test: `tests/chipSkinFrontend.test.js`

- [ ] **Step 1: Write failing frontend source tests**

Create `tests/chipSkinFrontend.test.js`:

```js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

test('ChipSkinContext fetches available managed skins from backend', () => {
  const src = read('src/features/casino/ChipSkinContext.jsx');
  assert(src.includes('/api/chip-skins/me'), 'context should load user-visible skins');
  assert(src.includes('availableSkins'), 'context should expose availableSkins');
  assert(src.includes('getSkinImage'), 'context should expose managed image lookup');
});

test('chipConfig exposes built-in skin catalog metadata', () => {
  const src = read('src/features/casino/chipConfig.js');
  assert(src.includes('BUILT_IN_CHIP_SKINS'), 'built-in catalog metadata is required');
  assert(src.includes('getChipImageFromCatalog'), 'catalog image helper is required');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/chipSkinFrontend.test.js --runInBand`

Expected: FAIL because context/catalog helpers do not exist.

- [ ] **Step 3: Add built-in catalog helpers**

In `src/features/casino/chipConfig.js`, add after `CHIP_IMAGES`:

```js
export const BUILT_IN_CHIP_SKINS = [
  {
    id: 'default',
    slug: 'default',
    name: 'Classic (Color)',
    status: 'public',
    rarity: 'common',
    release_date: '2026-01-01T00:00:00.000Z',
    isBuiltIn: true,
    isComplete: true,
    assets: {},
  },
  {
    id: 'classic',
    slug: 'classic',
    name: 'Classic',
    status: 'public',
    rarity: 'common',
    release_date: '2026-01-01T00:00:00.000Z',
    isBuiltIn: true,
    isComplete: true,
    assets: CHIP_VALUES.reduce((acc, value) => ({ ...acc, [value]: { value, url: CHIP_IMAGES.classic[value] } }), {}),
  },
  {
    id: 'neon',
    slug: 'neon',
    name: 'Neon',
    status: 'public',
    rarity: 'rare',
    release_date: '2026-01-01T00:00:00.000Z',
    isBuiltIn: true,
    isComplete: true,
    assets: CHIP_VALUES.reduce((acc, value) => ({ ...acc, [value]: { value, url: CHIP_IMAGES.neon[value] } }), {}),
  },
  {
    id: 'tropical',
    slug: 'tropical',
    name: 'Tropical',
    status: 'public',
    rarity: 'rare',
    release_date: '2026-01-01T00:00:00.000Z',
    isBuiltIn: true,
    isComplete: true,
    assets: CHIP_VALUES.reduce((acc, value) => ({ ...acc, [value]: { value, url: CHIP_IMAGES.tropical[value] } }), {}),
  },
];

export function getChipImageFromCatalog(value, skin, catalog = BUILT_IN_CHIP_SKINS) {
  const builtIn = getChipImage(value, skin);
  if (builtIn) return builtIn;
  const found = catalog.find((entry) => entry.slug === skin || entry.id === skin);
  return found?.assets?.[value]?.url ?? null;
}
```

- [ ] **Step 4: Update context**

Replace `src/features/casino/ChipSkinContext.jsx` with:

```jsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { BUILT_IN_CHIP_SKINS, getChipImageFromCatalog } from './chipConfig';
import { useAuth } from '../../context/AuthContext';

const ChipSkinContext = createContext({
  skin: 'default',
  setSkin: () => {},
  availableSkins: BUILT_IN_CHIP_SKINS,
  loadingSkins: false,
  getSkinImage: () => null,
});

export function ChipSkinProvider({ children }) {
  const { token } = useAuth();
  const [skin, setSkinState] = useState(() => localStorage.getItem('chipSkin') || 'default');
  const [managedSkins, setManagedSkins] = useState([]);
  const [loadingSkins, setLoadingSkins] = useState(false);

  const availableSkins = useMemo(() => {
    const bySlug = new Map();
    for (const entry of BUILT_IN_CHIP_SKINS) bySlug.set(entry.slug, entry);
    for (const entry of managedSkins) bySlug.set(entry.slug, { ...entry, isBuiltIn: false });
    return [...bySlug.values()];
  }, [managedSkins]);

  useEffect(() => {
    let cancelled = false;
    async function loadSkins() {
      if (!token) {
        setManagedSkins([]);
        return;
      }
      setLoadingSkins(true);
      try {
        const res = await axios.get('/api/chip-skins/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) setManagedSkins(Array.isArray(res.data?.skins) ? res.data.skins : []);
      } catch {
        if (!cancelled) setManagedSkins([]);
      } finally {
        if (!cancelled) setLoadingSkins(false);
      }
    }
    loadSkins();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!availableSkins.some((entry) => entry.slug === skin || entry.id === skin)) {
      setSkinState('default');
      localStorage.setItem('chipSkin', 'default');
    }
  }, [availableSkins, skin]);

  const setSkin = useCallback((name) => {
    setSkinState(name);
    localStorage.setItem('chipSkin', name);
  }, []);

  const getSkinImage = useCallback(
    (value, skinName = skin) => getChipImageFromCatalog(value, skinName, availableSkins),
    [availableSkins, skin]
  );

  return (
    <ChipSkinContext.Provider value={{ skin, setSkin, availableSkins, loadingSkins, getSkinImage }}>
      {children}
    </ChipSkinContext.Provider>
  );
}

export function useChipSkin() {
  return useContext(ChipSkinContext);
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/chipSkinFrontend.test.js --runInBand`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/casino/chipConfig.js src/features/casino/ChipSkinContext.jsx tests/chipSkinFrontend.test.js
git commit -m "feat: load available chip skins"
```

## Task 5: Settings And Casino Rendering

**Files:**
- Modify: `src/pages/Settings.jsx`
- Modify: `src/features/blackjack/components/ChipStack.jsx`
- Modify: `src/features/blackjack/components/BlackjackSeat.jsx`
- Modify: `src/features/roulette/components/RouletteBettingTable.jsx`
- Modify: `src/features/roulette/components/RouletteChipSelector.jsx`
- Test: `tests/chipSkinFrontend.test.js`

- [ ] **Step 1: Add failing source tests**

Append to `tests/chipSkinFrontend.test.js`:

```js
test('Settings renders skin options from ChipSkinContext', () => {
  const src = read('src/pages/Settings.jsx');
  assert(src.includes('availableSkins'), 'Settings should read availableSkins from context');
  assert(!src.includes("{ id: 'tropical', label: 'Tropical' }"), 'Settings should not hard-code the skin list');
});

test('casino chip components use managed skin image lookup', () => {
  const files = [
    'src/features/blackjack/components/ChipStack.jsx',
    'src/features/blackjack/components/BlackjackSeat.jsx',
    'src/features/roulette/components/RouletteBettingTable.jsx',
    'src/features/roulette/components/RouletteChipSelector.jsx',
  ];
  for (const file of files) {
    const src = read(file);
    assert(src.includes('getSkinImage'), `${file} should use context image lookup`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/chipSkinFrontend.test.js --runInBand`

Expected: FAIL because settings and components still use static `getChipImage`.

- [ ] **Step 3: Update Settings**

In `src/pages/Settings.jsx`, change the chip skin context destructuring:

```jsx
const { skin: chipSkin, setSkin: setChipSkin, availableSkins, getSkinImage } = useChipSkin();
```

Replace the hard-coded skin array in the chip skin settings section with:

```jsx
{availableSkins.map((skinOption) => {
  const id = skinOption.slug || skinOption.id;
  const label = skinOption.name || id;
  const img = getSkinImage(100, id);
  const isActive = chipSkin === id;
  return (
    <div
      key={id}
      onClick={() => setChipSkin(id)}
      className={`pref-card${isActive ? ' active' : ''}`}
      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '16px 12px' }}
    >
      {img ? (
        <img src={img} alt={label} style={{ width: '56px', height: '56px', objectFit: 'contain' }} />
      ) : (
        <div style={{ display: 'flex', gap: '4px' }}>
          {Object.values(CHIP_SKINS.default).slice(0, 4).map((color, i) => (
            <div key={i} style={{ width: '12px', height: '12px', borderRadius: '50%', background: color, border: '1px solid rgba(255,255,255,0.2)' }} />
          ))}
        </div>
      )}
      <span style={{ fontSize: '0.8rem', fontWeight: isActive ? 700 : 400 }}>{label}</span>
      {skinOption.rarity && (
        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          {skinOption.rarity}
        </span>
      )}
    </div>
  );
})}
```

- [ ] **Step 4: Update chip renderers**

For each component, keep current color fallback but replace image lookup with context lookup.

In `ChipStack.jsx`:

```jsx
const { skin: skinCtx, getSkinImage } = useChipSkin();
...
const img = getSkinImage(value, skin);
```

In `BlackjackSeat.jsx`:

```jsx
const { skin, getSkinImage } = useChipSkin();
...
const img = getSkinImage(value, skin);
...
<ChipStack amount={player.currentBet} title="Gesetzter Einsatz" skin={playerSkin} />
```

In `RouletteBettingTable.jsx`, import and use the hook:

```jsx
import { useChipSkin } from '../../casino/ChipSkinContext';
...
const { getSkinImage } = useChipSkin();
...
const img = getSkinImage(chipVal, skinName);
```

In `RouletteChipSelector.jsx`:

```jsx
const { skin, getSkinImage } = useChipSkin();
...
const img = getSkinImage(val, skin);
```

- [ ] **Step 5: Run tests and build**

Run:

```bash
npm test -- tests/chipSkinFrontend.test.js --runInBand
npm run build
```

Expected: tests PASS and Vite build completes.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Settings.jsx src/features/blackjack/components/ChipStack.jsx src/features/blackjack/components/BlackjackSeat.jsx src/features/roulette/components/RouletteBettingTable.jsx src/features/roulette/components/RouletteChipSelector.jsx tests/chipSkinFrontend.test.js
git commit -m "feat: render managed chip skins"
```

## Task 6: Admin Chip Skins UI

**Files:**
- Create: `src/components/admin/ChipSkinsTab.jsx`
- Modify: `src/pages/Admin.jsx`
- Test: `tests/chipSkinFrontend.test.js`

- [ ] **Step 1: Add failing admin UI source test**

Append to `tests/chipSkinFrontend.test.js`:

```js
test('Admin dashboard exposes Chip-Skins tab and component', () => {
  const admin = read('src/pages/Admin.jsx');
  assert(admin.includes('ChipSkinsTab'), 'Admin should import and render ChipSkinsTab');
  assert(admin.includes("activeTab === 'chip_skins'"), 'Admin should include chip_skins tab state');
  assert(admin.includes('/api/admin/chip-skins'), 'Admin should call chip skin admin API');

  const tab = read('src/components/admin/ChipSkinsTab.jsx');
  assert(tab.includes('release_date'), 'ChipSkinsTab should edit release date');
  assert(tab.includes('rarity'), 'ChipSkinsTab should edit rarity');
  assert(tab.includes('FileReader'), 'ChipSkinsTab should upload PNG assets as data URLs');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/chipSkinFrontend.test.js --runInBand`

Expected: FAIL because `ChipSkinsTab.jsx` does not exist and Admin has no tab.

- [ ] **Step 3: Create admin component**

Create `src/components/admin/ChipSkinsTab.jsx`:

```jsx
import React, { useMemo, useState } from 'react';

const CHIP_VALUES = [1, 5, 10, 25, 50, 100, 500, 1000];
const RARITIES = ['common', 'rare', 'epic', 'legendary', 'limited', 'exclusive'];
const STATUSES = ['draft', 'public', 'restricted', 'disabled'];

export default function ChipSkinsTab({
  skins,
  users,
  form,
  selectedSkinId,
  grants,
  onFormChange,
  onSelectSkin,
  onCreateNew,
  onSave,
  onUploadAsset,
  onFetchGrants,
  onGrant,
  onRevoke,
}) {
  const [grantUserId, setGrantUserId] = useState('');
  const selectedSkin = useMemo(
    () => skins.find((skin) => Number(skin.id) === Number(selectedSkinId)),
    [skins, selectedSkinId]
  );

  async function handleAssetFile(value, file) {
    if (!file) return;
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    await onUploadAsset(selectedSkinId, value, file.name, dataUrl);
  }

  return (
    <div className="glass-card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Chip-Skins</h2>
          <p style={{ margin: '6px 0 0', color: 'var(--text-muted)' }}>Skins erstellen, Releases planen und Zugriffe steuern.</p>
        </div>
        <button type="button" className="btn-primary" onClick={onCreateNew}>New Skin</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(320px, 1.2fr)', gap: '20px' }}>
        <div style={{ display: 'grid', gap: '12px' }}>
          {skins.map((skin) => (
            <button
              type="button"
              key={skin.id}
              className={Number(selectedSkinId) === Number(skin.id) ? 'btn-primary' : 'btn-secondary'}
              onClick={() => {
                onSelectSkin(skin);
                onFetchGrants(skin.id);
              }}
              style={{ textAlign: 'left', display: 'grid', gap: '8px' }}
            >
              <strong>{skin.name}</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {skin.status} · {skin.rarity} · {skin.release_date}
              </span>
              <span style={{ fontSize: '0.75rem' }}>
                {skin.isComplete ? 'Complete' : `${Object.keys(skin.assets || {}).length}/8 assets`}
              </span>
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gap: '14px' }}>
          <input value={form.name} onChange={(e) => onFormChange({ ...form, name: e.target.value })} placeholder="Skin name" />
          <input value={form.slug} onChange={(e) => onFormChange({ ...form, slug: e.target.value })} placeholder="skin-slug" />
          <textarea value={form.description} onChange={(e) => onFormChange({ ...form, description: e.target.value })} placeholder="Description" />
          <select value={form.status} onChange={(e) => onFormChange({ ...form, status: e.target.value })}>
            {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <select value={form.rarity} onChange={(e) => onFormChange({ ...form, rarity: e.target.value })}>
            {RARITIES.map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}
          </select>
          <input type="datetime-local" value={form.release_date} onChange={(e) => onFormChange({ ...form, release_date: e.target.value })} />
          <button type="button" className="btn-primary" onClick={onSave}>Save Skin</button>

          {selectedSkin && (
            <>
              <h3>Assets</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' }}>
                {CHIP_VALUES.map((value) => (
                  <label key={value} className="pref-card" style={{ display: 'grid', gap: '8px' }}>
                    <span>{value} KC</span>
                    {selectedSkin.assets?.[value]?.url && (
                      <img src={selectedSkin.assets[value].url} alt={`${value} KC`} style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                    )}
                    <input type="file" accept="image/png" onChange={(e) => handleAssetFile(value, e.target.files?.[0])} />
                  </label>
                ))}
              </div>

              <h3>Restricted Grants</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <select value={grantUserId} onChange={(e) => setGrantUserId(e.target.value)} style={{ flex: 1 }}>
                  <option value="">Select user</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.username || user.displayName}</option>
                  ))}
                </select>
                <button type="button" className="btn-secondary" onClick={() => grantUserId && onGrant(selectedSkin.id, grantUserId)}>Grant</button>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {grants.map((grant) => (
                  <div key={grant.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{grant.username || grant.displayName || grant.user_id}</span>
                    <button type="button" className="btn-secondary" onClick={() => onRevoke(selectedSkin.id, grant.user_id)}>Revoke</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire Admin.jsx**

In `src/pages/Admin.jsx`, import:

```jsx
import ChipSkinsTab from '../components/admin/ChipSkinsTab';
```

Add state near other admin state:

```jsx
const [chipSkins, setChipSkins] = useState([]);
const [chipSkinForm, setChipSkinForm] = useState({
  id: null,
  name: '',
  slug: '',
  description: '',
  status: 'draft',
  rarity: 'common',
  release_date: new Date().toISOString().slice(0, 16),
});
const [chipSkinGrants, setChipSkinGrants] = useState([]);
```

Add handlers:

```jsx
const handleFetchAdminUsers = async () => {
  const res = await axios.get('/api/auth/users', {
    headers: { Authorization: `Bearer ${globalToken}` },
  });
  setUsersList(Array.isArray(res.data) ? res.data : []);
};

const handleFetchChipSkins = async () => {
  const res = await axios.get('/api/admin/chip-skins', {
    headers: { Authorization: `Bearer ${globalToken}` },
  });
  setChipSkins(res.data.skins || []);
};

const handleSaveChipSkin = async () => {
  const payload = {
    ...chipSkinForm,
    release_date: new Date(chipSkinForm.release_date).toISOString(),
  };
  if (chipSkinForm.id) {
    await axios.put(`/api/admin/chip-skins/${chipSkinForm.id}`, payload, {
      headers: { Authorization: `Bearer ${globalToken}` },
    });
  } else {
    await axios.post('/api/admin/chip-skins', payload, {
      headers: { Authorization: `Bearer ${globalToken}` },
    });
  }
  await handleFetchChipSkins();
  addLog('Success', 'Chip skin saved.', 'success');
};

const handleUploadChipSkinAsset = async (skinId, value, fileName, dataUrl) => {
  await axios.post(`/api/admin/chip-skins/${skinId}/assets`, { value, fileName, dataUrl }, {
    headers: { Authorization: `Bearer ${globalToken}` },
  });
  await handleFetchChipSkins();
  addLog('Success', `Uploaded ${value} KC chip asset.`, 'success');
};

const handleFetchChipSkinGrants = async (skinId) => {
  const res = await axios.get(`/api/admin/chip-skins/${skinId}/grants`, {
    headers: { Authorization: `Bearer ${globalToken}` },
  });
  setChipSkinGrants(res.data.grants || []);
};

const handleGrantChipSkin = async (skinId, userId) => {
  const res = await axios.post(`/api/admin/chip-skins/${skinId}/grants`, { userId }, {
    headers: { Authorization: `Bearer ${globalToken}` },
  });
  setChipSkinGrants(res.data.grants || []);
};

const handleRevokeChipSkin = async (skinId, userId) => {
  const res = await axios.delete(`/api/admin/chip-skins/${skinId}/grants/${userId}`, {
    headers: { Authorization: `Bearer ${globalToken}` },
  });
  setChipSkinGrants(res.data.grants || []);
};
```

Add to the active-tab effect:

```jsx
if (activeTab === 'chip_skins') {
  handleFetchChipSkins();
  if (usersList.length === 0) handleFetchAdminUsers();
}
```

Add tab button:

```jsx
<button
  className={activeTab === 'chip_skins' ? 'btn-primary' : 'btn-secondary'}
  onClick={() => setActiveTab('chip_skins')}
  style={{ flexShrink: 0, display: 'flex', gap: '8px', alignItems: 'center' }}>
  <Dices size={16} /> Chip-Skins
</button>
```

Add tab render:

```jsx
{activeTab === 'chip_skins' && (
  <ChipSkinsTab
    skins={chipSkins}
    users={usersList}
    form={chipSkinForm}
    selectedSkinId={chipSkinForm.id}
    grants={chipSkinGrants}
    onFormChange={setChipSkinForm}
    onSelectSkin={(skin) => setChipSkinForm({
      id: skin.id,
      name: skin.name,
      slug: skin.slug,
      description: skin.description || '',
      status: skin.status,
      rarity: skin.rarity,
      release_date: new Date(skin.release_date).toISOString().slice(0, 16),
    })}
    onCreateNew={() => {
      setChipSkinForm({
        id: null,
        name: '',
        slug: '',
        description: '',
        status: 'draft',
        rarity: 'common',
        release_date: new Date().toISOString().slice(0, 16),
      });
      setChipSkinGrants([]);
    }}
    onSave={handleSaveChipSkin}
    onUploadAsset={handleUploadChipSkinAsset}
    onFetchGrants={handleFetchChipSkinGrants}
    onGrant={handleGrantChipSkin}
    onRevoke={handleRevokeChipSkin}
  />
)}
```

- [ ] **Step 5: Run tests and build**

Run:

```bash
npm test -- tests/chipSkinFrontend.test.js --runInBand
npm run build
```

Expected: PASS and build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/ChipSkinsTab.jsx src/pages/Admin.jsx tests/chipSkinFrontend.test.js
git commit -m "feat: add chip skin admin tab"
```

## Task 7: Full Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused backend tests**

Run:

```bash
npm test -- tests/chipSkinDb.test.js tests/chipSkinController.test.js --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run focused frontend source tests**

Run:

```bash
npm test -- tests/chipSkinFrontend.test.js --runInBand
```

Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run:

```bash
npm test -- --runInBand
```

Expected: PASS.

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected: Vite build completes without errors.

- [ ] **Step 5: Start server for manual smoke test**

Run:

```bash
./restart_server.sh
```

Expected: server restarts successfully.

- [ ] **Step 6: Manual browser smoke test**

Open the app and verify:

- Admin dashboard has `Chip-Skins`.
- Creating a draft skin works.
- Uploading eight PNGs shows previews.
- Setting future `release_date` hides the skin from normal Settings.
- Setting released `public` skin shows it in Settings.
- Setting `restricted` hides it until a grant is added.
- Blackjack and Roulette render the selected managed skin.

- [ ] **Step 7: Commit any verification fixes**

If fixes were needed:

```bash
git add <changed-files>
git commit -m "fix: polish chip skin admin flow"
```

If no fixes were needed, do not create an empty commit.
