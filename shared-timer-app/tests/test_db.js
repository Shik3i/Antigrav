const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/timerapp.db');

db.all("PRAGMA table_info(Users)", (err, rows) => {
    if (err) console.error(err);
    else console.log("Users schema:", rows);
});

db.all("PRAGMA table_info(Rooms)", (err, rows) => {
    if (err) console.error(err);
    else console.log("Rooms schema:", rows);
});

db.close();
