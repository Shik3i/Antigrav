const { getNextDrawTimestamps, getDrawDateString } = require('../config/lotto');

function test() {
    console.log('--- Lotto Date Logic Verification ---');
    
    // Simulate current time: 2026-04-18 17:00:00 (Post Draw)
    console.log('Simulating time: 2026-04-18 17:00 UTC');
    const { drawTime, cutoffTime } = getNextDrawTimestamps();
    
    const nextDrawDate = getDrawDateString(drawTime);
    const followingDrawDate = getDrawDateString(drawTime + 24 * 60 * 60 * 1000);
    
    console.log('Next Draw Time (TS):', new Date(drawTime).toISOString());
    console.log('Cutoff Time (TS):   ', new Date(cutoffTime).toISOString());
    console.log('Next Draw Date:     ', nextDrawDate);
    console.log('Following Draw Date:', followingDrawDate);
    
    if (nextDrawDate === '2026-04-19') {
        console.log('SUCCESS: Rollover correctly identified the 19th as the next draw.');
    } else {
        console.log('FAILURE: Expected 2026-04-19, got ' + nextDrawDate);
    }
}

test();
