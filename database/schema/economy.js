const { addColumn } = require('./utils');

function initializeEconomySchema(database) {
    // ServerSettings: stores global app configurations
    database.exec(`CREATE TABLE IF NOT EXISTS ServerSettings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`);
    database.exec(`INSERT OR IGNORE INTO ServerSettings (key, value) VALUES ('koala_points_per_hour', '1000')`);
    database.exec(`INSERT OR IGNORE INTO ServerSettings (key, value) VALUES ('koala_start_coins', '10000')`);
    database.exec(`INSERT OR IGNORE INTO ServerSettings (key, value) VALUES ('koala_daily_mission_multiplier', '1.0')`);
    database.exec(`INSERT OR IGNORE INTO ServerSettings (key, value) VALUES ('achievement_reward_multiplier', '2.5')`);

    // KoalaTransactions: logs coin additions and deductions
    database.exec(`CREATE TABLE IF NOT EXISTS KoalaTransactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES Users(id)
    )`);
    database.exec('CREATE INDEX IF NOT EXISTS idx_transactions_user ON KoalaTransactions(user_id)');

    // chip_skins: stores chip skin definitions
    database.exec(`CREATE TABLE IF NOT EXISTS chip_skins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      rarity TEXT NOT NULL DEFAULT 'common',
      release_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CHECK(status IN ('draft', 'public', 'restricted', 'disabled')),
      CHECK(rarity IN ('common', 'rare', 'epic', 'legendary', 'limited', 'exclusive'))
    )`);

    // chip_skin_assets: stores asset files for chip skins
    database.exec(`CREATE TABLE IF NOT EXISTS chip_skin_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skin_id INTEGER NOT NULL,
      chip_value INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      original_filename TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(skin_id) REFERENCES chip_skins(id) ON DELETE CASCADE,
      UNIQUE(skin_id, chip_value),
      CHECK(chip_value IN (1, 5, 10, 25, 50, 100, 500, 1000))
    )`);

    // chip_skin_grants: tracks which users have which skins
    database.exec(`CREATE TABLE IF NOT EXISTS chip_skin_grants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skin_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      granted_by TEXT,
      FOREIGN KEY(skin_id) REFERENCES chip_skins(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE,
      UNIQUE(skin_id, user_id)
    )`);

    database.exec('CREATE INDEX IF NOT EXISTS idx_chip_skins_status_release ON chip_skins(status, release_date)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_chip_skin_grants_user ON chip_skin_grants(user_id)');

    // Additional economy settings
    database.exec("INSERT OR IGNORE INTO ServerSettings (key, value) VALUES ('koala_coin_conversion_rate', '0.01')");
    database.exec("INSERT OR IGNORE INTO ServerSettings (key, value) VALUES ('koala_daily_mission_reward', '5000')");
    database.exec("INSERT OR IGNORE INTO ServerSettings (key, value) VALUES ('game_koalaflap_payout_enabled', 'true')");
}

module.exports = {
    initializeEconomySchema
};