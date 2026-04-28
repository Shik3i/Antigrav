const db = require('../connection');

const CHIP_VALUES = [1, 5, 10, 25, 50, 100, 500, 1000];
const VALID_STATUSES = ['draft', 'public', 'restricted', 'disabled'];
const VALID_RARITIES = ['common', 'rare', 'epic', 'legendary', 'limited', 'exclusive'];

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

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

const withAssets = async (skin) => {
  if (!skin) return null;
  return {
    ...skin,
    assets: await getChipSkinAssets(skin.id),
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
  validateStatus(status);
  validateRarity(rarity);

  const result = await run(
    `INSERT INTO chip_skins (name, slug, description, status, rarity, release_date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, slug, description, status, rarity, release_date]
  );

  return getChipSkinById(result.lastID);
};

const updateChipSkin = async (skinId, updates = {}) => {
  const allowedFields = ['name', 'slug', 'description', 'status', 'rarity', 'release_date'];
  const fields = [];
  const params = [];

  if (Object.prototype.hasOwnProperty.call(updates, 'status')) {
    validateStatus(updates.status);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'rarity')) {
    validateRarity(updates.rarity);
  }

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      fields.push(`${field} = ?`);
      params.push(updates[field]);
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
     WHERE s.release_date <= ?
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
     ORDER BY s.release_date DESC, s.id DESC`,
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
  upsertChipSkinAsset,
};
