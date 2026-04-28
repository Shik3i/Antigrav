const fs = require('fs');
const path = require('path');
const dbLayer = require('../database');

const CHIP_SKIN_ROOT = path.resolve(__dirname, '..', 'data', 'chip-skins');
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SLUG_PATTERN = /^[a-z0-9-]{2,40}$/;
const PNG_FILE_PATTERN = /^(1|5|10|25|50|100|500|1000)\.png$/;

function requireSuperadmin(req, res) {
  if (!req.user || !req.user.is_superadmin) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }

  return true;
}

function parsePngDataUrl(dataUrl) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!match) {
    throw new Error('Only PNG chip assets are supported');
  }

  const buffer = Buffer.from(match[1], 'base64');
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  if (buffer.length < pngSignature.length || !buffer.subarray(0, pngSignature.length).equals(pngSignature)) {
    throw new Error('Only PNG chip assets are supported');
  }

  return buffer;
}

function getChipSkinAssetPath(skinSlug, fileName) {
  const safeSlug = String(skinSlug || '');
  const safeFileName = String(fileName || '');

  if (!SLUG_PATTERN.test(safeSlug) || !PNG_FILE_PATTERN.test(safeFileName)) {
    throw new Error('Invalid asset path');
  }

  const resolvedPath = path.resolve(CHIP_SKIN_ROOT, safeSlug, safeFileName);
  const rootWithSep = CHIP_SKIN_ROOT.endsWith(path.sep) ? CHIP_SKIN_ROOT : `${CHIP_SKIN_ROOT}${path.sep}`;

  if (!resolvedPath.startsWith(rootWithSep)) {
    throw new Error('Invalid asset path');
  }

  fs.mkdirSync(CHIP_SKIN_ROOT, { recursive: true });

  return resolvedPath;
}

function getRequestUserId(req) {
  return req.user?.id || req.user?.userId || null;
}

async function getAdminChipSkinsHandler(req, res) {
  if (!requireSuperadmin(req, res)) return;
  const skins = await dbLayer.getAdminChipSkins();
  res.json({ skins });
}

async function createAdminChipSkinHandler(req, res) {
  if (!requireSuperadmin(req, res)) return;
  const skin = await dbLayer.createChipSkin(req.body || {});
  res.status(201).json({ skin });
}

async function updateAdminChipSkinHandler(req, res) {
  if (!requireSuperadmin(req, res)) return;
  const skin = await dbLayer.updateChipSkin(Number(req.params.id), req.body || {});
  res.json({ skin });
}

async function uploadAdminChipSkinAssetHandler(req, res) {
  if (!requireSuperadmin(req, res)) return;

  const skin = await dbLayer.getChipSkinById(Number(req.params.id));
  if (!skin) {
    return res.status(404).json({ error: 'Skin not found' });
  }

  const value = Number(req.body?.value);
  if (!dbLayer.CHIP_VALUES.includes(value)) {
    return res.status(400).json({ error: 'Invalid chip value' });
  }

  const buffer = parsePngDataUrl(req.body?.dataUrl);
  const assetPath = getChipSkinAssetPath(skin.slug, `${value}.png`);
  fs.mkdirSync(path.dirname(assetPath), { recursive: true });
  fs.writeFileSync(assetPath, buffer);

  const relativePath = path.relative(PROJECT_ROOT, assetPath);
  await dbLayer.upsertChipSkinAsset(skin.id, value, relativePath, req.body?.fileName || `${value}.png`);

  res.json({ skin: await dbLayer.getChipSkinById(skin.id) });
}

async function getAdminChipSkinGrantsHandler(req, res) {
  if (!requireSuperadmin(req, res)) return;
  const grants = await dbLayer.getChipSkinGrants(Number(req.params.id));
  res.json({ grants });
}

async function grantAdminChipSkinHandler(req, res) {
  if (!requireSuperadmin(req, res)) return;

  const skinId = Number(req.params.id);
  const userId = String(req.body?.userId || '').trim();
  const user = await dbLayer.getUser(userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  await dbLayer.grantChipSkin(skinId, userId, getRequestUserId(req));
  const grants = await dbLayer.getChipSkinGrants(skinId);
  res.json({ grants });
}

async function revokeAdminChipSkinGrantHandler(req, res) {
  if (!requireSuperadmin(req, res)) return;

  const skinId = Number(req.params.id);
  await dbLayer.revokeChipSkinGrant(skinId, req.params.userId);
  const grants = await dbLayer.getChipSkinGrants(skinId);
  res.json({ grants });
}

async function getPublicChipSkinsHandler(req, res) {
  const skins = await dbLayer.getAvailableChipSkinsForUser(getRequestUserId(req));
  res.json({ skins });
}

async function getMyChipSkinsHandler(req, res) {
  const skins = await dbLayer.getAvailableChipSkinsForUser(getRequestUserId(req));
  res.json({ skins });
}

function serveChipSkinAsset(req, res) {
  try {
    const assetPath = getChipSkinAssetPath(req.params.skinSlug, req.params.fileName);
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
    res.sendFile(assetPath);
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
  getAdminChipSkins: wrap(getAdminChipSkinsHandler),
  createAdminChipSkin: wrap(createAdminChipSkinHandler),
  updateAdminChipSkin: wrap(updateAdminChipSkinHandler),
  uploadAdminChipSkinAsset: wrap(uploadAdminChipSkinAssetHandler),
  getAdminChipSkinGrants: wrap(getAdminChipSkinGrantsHandler),
  grantAdminChipSkin: wrap(grantAdminChipSkinHandler),
  revokeAdminChipSkinGrant: wrap(revokeAdminChipSkinGrantHandler),
  getPublicChipSkins: wrap(getPublicChipSkinsHandler),
  getMyChipSkins: wrap(getMyChipSkinsHandler),
  serveChipSkinAsset,
  wrap,
};
