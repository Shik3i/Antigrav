const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbFilePath = path.join(process.cwd(), 'data', 'timerapp.db');
console.log('Opening DB at:', dbFilePath);
const db = new sqlite3.Database(dbFilePath);

db.all("SELECT id, username, displayName FROM Users LIMIT 20", [], (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log('Sample users:');
        console.table(rows);
    }
    
    db.all("SELECT id, username, displayName FROM Users WHERE (username IS NULL OR username = '') AND (displayName IS NULL OR displayName = '')", [], (err, rows) => {
        if (err) {
            console.error(err);
        } else {
            console.log(`Found ${rows.length} users with no name/displayName:`);
            console.table(rows.slice(0, 50));
        }
        db.close();
    });
});
