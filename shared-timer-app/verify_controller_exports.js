const apiController = require('./controllers/apiController');
const fs = require('fs');

const exportsList = Object.keys(apiController).sort();
fs.writeFileSync('exports_baseline.json', JSON.stringify(exportsList, null, 2));

console.log(`Baseline established: ${exportsList.length} exports found.`);
console.log('List saved to exports_baseline.json');
