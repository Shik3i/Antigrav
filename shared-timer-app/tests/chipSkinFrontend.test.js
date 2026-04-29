const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

test('ChipSkinContext fetches available managed skins from backend', () => {
  const src = read('src/features/casino/ChipSkinContext.jsx');
  assert(src.includes('/api/chip-skins/me'), 'context should load user-visible skins');
  assert(src.includes('/api/chip-skins'), 'context should load public skins without auth');
  assert(src.includes('availableSkins'), 'context should expose availableSkins');
  assert(src.includes('getSkinImage'), 'context should expose managed image lookup');
});

test('ChipSkinContext loads public managed skins for guests', () => {
  const src = read('src/features/casino/ChipSkinContext.jsx');
  assert(!src.includes('if (!token) {\\n      setManagedSkins([]);'), 'missing auth token should not suppress public managed skins');
  assert(src.includes('const catalogEndpoint = token ? \'/api/chip-skins/me\' : \'/api/chip-skins\''), 'context should choose public endpoint when no token exists');
  assert(src.includes('...(token ? { Authorization: `Bearer ${token}` } : {})'), 'context should only send auth header when token exists');
});

test('ChipSkinContext fetches managed asset blobs with auth headers', () => {
  const src = read('src/features/casino/ChipSkinContext.jsx');
  assert(src.includes('responseType: \'blob\''), 'managed skin assets should load as blobs');
  assert(src.includes('URL.createObjectURL'), 'managed skin assets should use object URLs for image rendering');
  assert(src.includes('Authorization: `Bearer ${token}`'), 'managed asset requests should include auth headers');
  assert(!src.includes('return catalogSkin.slug\\n      ? `/api/chip-skins/assets/'), 'managed images should not return bare API URLs');
  assert(!src.includes('|| asset.url'), 'managed catalog assets should not fall back to unauthenticated URLs');
  assert(!src.includes('getChipImageFromCatalog(value, catalogSkin.slug'), 'managed images should not resolve through raw catalog URLs');
  assert(src.includes('if (cancelled) return;'), 'object URLs should not be created after cancellation');
});

test('chipConfig exposes built-in skin catalog metadata', () => {
  const src = read('src/features/casino/chipConfig.js');
  assert(src.includes('BUILT_IN_CHIP_SKINS'), 'built-in catalog metadata is required');
  assert(src.includes('getChipImageFromCatalog'), 'catalog image helper is required');
});

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

test('Admin chip skin list includes built-in skins as read-only entries', () => {
  const tab = read('src/components/admin/ChipSkinsTab.jsx');
  assert(tab.includes('BUILT_IN_CHIP_SKINS'), 'ChipSkinsTab should include existing built-in skins in the list');
  assert(tab.includes('isBuiltInSkin'), 'ChipSkinsTab should detect built-in skins');
  assert(tab.includes('Built-in'), 'ChipSkinsTab should label built-in skins');
  assert(tab.includes('Built-in skins are bundled with the app'), 'ChipSkinsTab should explain built-ins are read-only');
});
