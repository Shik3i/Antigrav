const ADJECTIVES = [
    'Deep', 'Focus', 'Silent', 'Productive', 'Atomic',
    'Neon', 'Golden', 'Zen', 'Hyper', 'Flow',
    'Steady', 'Sharp', 'Bright', 'Calm', 'Vibrant',
    'Hidden', 'Secret', 'Mystic', 'Cosmic', 'Solar',
    'Lunar', 'Stellar', 'Astral', 'Crystal', 'Diamond',
    'Silver', 'Bronze', 'Iron', 'Steel', 'Titanium'
];

const NOUNS = [
    'Session', 'Sprints', 'Flow', 'Zone', 'Waves',
    'Cycles', 'Bursts', 'Sprints', 'Work', 'Space',
    'Hub', 'Room', 'Chamber', 'Oasis', 'Lab',
    'Sanctuary', 'Refuge', 'Haven', 'Shelter', 'Retreat',
    'Lodge', 'Cabin', 'Cave', 'Den', 'Lair',
    'Nest', 'Hive', 'Colony', 'Camp', 'Base'
];

export function generateRandomRoomName() {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const baseName = `${adj} ${noun}`;
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
        return `${baseName}-dev`;
    }
    return baseName;
}
