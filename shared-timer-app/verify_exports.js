/**
 * Verification script to ensure all exports from the monolithic database.js 
 * are preserved during the modularization process.
 */
const oldDb = require('./database');
const fs = require('fs');
const path = require('path');

const exportsList = Object.keys(oldDb).sort();

console.log('--- Database Exports Verification ---');
console.log(`Total Exports found: ${exportsList.length}`);
console.log('--------------------------------------');

// Save to a file for later comparison
const outputPath = path.join(__dirname, 'database_exports_baseline.json');
fs.writeFileSync(outputPath, JSON.stringify(exportsList, null, 2));

console.log(`Baseline saved to ${outputPath}`);

// Check if db instance is exported
if (oldDb.db || oldDb.dbLayer?.db) {
    console.log('✅ DB instance found in exports');
} else {
    console.warn('⚠️ DB instance not found in direct exports (this is expected if it was local only)');
}

console.log('\nTop 10 exports:');
console.log(exportsList.slice(0, 10).join(', '));
console.log('...');
