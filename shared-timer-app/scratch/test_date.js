
const lastDailyClaim = "2026-04-18 01:00:00"; // SQLite CURRENT_TIMESTAMP format
const today = new Date().toISOString().split('T')[0];

// Old logic
const lastDailyDateOld = lastDailyClaim ? new Date(lastDailyClaim).toISOString().split('T')[0] : null;

// New logic
const lastDailyDateNew = lastDailyClaim ? lastDailyClaim.split(' ')[0] : null;

console.log("lastDailyClaim:", lastDailyClaim);
console.log("today (UTC):", today);
console.log("Old logic lastDailyDate:", lastDailyDateOld);
console.log("New logic lastDailyDate:", lastDailyDateNew);
console.log("Old logic Match:", lastDailyDateOld === today);
console.log("New logic Match:", lastDailyDateNew === today);
