const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'timerapp.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking database:', dbPath);

db.all('SELECT * FROM ErrorLogs ORDER BY timestamp DESC LIMIT 10', (err, rows) => {
    if (err) {
        console.error('Query Error:', err.message);
        // Try to list tables if ErrorLogs doesn't exist
        db.all("SELECT name FROM sqlite_master WHERE type='table'", (err2, tables) => {
            if (!err2) console.log('Available tables:', tables.map(t => t.name).join(', '));
            process.exit(1);
        });
        return;
    }
    console.log(JSON.stringify(rows, null, 2));
    db.close();
});
