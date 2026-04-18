const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const testDbPath = path.join(__dirname, 'test_existing_db.db');
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const db = new sqlite3.Database(testDbPath);

console.log("--- Testing EXISTING DB / ONLINE MIGRATION scenario ---");

db.serialize(() => {
    // 1. Setup OLD schema (without icon)
    db.run(`CREATE TABLE IF NOT EXISTS NavbarSettings (
        key TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        path TEXT NOT NULL,
        category TEXT DEFAULT 'Other',
        isVisible BOOLEAN DEFAULT 1,
        sortOrder INTEGER DEFAULT 0,
        has_daily_badge BOOLEAN DEFAULT 0
    )`);

    // 2. Insert old data
    db.run(`INSERT INTO NavbarSettings (key, label, path, category, isVisible, sortOrder) 
            VALUES ('news', 'News Feed', '/news', 'Social', 1, 10)`);

    console.log("Old DB setup complete. Running initialization logic...");

    // --- REPLICATED LOGIC FROM database.js ---
    db.run(`CREATE TABLE IF NOT EXISTS NavbarSettings (
        key TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        path TEXT NOT NULL,
        category TEXT DEFAULT 'Other',
        isVisible BOOLEAN DEFAULT 1,
        sortOrder INTEGER DEFAULT 0,
        has_daily_badge BOOLEAN DEFAULT 0,
        icon TEXT
    )`, () => {
        db.serialize(() => {
            db.run("ALTER TABLE NavbarSettings ADD COLUMN has_daily_badge BOOLEAN DEFAULT 0", (err) => {
                if (err) console.log("ALTER (badge) failed:", err.message);
                else console.log("ALTER (badge) Success");
            });
            db.run("ALTER TABLE NavbarSettings ADD COLUMN icon TEXT", (err) => {
                if (err) console.log("ALTER (icon) failed:", err.message);
                else {
                    console.log("ALTER (icon) Success");
                    // Data migration
                    db.run(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder, icon) 
                            VALUES ('news', 'News Feed', '/news', 'Tools', 1, 30, 'Rss')`);
                    db.run(`UPDATE NavbarSettings SET category = 'Tools', icon = 'Rss' WHERE key = 'news'`);
                    db.run(`UPDATE NavbarSettings SET sortOrder = 30 WHERE key = 'news' AND (sortOrder = 0 OR sortOrder IS NULL)`);
                    
                    // Verfication
                    db.get("SELECT * FROM NavbarSettings WHERE key = 'news'", (err, row) => {
                        console.log("Verification result:", row);
                        if (row && row.category === 'Tools' && row.icon === 'Rss') {
                            console.log("✅ ONLINE MIGRATION TEST PASSED");
                        } else {
                            console.log("❌ ONLINE MIGRATION TEST FAILED", row);
                        }
                        db.close();
                    });
                }
            });
        });
    });
});
