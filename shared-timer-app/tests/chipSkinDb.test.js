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

const CHIP_VALUES = [1, 5, 10, 25, 50, 100, 500, 1000];
const TEST_SKIN_SLUGS = [
  'released-public',
  'incomplete-public',
  'future-public',
  'restricted-skin',
  'draft-skin',
  'disabled-skin',
  'bad-status',
  'bad-rarity',
  'bad-slug',
  'blank-name',
  'bad-date',
  'numeric-date',
  'impossible-date',
  'date-only',
  'generated-slug-example',
  'release-date-test',
  'release-date-update',
  'chip-value-test',
  'update-validation',
  'renamed-skin',
  'delete-me',
  'shape-test',
];

async function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    dbLayer.db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function clearChipSkinRows() {
  const placeholders = TEST_SKIN_SLUGS.map(() => '?').join(', ');
  await run(`DELETE FROM chip_skin_grants WHERE skin_id IN (SELECT id FROM chip_skins WHERE slug IN (${placeholders}))`, TEST_SKIN_SLUGS);
  await run(`DELETE FROM chip_skin_assets WHERE skin_id IN (SELECT id FROM chip_skins WHERE slug IN (${placeholders}))`, TEST_SKIN_SLUGS);
  await run(`DELETE FROM chip_skins WHERE slug IN (${placeholders})`, TEST_SKIN_SLUGS);
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

  const incompleteSkin = await dbLayer.createChipSkin({
    name: 'Incomplete Public',
    slug: 'incomplete-public',
    description: 'Hidden until every chip value has an asset',
    status: 'public',
    rarity: 'rare',
    release_date: '2026-01-01T00:00:00.000Z',
  });
  await dbLayer.upsertChipSkinAsset(
    incompleteSkin.id,
    1,
    `data/chip-skins/${incompleteSkin.slug}/1.png`,
    '1.png'
  );

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

  const draftSkin = await dbLayer.createChipSkin({
    name: 'Draft Skin',
    slug: 'draft-skin',
    description: 'Complete but not visible until public',
    status: 'draft',
    rarity: 'common',
    release_date: '2026-01-01T00:00:00.000Z',
  });
  await addCompleteAssets(draftSkin.id, draftSkin.slug);

  const disabledSkin = await dbLayer.createChipSkin({
    name: 'Disabled Skin',
    slug: 'disabled-skin',
    description: 'Complete but disabled',
    status: 'disabled',
    rarity: 'limited',
    release_date: '2026-01-01T00:00:00.000Z',
  });
  await addCompleteAssets(disabledSkin.id, disabledSkin.slug);

  let visible = await dbLayer.getAvailableChipSkinsForUser('skin-user-1', '2026-04-28T00:00:00.000Z');
  assert(visible.some((skin) => skin.slug === 'released-public'), 'released public skin should be visible');
  assert(!visible.some((skin) => skin.slug === 'incomplete-public'), 'incomplete public skin should not be visible');
  assert(!visible.some((skin) => skin.slug === 'future-public'), 'future skin should not be visible');
  assert(!visible.some((skin) => skin.slug === 'draft-skin'), 'draft skin should not be visible');
  assert(!visible.some((skin) => skin.slug === 'disabled-skin'), 'disabled skin should not be visible');
  assert(!visible.some((skin) => skin.slug === 'restricted-skin'), 'restricted skin should require a grant');

  await dbLayer.grantChipSkin(restrictedSkin.id, 'skin-user-1', 'skin-admin-1');
  visible = await dbLayer.getAvailableChipSkinsForUser('skin-user-1', '2026-04-28T00:00:00.000Z');
  assert(visible.some((skin) => skin.slug === 'restricted-skin'), 'restricted skin should be visible after grant');

  await dbLayer.revokeChipSkinGrant(restrictedSkin.id, 'skin-user-1');
  visible = await dbLayer.getAvailableChipSkinsForUser('skin-user-1', '2026-04-28T00:00:00.000Z');
  assert(!visible.some((skin) => skin.slug === 'restricted-skin'), 'restricted skin should disappear after revoke');
});

test('chip skin validation rejects invalid create payload fields', async () => {
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

  await assert.rejects(
    () => dbLayer.createChipSkin({
      name: 'Bad Slug',
      slug: 'Bad_Slug',
      description: '',
      status: 'draft',
      rarity: 'rare',
      release_date: '2026-01-01T00:00:00.000Z',
    }),
    /Invalid slug/
  );

  await assert.rejects(
    () => dbLayer.createChipSkin({
      name: '   ',
      slug: 'blank-name',
      description: '',
      status: 'draft',
      rarity: 'rare',
      release_date: '2026-01-01T00:00:00.000Z',
    }),
    /Invalid name/
  );

  await assert.rejects(
    () => dbLayer.createChipSkin({
      name: 'Bad Date',
      slug: 'bad-date',
      description: '',
      status: 'draft',
      rarity: 'rare',
      release_date: 'not-a-date',
    }),
    /Invalid release date/
  );

  await assert.rejects(
    () => dbLayer.createChipSkin({
      name: 'Numeric Date',
      slug: 'numeric-date',
      description: '',
      status: 'draft',
      rarity: 'rare',
      release_date: '1',
    }),
    /Invalid release date/
  );

  await assert.rejects(
    () => dbLayer.createChipSkin({
      name: 'Impossible Date',
      slug: 'impossible-date',
      description: '',
      status: 'draft',
      rarity: 'rare',
      release_date: '2026-02-30',
    }),
    /Invalid release date/
  );

  const dateOnlySkin = await dbLayer.createChipSkin({
    name: 'Date Only',
    slug: 'date-only',
    description: '',
    status: 'draft',
    rarity: 'rare',
    release_date: '2026-01-01',
  });
  assert.strictEqual(dateOnlySkin.release_date, '2026-01-01T00:00:00.000Z');
});

