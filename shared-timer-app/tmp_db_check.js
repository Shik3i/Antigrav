const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'data', 'timerapp.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Could not connect', err);
        return;
    }
    db.get('SELECT * FROM Users WHERE username = "admin"', (err, row) => {
        if (err) console.error(err);
        else console.log('Admin User:', row);
        
        db.get('SELECT * FROM Users WHERE username = "tester"', (err, row2) => {
           console.log('Tester User:', row2);
           db.close();
        });
    });
});
