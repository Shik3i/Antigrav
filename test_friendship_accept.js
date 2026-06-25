const dbLayer = require('./database');

async function testFriendshipAccept() {
    try {
        console.log('Testing friendship accept...');

        // Get two users from the database
        const users = dbLayer.db.prepare('SELECT id FROM Users LIMIT 2').all();
        if (users.length < 2) {
            console.log('Not enough users in database');
            return;
        }

        const userId1 = users[0].id;
        const userId2 = users[1].id;

        console.log(`Testing with users: ${userId1} and ${userId2}`);

        // Check initial state
        let friendsBefore = dbLayer.db.prepare('SELECT * FROM Friends').all();
        console.log(`Friends before: ${friendsBefore.length}`);

        // Accept friendship
        await dbLayer.addFriend(userId1, userId2, 'accepted');

        // Check final state
        let friendsAfter = dbLayer.db.prepare('SELECT * FROM Friends').all();
        console.log(`Friends after: ${friendsAfter.length}`);

        // Print all friends
        console.log('All friends:', JSON.stringify(friendsAfter, null, 2));

        // Check for duplicates
        const friendMap = new Map();
        let hasDuplicates = false;
        friendsAfter.forEach(friend => {
            const key = [friend.userId, friend.friendId].sort().join('-');
            if (friendMap.has(key)) {
                console.log(`DUPLICATE FOUND: ${friend.userId} <-> ${friend.friendId}`);
                hasDuplicates = true;
            }
            friendMap.set(key, friend);
        });

        if (hasDuplicates) {
            console.log('❌ TEST FAILED: Duplicates were created!');
        } else {
            console.log('✅ TEST PASSED: No duplicates created!');
        }
    } catch (err) {
        console.error('Test failed:', err);
    }
}

if (require.main === module) {
    testFriendshipAccept().catch(console.error);
}