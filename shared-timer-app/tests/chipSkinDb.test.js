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
