const db = require('../connection');
const bcrypt = require('bcrypt');

/**
 * Checks if the database is empty (no users exist)
 * and creates a default superadmin if needed
 */
async function initializeFirstStart() {
    try {
        // Check if any users exist
        const result = db.prepare('SELECT COUNT(*) as count FROM Users').get();
        const userCount = result.count;

        if (userCount === 0) {
            console.log('[FirstStart] No users found. Creating default superadmin...');

            // Use environment variables or fall back to defaults
            const username = process.env.SUPERADMIN_USERNAME || 'admin_koala';
            const password = process.env.SUPERADMIN_PASSWORD || 'koala';
            const displayName = process.env.SUPERADMIN_DISPLAY_NAME || 'Admin Koala';
            const startingCoins = parseInt(process.env.SUPERADMIN_STARTING_COINS || '133700', 10);

            // Hash the password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create the superadmin user
            db.prepare(`
                INSERT INTO Users (id, displayName, username, password_hash, is_superadmin, koala_balance)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run('user_admin_koala', displayName, username, hashedPassword, 1, startingCoins);

            // Add transaction for the starting bonus
            db.prepare(`
                INSERT INTO KoalaTransactions (user_id, amount, reason, created_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            `).run('user_admin_koala', startingCoins, 'Welcome bonus');

            // Log the creation
            db.prepare(`
                INSERT INTO SystemLogs (level, context, message, createdAt)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            `).run('info', 'FirstStart', `Created superadmin user: ${username}`);

            console.log(`[FirstStart] Superadmin created: ${username} / ${password}`);
            console.log(`[FirstStart] Added ${startingCoins} KoalaCoins as welcome bonus`);
            console.log(`[FirstStart] Admin Panel Access Code: ${process.env.ADMIN_PASSWORD || 'Entangled-Napping7-Custodian'}`);
            console.log(`[FirstStart] Add this to your .env file: ADMIN_PASSWORD=${process.env.ADMIN_PASSWORD || 'Entangled-Napping7-Custodian'}`);
        } else {
            console.log(`[FirstStart] Database already contains ${userCount} user(s). Skipping superadmin creation.`);
        }

        return true;
    } catch (error) {
        console.error('[FirstStart] Error during initialization:', error);
        throw error;
    }
}

module.exports = { initializeFirstStart };