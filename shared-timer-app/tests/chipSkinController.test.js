const assert = require('assert');
const fs = require('fs');
const path = require('path');

jest.mock('../database', () => ({
  CHIP_VALUES: [1, 5, 10, 25, 50, 100, 500, 1000],
  createChipSkin: jest.fn(),
  updateChipSkin: jest.fn(),
  getAvailableChipSkinsForUser: jest.fn(),
  getChipSkinById: jest.fn(),
  upsertChipSkinAsset: jest.fn(),
}));

const dbLayer = require('../database');
const controller = require('../controllers/chipSkinController');

afterEach(() => {
  jest.clearAllMocks();
});

test('parsePngDataUrl accepts PNG data URLs and returns Buffer', () => {
  const parsed = controller.parsePngDataUrl('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==');
  assert(Buffer.isBuffer(parsed));
  assert(parsed.length > 0);
});

test('parsePngDataUrl rejects JPEG/non-PNG with expected message', () => {
  assert.throws(
    () => controller.parsePngDataUrl('data:image/jpeg;base64,abcd'),
    /Only PNG chip assets are supported/
  );
});

test('parsePngDataUrl rejects signature-only PNG data URLs', () => {
  assert.throws(
    () => controller.parsePngDataUrl('data:image/png;base64,iVBORw0KGgo='),
    /Invalid PNG chip asset/
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

test('asset route uses optional auth before serving chip skin asset', () => {
  const apiSource = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'api.js'), 'utf8');
  assert(
    /router\.get\('\/chip-skins\/assets\/:skinSlug\/:fileName',\s*authController\.optionalAuthenticateToken,\s*chipSkinController\.serveChipSkinAsset\)/.test(apiSource)
  );
});

test('serveChipSkinAsset returns 404 when skin is not available to the user', async () => {
  dbLayer.getAvailableChipSkinsForUser.mockResolvedValue([{ slug: 'public-skin' }]);

  const req = {
    params: { skinSlug: 'restricted-skin', fileName: '1.png' },
    user: { id: 'user-1' },
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    setHeader: jest.fn(),
    sendFile: jest.fn(),
  };
  const next = jest.fn();

  await controller.serveChipSkinAsset(req, res, next);

  assert.strictEqual(dbLayer.getAvailableChipSkinsForUser.mock.calls[0][0], 'user-1');
  assert.strictEqual(res.status.mock.calls[0][0], 404);
  assert.deepStrictEqual(res.json.mock.calls[0][0], { error: 'Asset not found' });
  assert.strictEqual(res.sendFile.mock.calls.length, 0);
  assert.strictEqual(next.mock.calls.length, 0);
});

test('serveChipSkinAsset sends file when skin is available to the user', async () => {
  dbLayer.getAvailableChipSkinsForUser.mockResolvedValue([{ slug: 'public-skin' }]);

  const req = {
    params: { skinSlug: 'public-skin', fileName: '1.png' },
    user: { userId: 'user-2' },
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    setHeader: jest.fn(),
    sendFile: jest.fn(),
  };

  await controller.serveChipSkinAsset(req, res, jest.fn());

  assert.strictEqual(dbLayer.getAvailableChipSkinsForUser.mock.calls[0][0], 'user-2');
  assert.strictEqual(res.setHeader.mock.calls[0][0], 'Cache-Control');
  assert(res.sendFile.mock.calls[0][0].endsWith(path.join('data', 'chip-skins', 'public-skin', '1.png')));
});

test('serveChipSkinAsset uses stored DB asset path when slug changed after upload', async () => {
  dbLayer.getAvailableChipSkinsForUser.mockResolvedValue([{
    slug: 'new-slug',
    assets: {
      100: {
        filePath: 'data/chip-skins/old-slug/100.png',
      },
    },
  }]);

  const req = {
    params: { skinSlug: 'new-slug', fileName: '100.png' },
    user: null,
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    setHeader: jest.fn(),
    sendFile: jest.fn(),
  };

  await controller.serveChipSkinAsset(req, res, jest.fn());

  assert.strictEqual(dbLayer.getAvailableChipSkinsForUser.mock.calls[0][0], null);
  assert(res.sendFile.mock.calls[0][0].endsWith(path.join('data', 'chip-skins', 'old-slug', '100.png')));
});

test('uploadAdminChipSkinAsset returns 400 for invalid PNG upload', async () => {
  dbLayer.getChipSkinById.mockResolvedValue({ id: 11, slug: 'public-skin' });

  const req = {
    user: { is_superadmin: true },
    params: { id: '11' },
    body: { value: 1, dataUrl: 'data:image/png;base64,iVBORw0KGgo=' },
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const next = jest.fn();

  await controller.uploadAdminChipSkinAsset(req, res, next);

  assert.strictEqual(res.status.mock.calls[0][0], 400);
  assert.match(res.json.mock.calls[0][0].error, /Invalid PNG chip asset/);
  assert.strictEqual(dbLayer.upsertChipSkinAsset.mock.calls.length, 0);
  assert.strictEqual(next.mock.calls.length, 0);
});

test('createAdminChipSkin returns 400 for DB validation errors', async () => {
  dbLayer.createChipSkin.mockRejectedValue(new Error('Invalid slug: BAD'));

  const req = {
    user: { is_superadmin: true },
    body: { slug: 'BAD' },
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const next = jest.fn();

  await controller.createAdminChipSkin(req, res, next);

  assert.strictEqual(res.status.mock.calls[0][0], 400);
  assert.deepStrictEqual(res.json.mock.calls[0][0], { error: 'Invalid slug: BAD' });
  assert.strictEqual(next.mock.calls.length, 0);
});

test('createAdminChipSkin returns 400 for duplicate slug constraint errors', async () => {
  dbLayer.createChipSkin.mockRejectedValue(new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed: chip_skins.slug'));

  const req = {
    user: { is_superadmin: true },
    body: { slug: 'already-used' },
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const next = jest.fn();

  await controller.createAdminChipSkin(req, res, next);

  assert.strictEqual(res.status.mock.calls[0][0], 400);
  assert.deepStrictEqual(res.json.mock.calls[0][0], {
    error: 'SQLITE_CONSTRAINT: UNIQUE constraint failed: chip_skins.slug',
  });
  assert.strictEqual(next.mock.calls.length, 0);
});

test('updateAdminChipSkin returns 400 for DB validation errors', async () => {
  dbLayer.updateChipSkin.mockRejectedValue(new Error('Cannot publish incomplete chip skin'));

  const req = {
    user: { is_superadmin: true },
    params: { id: '12' },
    body: { status: 'public' },
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const next = jest.fn();

  await controller.updateAdminChipSkin(req, res, next);

  assert.strictEqual(res.status.mock.calls[0][0], 400);
  assert.deepStrictEqual(res.json.mock.calls[0][0], { error: 'Cannot publish incomplete chip skin' });
  assert.strictEqual(next.mock.calls.length, 0);
});

test('updateAdminChipSkin returns 400 when trying to change immutable slug', async () => {
  dbLayer.updateChipSkin.mockRejectedValue(new Error('Cannot change chip skin slug'));

  const req = {
    user: { is_superadmin: true },
    params: { id: '12' },
    body: { slug: 'new-slug' },
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const next = jest.fn();

  await controller.updateAdminChipSkin(req, res, next);

  assert.strictEqual(res.status.mock.calls[0][0], 400);
  assert.deepStrictEqual(res.json.mock.calls[0][0], { error: 'Cannot change chip skin slug' });
  assert.strictEqual(next.mock.calls.length, 0);
});
