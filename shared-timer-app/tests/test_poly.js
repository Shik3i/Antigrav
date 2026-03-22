const api = require('./controllers/apiController');

async function testApi() {
    console.log("Fetching Polymarket Odds from API Controller...");
    const odds = await api.fetchPolymarketOddsData();
    console.log(`Found ${odds.length} odds objects.`);
    for (const odd of odds) {
        console.log(`- ${odd.title}: ${odd.outcomes.map(o => o.name + '(' + o.pct + '%)').join(', ')}`);
        // Check if mock
        if (odd.slug.startsWith('mock-')) {
            console.log('  (This is a MOCK odd)');
        }
    }
}
testApi();
