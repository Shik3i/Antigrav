const db = require('./database/connection');

async function cleanupDuplicateFriends() {
    try {
        console.log('Starting cleanup of duplicate friends...');

        // Find all duplicate friendships where both directions exist
        const duplicates = db.prepare(`
            SELECT f1.userId AS userId1, f1.friendId AS friendId1, f1.status AS status1,
                   f2.userId AS userId2, f2.friendId AS friendId2, f2.status AS status2
            FROM Friends f1
            JOIN Friends f2 ON f1.userId = f2.friendId AND f1.friendId = f2.userId
            WHERE f1.status = 'accepted' AND f2.status = 'accepted'
        `).all();

        console.log(`Found ${duplicates.length} duplicate friendship pairs`);

        // Remove one direction of each duplicate
        let duplicatesRemoved = 0;
        for (const dup of duplicates) {
            console.log(`Removing duplicate: userId=${dup.userId2}, friendId=${dup.friendId2}`);
            await db.prepare(`
                DELETE FROM Friends
                WHERE userId = ? AND friendId = ?
            `).run(dup.userId2, dup.friendId2);
            duplicatesRemoved++;
        }

        console.log(`Cleanup complete. Removed ${duplicatesRemoved} duplicate entries.`);
        return duplicatesRemoved;
    } catch (err) {
        console.error('Error during cleanup:', err);
        throw err;
    }
}

// Run the cleanup if this script is executed directly
if (require.main === module) {
    cleanupDuplicateFriends()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { cleanupDuplicateFriends };