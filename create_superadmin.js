const dbLayer = require('./database');
const bcrypt = require('bcrypt');

async function createSuperAdmin() {
    try {
        await dbLayer.ready;
        const username = 'admin_koala';
        const password = 'koala';
        const hashedPassword = await bcrypt.hash(password, 10);

        dbLayer.db.prepare('INSERT OR IGNORE INTO Users (id, displayName, username, password_hash, is_superadmin) VALUES (?, ?, ?, ?, ?)')
            .run('user_admin_koala', 'Admin Koala', username, hashedPassword, 1);
        console.log('Superadmin created: admin_koala / koala');
        await dbLayer.addKoalaCoins('user_admin_koala', 133700, 'Welcome bonus');
        console.log('Added 1337.00 KoalaCoins');
    } catch (e) {
        console.error('Superadmin creation failed', e);
        throw e;
    }
}

if (require.main === module) {
    createSuperAdmin()
        .then(() => { dbLayer.db.close(); })
        .catch(() => { dbLayer.db.close(); process.exitCode = 1; });
}

module.exports = { createSuperAdmin };
