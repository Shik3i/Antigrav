const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const testDbPath = path.join(__dirname, 'test_new_install.db');
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const db = new sqlite3.Database(testDbPath);

console.log("--- Testing NEW INSTALLATION scenario ---");

db.serialize(() => {
    // 1. Create table with NEW schema (includes icon)
    db.run(`CREATE TABLE IF NOT EXISTS NavbarSettings (
        key TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        path TEXT NOT NULL,
        category TEXT DEFAULT 'Other',
        isVisible BOOLEAN DEFAULT 1,
        sortOrder INTEGER DEFAULT 0,
        has_daily_badge BOOLEAN DEFAULT 0,
        icon TEXT
    )`, (err) => {
        if (err) console.error("CREATE TABLE Failed:", err);
        else console.log("CREATE TABLE Success");
    });

    // 2. Run ALTERs (should fail but not block)
    db.run("ALTER TABLE NavbarSettings ADD COLUMN has_daily_badge BOOLEAN DEFAULT 0", (err) => {
        if (err) console.log("ALTER (badge) failed as expected (duplicate column)");
    });
    db.run("ALTER TABLE NavbarSettings ADD COLUMN icon TEXT", (err) => {
        if (err) console.log("ALTER (icon) failed as expected (duplicate column)");
    });

    // 3. Move news to Tools
    db.run(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder, icon) 
            VALUES ('news', 'News Feed', '/news', 'Tools', 1, 30, 'Rss')`, (err) => {
                if (err) console.error("INSERT Failed:", err);
                else console.log("INSERT Success");
            });

    db.run(`UPDATE NavbarSettings SET category = 'Tools' WHERE key = 'news'`, (err) => {
        if (err) console.error("UPDATE category Failed:", err);
        else console.log("UPDATE category Success");
    });

    // 4. Verification Check
    db.get("SELECT * FROM NavbarSettings WHERE key = 'news'", (err, row) => {
        if (err) {
            console.error("Verification query FAILED:", err);
        } else {
            console.log("Verification result:", row);
            if (row && row.category === 'Tools' && row.icon === 'Rss') {
                console.log("✅ NEW INSTALLATION TEST PASSED");
            } else {
                console.log("❌ NEW INSTALLATION TEST FAILED", row);
            }
        }
        db.close();
    });
});
