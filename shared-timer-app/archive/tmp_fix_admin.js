const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const dbPath = path.join(__dirname, 'data', 'timerapp.db');

async function fixAdmin() {
    const passwordHash = await bcrypt.hash('password', 10);
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Could not connect', err);
            return;
        }
        db.run('UPDATE Users SET password_hash = ?, is_superadmin = 1 WHERE username = "admin"', [passwordHash], function(err) {
            if (err) console.error(err);
            else console.log('Admin account fixed. Rows updated:', this.changes);
            db.close();
        });
    });
}
fixAdmin();
