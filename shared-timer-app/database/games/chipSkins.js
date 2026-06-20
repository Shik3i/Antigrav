const db = require('../connection');

const CHIP_VALUES = [1, 5, 10, 25, 50, 100, 500, 1000];
const VALID_STATUSES = ['draft', 'public', 'restricted', 'disabled'];
const VALID_RARITIES = ['common', 'rare', 'epic', 'legendary', 'limited', 'exclusive'];
const SLUG_PATTERN = /^[a-z0-9-]{2,40}$/;

const run = async (sql, params = []) => {
  const result = db.prepare(sql).run(...params);
  return { lastID: Number(result.lastInsertRowid), changes: Number(result.changes) };
};

const get = async (sql, params = []) => db.prepare(sql).get(...params) || null;

const all = async (sql, params = []) => db.prepare(sql).all(...params);

const validateStatus = (status) => {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }
};

const validateRarity = (rarity) => {
  if (!VALID_RARITIES.includes(rarity)) {
    throw new Error(`Invalid rarity: ${rarity}`);
  }
};

const validateName = (name) => {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Invalid name');
  }
};

const validateSlug = (slug) => {
  if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) {
    throw new Error(`Invalid slug: ${slug}`);
  }
};

const toChipSkinSlug = (value) => {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
};

const generateUniqueSlug = async (name) => {
  const baseSlug = toChipSkinSlug(name);
  validateSlug(baseSlug);

  let slug = baseSlug;
  let suffix = 2;

  while (await get('SELECT id FROM chip_skins WHERE slug = ?', [slug])) {
    const suffixText = `-${suffix}`;
    slug = `${baseSlug.slice(0, 40 - suffixText.length)}${suffixText}`;
    suffix += 1;
  }

  return slug;
};

const validateReleaseDate = (releaseDate) => {
  if (typeof releaseDate !== 'string') {
    throw new Error(`Invalid release date: ${releaseDate}`);
  }

  const trimmedReleaseDate = releaseDate.trim();
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmedReleaseDate);
  const isIsoTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(trimmedReleaseDate);

  if (!isDateOnly && !isIsoTimestamp) {
    throw new Error(`Invalid release date: ${releaseDate}`);
  }

  const parsedDate = new Date(isDateOnly ? `${trimmedReleaseDate}T00:00:00.000Z` : trimmedReleaseDate);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(`Invalid release date: ${releaseDate}`);
  }

  const normalizedReleaseDate = parsedDate.toISOString();

  if (normalizedReleaseDate.slice(0, 10) !== trimmedReleaseDate.slice(0, 10)) {
    throw new Error(`Invalid release date: ${releaseDate}`);
  }

  return normalizedReleaseDate;
};

const validateChipValue = (chipValue) => {
  if (!CHIP_VALUES.includes(Number(chipValue))) {
    throw new Error(`Invalid chip value: ${chipValue}`);
  }
};

const mapChipSkinRow = (row) => {
  if (!row) return null;

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
    asset_count: Number(row.asset_count || 0),
    grant_count: Number(row.grant_count || 0),
    isComplete: Number(row.asset_count || 0) === CHIP_VALUES.length,
    is_complete: Number(row.asset_count || 0) === CHIP_VALUES.length,
  };
};

const getChipSkinAssets = (skinId) => {
  return all(
    `SELECT id, skin_id, chip_value, file_path, original_filename, created_at, updated_at
     FROM chip_skin_assets
     WHERE skin_id = ?
     ORDER BY chip_value ASC`,
    [skinId]
  );
};

const toAssetResponse = (asset) => ({
  value: Number(asset.chip_value),
  filePath: asset.file_path,
  originalFilename: asset.original_filename || '',
  url: asset.file_path.startsWith('/') ? asset.file_path : `/${asset.file_path}`,
});

const withAssets = async (skin) => {
  if (!skin) return null;
  const assetRows = await getChipSkinAssets(skin.id);
  const assets = {};

  for (const asset of assetRows) {
    assets[asset.chip_value] = toAssetResponse(asset);
  }

  return {
    ...skin,
    assets,
    assetRows,
  };
};

const skinSelect = `
  SELECT s.*,
         COUNT(DISTINCT a.chip_value) as asset_count,
         COUNT(DISTINCT g.id) as grant_count
  FROM chip_skins s
  LEFT JOIN chip_skin_assets a ON a.skin_id = s.id
  LEFT JOIN chip_skin_grants g ON g.skin_id = s.id
`;

