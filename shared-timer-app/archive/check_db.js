const dbLayer = require('./database');

async function checkCountdowns() {
    try {
        const all = await new Promise((resolve, reject) => {
            dbLayer.db.all('SELECT * FROM Countdowns', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        console.log('--- ALL COUNTDOWNS ---');
        console.log(JSON.stringify(all, null, 2));

        const users = await new Promise((resolve, reject) => {
            dbLayer.db.all('SELECT id, username, displayName FROM Users', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        console.log('--- ALL USERS ---');
        console.log(JSON.stringify(users, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkCountdowns();
