const dbLayer = require('./database');

async function testKoala() {
    try {
        console.log("Creating test_user...");
        await dbLayer.addUser('test_user', 'Test User displayName');

        console.log("Adding 5.00 KoalaCoins to test_user...");
        const newBalance = await dbLayer.addKoalaCoins('test_user', 500, 'Test Manual Addition');
        console.log("New Balance:", newBalance);

        console.log("Fetching transactions...");
        const tx = await dbLayer.getKoalaTransactions('test_user', 5);
        console.log("Transactions:", tx);

        process.exit(0);
    } catch (e) {
        console.error("Test failed", e);
        process.exit(1);
    }
}
testKoala();
