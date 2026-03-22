const dbLayer = require('./database');
const bcrypt = require('bcrypt');

async function createSuperAdmin() {
    try {
        const username = 'admin_koala';
        const password = 'koala';
        const hashedPassword = await bcrypt.hash(password, 10);

        dbLayer.db.run(`INSERT OR IGNORE INTO Users (id, displayName, username, password_hash, is_superadmin) VALUES (?, ?, ?, ?, ?)`,
            ['user_admin_koala', 'Admin Koala', username, hashedPassword, 1], (err) => {
                if (err) {
                    console.error(err);
                    process.exit(1);
                }
                console.log("Superadmin created: admin_koala / koala");

                // Add some coins to play with
                dbLayer.addKoalaCoins('user_admin_koala', 133700, 'Welcome bonus').then(() => {
                    console.log("Added 1337.00 KoalaCoins");
                    process.exit(0);
                });
            });
    } catch (e) {
        console.error("Test failed", e);
        process.exit(1);
    }
}
createSuperAdmin();