test('chip skin creation generates slug from name when omitted', async () => {
  await clearChipSkinRows();

  const skin = await dbLayer.createChipSkin({
    name: 'Generated Slug Example',
    description: '',
    status: 'draft',
    rarity: 'common',
    release_date: '2026-01-01T00:00:00.000Z',
  });

  assert.strictEqual(skin.slug, 'generated-slug-example');
});

test('chip skin validation rejects invalid chip values', async () => {
  await clearChipSkinRows();

  const skin = await dbLayer.createChipSkin({
    name: 'Chip Value Test',
    slug: 'chip-value-test',
    description: '',
    status: 'draft',
    rarity: 'rare',
    release_date: '2026-01-01T00:00:00.000Z',
  });

  await assert.rejects(
    () => dbLayer.upsertChipSkinAsset(skin.id, 2, 'data/chip-skins/chip-value-test/2.png', '2.png'),
    /Invalid chip value/
  );
});

test('chip skin update validation rejects invalid fields and incomplete publishing', async () => {
  await clearChipSkinRows();

  const skin = await dbLayer.createChipSkin({
    name: 'Update Validation',
    slug: 'update-validation',
    description: '',
    status: 'draft',
    rarity: 'rare',
    release_date: '2026-01-01T00:00:00.000Z',
  });

  await assert.rejects(
    () => dbLayer.updateChipSkin(skin.id, { slug: 'renamed-skin' }),
    /Cannot change chip skin slug/
  );
  await assert.rejects(
    () => dbLayer.updateChipSkin(skin.id, { name: '' }),
    /Invalid name/
  );
  await assert.rejects(
    () => dbLayer.updateChipSkin(skin.id, { release_date: 'tomorrowish' }),
    /Invalid release date/
  );
  await assert.rejects(
    () => dbLayer.updateChipSkin(skin.id, { release_date: '1' }),
    /Invalid release date/
  );
  await assert.rejects(
    () => dbLayer.updateChipSkin(skin.id, { release_date: '2026-02-30' }),
    /Invalid release date/
  );
  await assert.rejects(
    () => dbLayer.updateChipSkin(skin.id, { status: 'public' }),
    /Cannot publish incomplete chip skin/
  );
  await assert.rejects(
    () => dbLayer.updateChipSkin(skin.id, { status: 'restricted' }),
    /Cannot publish incomplete chip skin/
  );

  const draftSkin = await dbLayer.updateChipSkin(skin.id, { status: 'draft' });
  assert.strictEqual(draftSkin.status, 'draft');

  const disabledSkin = await dbLayer.updateChipSkin(skin.id, { status: 'disabled' });
  assert.strictEqual(disabledSkin.status, 'disabled');
});

test('chip skin delete removes skin metadata and assets', async () => {
  await clearChipSkinRows();

  const skin = await dbLayer.createChipSkin({
    name: 'Delete Me',
    slug: 'delete-me',
    description: '',
    status: 'draft',
    rarity: 'common',
    release_date: '2026-01-01T00:00:00.000Z',
  });
  await dbLayer.upsertChipSkinAsset(skin.id, 1, 'data/chip-skins/delete-me/1.png', '1.png');

  const result = await dbLayer.deleteChipSkin(skin.id);
  assert.strictEqual(result.changes, 1);

  const loaded = await dbLayer.getChipSkinById(skin.id);
  assert.strictEqual(loaded, null);

  const assetRows = await all('SELECT * FROM chip_skin_assets WHERE skin_id = ?', [skin.id]);
  assert.strictEqual(assetRows.length, 0);
});

test('chip skin returns planned complete flag and asset map shape', async () => {
  await clearChipSkinRows();

  const skin = await dbLayer.createChipSkin({
    name: 'Shape Test',
    slug: 'shape-test',
    description: '',
    status: 'draft',
    rarity: 'rare',
    release_date: '2026-01-01T00:00:00.000Z',
  });

  await dbLayer.upsertChipSkinAsset(skin.id, 1, 'data/chip-skins/shape-test/1.png', '1.png');

  const loaded = await dbLayer.getChipSkinById(skin.id);
  assert.strictEqual(loaded.isComplete, false);
  assert(loaded.assets, 'assets object is required');
  assert.deepStrictEqual(loaded.assets[1], {
    value: 1,
    filePath: 'data/chip-skins/shape-test/1.png',
    originalFilename: '1.png',
    url: '/data/chip-skins/shape-test/1.png',
  });
});
