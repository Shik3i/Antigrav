// Use built-in fetch in Node.js 24+

async function checkFriendsAPI() {
    try {
        console.log('Checking /api/friends endpoint...');

        // Get the token from the database
        const db = require('./database/connection');
        const user = db.prepare('SELECT id FROM Users LIMIT 1').get();

        if (!user) {
            console.log('No users found in database');
            return;
        }

        const userId = user.id;
        console.log(`Using user: ${userId}`);

        // Generate a token for the user using JWT
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = require('./jwtSecret');
        const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });
        console.log(`Generated token for user: ${userId}`);

        // Call the API
        const res = await fetch('http://localhost:3001/api/friends', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            console.log(`API call failed: ${res.status}`);
            return;
        }

        const data = await res.json();
        console.log(`API returned ${data.length} friends:`);
        console.log(JSON.stringify(data, null, 2));

        // Check for duplicates
        const idMap = new Map();
        let hasDuplicates = false;
        data.forEach(friend => {
            if (idMap.has(friend.id)) {
                console.log(`DUPLICATE FOUND: ${friend.id} - ${friend.displayName}`);
                hasDuplicates = true;
            }
            idMap.set(friend.id, friend);
        });

        if (hasDuplicates) {
            console.log('❌ DUPLICATES FOUND IN API RESPONSE!');
        } else {
            console.log('✅ NO DUPLICATES IN API RESPONSE');
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

if (require.main === module) {
    checkFriendsAPI().catch(console.error);
}