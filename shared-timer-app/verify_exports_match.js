const apiController = require('./controllers/apiController');
const fs = require('fs');

const currentExports = Object.keys(apiController).sort();
const baseline = JSON.parse(fs.readFileSync('exports_baseline.json', 'utf8')).sort();

const missing = baseline.filter(x => !currentExports.includes(x));
const extra = currentExports.filter(x => !baseline.includes(x));

if (missing.length === 0 && extra.length === 0) {
    console.log('✅ Verification passed! Exports match exactly.');
    process.exit(0);
} else {
    if (missing.length > 0) console.error('❌ Missing exports:', missing);
    if (extra.length > 0) console.error('➕ Extra exports:', extra);
    process.exit(1);
}
