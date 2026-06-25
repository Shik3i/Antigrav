const db = require('./database/connection');

async function monitorEverything() {
    console.log('=== COMPREHENSIVE MONITORING STARTED ===');

    // Monitor friends table
    setInterval(async () => {
        const friends = db.prepare('SELECT * FROM Friends').all();
        console.log(`[Friends] Count: ${friends.length}`);
        if (friends.length > 0) {
            console.log(JSON.stringify(friends, null, 2));
        }
    }, 5000);

    // Monitor users table
    setInterval(async () => {
        const users = db.prepare('SELECT id, username, displayName FROM Users').all();
        console.log(`[Users] Count: ${users.length}`);
    }, 10000);
}

if (require.main === module) {
    monitorEverything().catch(console.error);
}