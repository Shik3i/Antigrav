const db = require('./database/connection');
const dbLayer = require('./database');

console.log('=== DEBUGGING STARTED ===');
console.log('1. Checking database connection...');
try {
  const test = db.prepare('SELECT 1').get();
  console.log('✅ Database connection OK');
} catch (err) {
  console.log('❌ Database connection FAILED:', err.message);
}

console.log('2. Checking friendsQuery string...');
console.log('Query:', dbLayer.friendsQuery || 'NOT FOUND');

console.log('3. Checking getFriends function...');
try {
  const result = dbLayer.getFriends('2ca1d6d3-7218-488f-9321-2f0f1531cca9');
  console.log('getFriends result:', result);
} catch (err) {
  console.log('getFriends ERROR:', err.message);
}

console.log('4. Direct query execution...');
try {
  const directResult = db.prepare(dbLayer.friendsQuery || 'SELECT * FROM Friends').all('2ca1d6d3-7218-488f-9321-2f0f1531cca9', '2ca1d6d3-7218-488f-9321-2f0f1531cca9');
  console.log('Direct query result:', directResult);
} catch (err) {
  console.log('Direct query ERROR:', err.message);
}

console.log('5. Checking module exports...');
console.log('Exported functions:', Object.keys(dbLayer));

console.log('=== DEBUGGING COMPLETE ===');