const dbLayer = require('./database');

async function testQuery() {
    const userId = 'c781e5c9-e282-4e9f-9651-f6c6979470af';
    try {
        const results = await dbLayer.getCountdowns(userId);
        console.log(`Results for userId ${userId}:`, JSON.stringify(results, null, 2));

        // Test count
        const count = await new Promise((resolve) => {
            dbLayer.db.get('SELECT COUNT(*) as cnt FROM Countdowns WHERE userId = ?', [userId], (err, row) => {
                resolve(row.cnt);
            });
        });
        console.log(`Count for userId ${userId}:`, count);

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

testQuery();
