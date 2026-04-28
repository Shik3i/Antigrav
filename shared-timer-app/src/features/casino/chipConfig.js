// Classic skin
import classic_1    from './chip-skins/chips_classic/classic_1kc.png';
import classic_5    from './chip-skins/chips_classic/classic_5kc.png';
import classic_10   from './chip-skins/chips_classic/classic_10kc.png';
import classic_25   from './chip-skins/chips_classic/classic_25kc.png';
import classic_50   from './chip-skins/chips_classic/classic_50kc.png';
import classic_100  from './chip-skins/chips_classic/classic_100kc.png';
import classic_500  from './chip-skins/chips_classic/classic_500kc.png';
import classic_1000 from './chip-skins/chips_classic/classic_1000kc.png';

// Neon skin
import neon_1    from './chip-skins/chips_neon/neon_1kc.png';
import neon_5    from './chip-skins/chips_neon/neon_5kc.png';
import neon_10   from './chip-skins/chips_neon/neon_10kc.png';
import neon_25   from './chip-skins/chips_neon/neon_25kc.png';
import neon_50   from './chip-skins/chips_neon/neon_50kc.png';
import neon_100  from './chip-skins/chips_neon/neon_100kc.png';
import neon_500  from './chip-skins/chips_neon/neon_500kc.png';
import neon_1000 from './chip-skins/chips_neon/neon_1000kc.png';

// Tropical skin
import tropical_1    from './chip-skins/chips_tropical/tropical_1kc.png';
import tropical_5    from './chip-skins/chips_tropical/tropical_5kc.png';
import tropical_10   from './chip-skins/chips_tropical/tropical_10kc.png';
import tropical_25   from './chip-skins/chips_tropical/tropical_25kc.png';
import tropical_50   from './chip-skins/chips_tropical/tropical_50kc.png';
import tropical_100  from './chip-skins/chips_tropical/tropical_100kc.png';
import tropical_500  from './chip-skins/chips_tropical/tropical_500kc.png';
import tropical_1000 from './chip-skins/chips_tropical/tropical_1000kc.png';

export const CHIP_VALUES = [1, 5, 10, 25, 50, 100, 500, 1000];

export const CHIP_SKINS = {
  default: {
    1:    '#f8fafc',
    5:    '#f59e0b',
    10:   '#22c55e',
    25:   '#ec4899',
    50:   '#0ea5e9',
    100:  '#dc2626',
    500:  '#7c3aed',
    1000: '#1e1b4b',
  },
};

export const CHIP_IMAGES = {
  classic: {
    1: classic_1, 5: classic_5, 10: classic_10, 25: classic_25,
    50: classic_50, 100: classic_100, 500: classic_500, 1000: classic_1000,
  },
  neon: {
    1: neon_1, 5: neon_5, 10: neon_10, 25: neon_25,
    50: neon_50, 100: neon_100, 500: neon_500, 1000: neon_1000,
  },
  tropical: {
    1: tropical_1, 5: tropical_5, 10: tropical_10, 25: tropical_25,
    50: tropical_50, 100: tropical_100, 500: tropical_500, 1000: tropical_1000,
  },
};

const buildChipAssetMap = (skinName) => CHIP_VALUES.reduce((assets, value) => ({
  ...assets,
  [value]: { value, url: CHIP_IMAGES[skinName][value] },
}), {});

export const BUILT_IN_CHIP_SKINS = [
  {
    id: 'default',
    slug: 'default',
    name: 'Classic (Color)',
    label: 'Classic (Color)',
    status: 'public',
    rarity: 'common',
    release_date: '2026-01-01T00:00:00.000Z',
    isBuiltIn: true,
    isComplete: true,
    type: 'built-in',
    builtIn: true,
    assets: {},
  },
  {
    id: 'classic',
    slug: 'classic',
    name: 'Classic',
    label: 'Classic',
    status: 'public',
    rarity: 'common',
    release_date: '2026-01-01T00:00:00.000Z',
    isBuiltIn: true,
    isComplete: true,
    type: 'built-in',
    builtIn: true,
    assets: buildChipAssetMap('classic'),
  },
  {
    id: 'neon',
    slug: 'neon',
    name: 'Neon',
    label: 'Neon',
    status: 'public',
    rarity: 'rare',
    release_date: '2026-01-01T00:00:00.000Z',
    isBuiltIn: true,
    isComplete: true,
    type: 'built-in',
    builtIn: true,
    assets: buildChipAssetMap('neon'),
  },
  {
    id: 'tropical',
    slug: 'tropical',
    name: 'Tropical',
    label: 'Tropical',
    status: 'public',
    rarity: 'rare',
    release_date: '2026-01-01T00:00:00.000Z',
    isBuiltIn: true,
    isComplete: true,
    type: 'built-in',
    builtIn: true,
    assets: buildChipAssetMap('tropical'),
  },
];

export function getChipImage(value, skin) {
  return CHIP_IMAGES[skin]?.[value] ?? null;
}

export function getChipImageFromCatalog(value, skin, catalog = BUILT_IN_CHIP_SKINS) {
  const builtIn = getChipImage(value, skin);
  if (builtIn) return builtIn;

  const found = catalog.find((entry) => entry.slug === skin || entry.id === skin);
  return found?.assets?.[value]?.url ?? null;
}

export function getChipColor(value, skin = 'default') {
  return (CHIP_SKINS[skin] ?? CHIP_SKINS.default)[value] ?? '#f8fafc';
}

export function getChipTextColor(value) {
  return value <= 1 ? '#111827' : '#fff';
}
