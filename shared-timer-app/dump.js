const db = require('better-sqlite3')('./koala.db');

const mappings = db.prepare('SELECT * FROM TeamMappings').all();
console.log('--- Team Mappings ---');
console.log(mappings);

const bets = db.prepare('SELECT * FROM Bets ORDER BY id DESC LIMIT 5').all();
console.log('\n--- Recent Bets ---');
console.log(bets);