const createChipSkin = async ({
  name,
  slug,
  description = '',
  status = 'draft',
  rarity = 'common',
  release_date = new Date().toISOString(),
}) => {
  validateName(name);
  const normalizedSlug = slug ? slug : await generateUniqueSlug(name);
  validateSlug(normalizedSlug);
  validateStatus(status);
  validateRarity(rarity);
  const normalizedReleaseDate = validateReleaseDate(release_date);

  const result = await run(
    `INSERT INTO chip_skins (name, slug, description, status, rarity, release_date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name.trim(), normalizedSlug, description, status, rarity, normalizedReleaseDate]
  );

  return getChipSkinById(result.lastID);
};

const assertSkinCanPublish = async (skinId) => {
  const row = await get(
    `SELECT COUNT(DISTINCT chip_value) as asset_count
     FROM chip_skin_assets
     WHERE skin_id = ?`,
    [skinId]
  );

  if (Number(row?.asset_count || 0) !== CHIP_VALUES.length) {
    throw new Error('Cannot publish incomplete chip skin');
  }
};

const updateChipSkin = async (skinId, updates = {}) => {
  const allowedFields = ['name', 'slug', 'description', 'status', 'rarity', 'release_date'];
  const fields = [];
  const params = [];
  const existingSkin = await getChipSkinById(skinId);

  if (!existingSkin) {
    return null;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'name')) {
    validateName(updates.name);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'slug')) {
    validateSlug(updates.slug);
    if (updates.slug !== existingSkin.slug) {
      throw new Error('Cannot change chip skin slug');
    }
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'status')) {
    validateStatus(updates.status);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'rarity')) {
    validateRarity(updates.rarity);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'release_date')) {
    updates.release_date = validateReleaseDate(updates.release_date);
  }

  if (updates.status === 'public' || updates.status === 'restricted') {
    await assertSkinCanPublish(skinId);
  }

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      if (field === 'slug') continue;
      fields.push(`${field} = ?`);
      params.push(field === 'name' ? updates[field].trim() : updates[field]);
    }
  }

  if (fields.length === 0) {
    return getChipSkinById(skinId);
  }

  fields.push('updated_at = CURRENT_TIMESTAMP');
  await run(`UPDATE chip_skins SET ${fields.join(', ')} WHERE id = ?`, [...params, skinId]);
  return getChipSkinById(skinId);
};

const getChipSkinById = async (skinId) => {
  const row = await get(`${skinSelect} WHERE s.id = ? GROUP BY s.id`, [skinId]);
  return withAssets(mapChipSkinRow(row));
};

const getAdminChipSkins = async () => {
  const rows = await all(`${skinSelect} GROUP BY s.id ORDER BY s.created_at DESC, s.id DESC`);
  const skins = rows.map(mapChipSkinRow);

  return Promise.all(skins.map(withAssets));
};

const getAvailableChipSkinsForUser = async (userId, now = new Date().toISOString()) => {
  const rows = await all(
    `${skinSelect}
     WHERE datetime(s.release_date) <= datetime(?)
       AND (
         s.status = 'public'
         OR (s.status = 'restricted' AND EXISTS (
           SELECT 1
           FROM chip_skin_grants user_grants
           WHERE user_grants.skin_id = s.id
             AND user_grants.user_id = ?
         ))
       )
     GROUP BY s.id
     HAVING COUNT(DISTINCT a.chip_value) = ?
     ORDER BY datetime(s.release_date) DESC, s.id DESC`,
    [now, userId, CHIP_VALUES.length]
  );

  const skins = rows.map(mapChipSkinRow);
  return Promise.all(skins.map(withAssets));
};

const getChipSkinGrants = (skinId) => {
  return all(
    `SELECT g.id, g.skin_id, g.user_id, g.granted_at, g.granted_by,
            u.displayName, u.username
     FROM chip_skin_grants g
     LEFT JOIN Users u ON u.id = g.user_id
     WHERE g.skin_id = ?
     ORDER BY g.granted_at DESC, g.id DESC`,
    [skinId]
  );
};

const grantChipSkin = async (skinId, userId, grantedBy = null) => {
  await run(
    `INSERT INTO chip_skin_grants (skin_id, user_id, granted_by)
     VALUES (?, ?, ?)
     ON CONFLICT(skin_id, user_id) DO UPDATE SET
       granted_by = excluded.granted_by,
       granted_at = CURRENT_TIMESTAMP`,
    [skinId, userId, grantedBy]
  );

  return get(
    `SELECT id, skin_id, user_id, granted_at, granted_by
     FROM chip_skin_grants
     WHERE skin_id = ? AND user_id = ?`,
    [skinId, userId]
  );
};

const revokeChipSkinGrant = (skinId, userId) => {
  return run('DELETE FROM chip_skin_grants WHERE skin_id = ? AND user_id = ?', [skinId, userId]);
};

const deleteChipSkin = async (skinId) => {
  await run('DELETE FROM chip_skin_grants WHERE skin_id = ?', [skinId]);
  await run('DELETE FROM chip_skin_assets WHERE skin_id = ?', [skinId]);
  return run('DELETE FROM chip_skins WHERE id = ?', [skinId]);
};

const upsertChipSkinAsset = async (skinId, chipValue, filePath, originalFilename = null) => {
  validateChipValue(chipValue);

  await run(
    `INSERT INTO chip_skin_assets (skin_id, chip_value, file_path, original_filename)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(skin_id, chip_value) DO UPDATE SET
       file_path = excluded.file_path,
       original_filename = excluded.original_filename,
       updated_at = CURRENT_TIMESTAMP`,
    [skinId, Number(chipValue), filePath, originalFilename]
  );

  return get(
    `SELECT id, skin_id, chip_value, file_path, original_filename, created_at, updated_at
     FROM chip_skin_assets
     WHERE skin_id = ? AND chip_value = ?`,
    [skinId, Number(chipValue)]
  );
};

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
  deleteChipSkin,
  upsertChipSkinAsset,
};
