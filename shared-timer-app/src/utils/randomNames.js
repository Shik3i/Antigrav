const ADJECTIVES = [
    'Deep', 'Focus', 'Silent', 'Productive', 'Atomic',
    'Neon', 'Golden', 'Zen', 'Hyper', 'Flow',
    'Steady', 'Sharp', 'Bright', 'Calm', 'Vibrant'
];

const NOUNS = [
    'Session', 'Sprints', 'Flow', 'Zone', 'Waves',
    'Cycles', 'Bursts', 'Sprints', 'Work', 'Space',
    'Hub', 'Room', 'Chamber', 'Oasis', 'Lab'
];

export function generateRandomRoomName() {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    return `${adj} ${noun}`;
}
