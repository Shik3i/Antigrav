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
