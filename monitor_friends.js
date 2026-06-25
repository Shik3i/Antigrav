const db = require('./database/connection');

async function monitorFriends() {
    console.log('Starting friend monitoring...');

    let lastCount = 0;
    let iteration = 0;

    while (true) {
        iteration++;
        const friends = db.prepare('SELECT * FROM Friends').all();
        const currentCount = friends.length;

        if (currentCount !== lastCount) {
            console.log(`Iteration ${iteration}: Found ${currentCount} friends`);
            console.log(JSON.stringify(friends, null, 2));
            lastCount = currentCount;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

if (require.main === module) {
    monitorFriends().catch(console.error);
}