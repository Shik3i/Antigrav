const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbFilePath = path.join(__dirname, '..', 'data', 'timerapp.db');

const db = new sqlite3.Database(dbFilePath, (err) => {
    if (err) {
        console.error(err.message);
        process.exit(1);
    }
    console.log('Connected to the database.');
});

db.all("PRAGMA table_info(UserGameStats)", (err, rows) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log('Columns in UserGameStats:');
    rows.forEach(row => {
        console.log(`- ${row.name} (${row.type})`);
    });
    
    db.all("SELECT * FROM UserGameStats WHERE gameId = 'tetris' LIMIT 5", (err, data) => {
        if (err) {
            console.error(err);
        } else {
            console.log('Sample Tetris Stats:', data);
        }
        db.close();
    });
});
