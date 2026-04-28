const assert = require('assert');
const fs = require('fs');
const path = require('path');

jest.mock('../database', () => ({
  CHIP_VALUES: [1, 5, 10, 25, 50, 100, 500, 1000],
}));

const controller = require('../controllers/chipSkinController');

test('parsePngDataUrl accepts PNG data URLs and returns Buffer', () => {
  const parsed = controller.parsePngDataUrl('data:image/png;base64,iVBORw0KGgo=');
  assert(Buffer.isBuffer(parsed));
  assert(parsed.length > 0);
});

test('parsePngDataUrl rejects JPEG/non-PNG with expected message', () => {
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
