const { addColumn } = require('./utils');

function initializeIdleGameSchema(database) {
    // Idle_Profiles: stores user idle game profiles
    database.exec(`CREATE TABLE IF NOT EXISTS Idle_Profiles (
      userId TEXT PRIMARY KEY,
      level INTEGER DEFAULT 1,
      hype INTEGER DEFAULT 0,
      dollars INTEGER DEFAULT 1000000,
      last_sync_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      upgrades_json TEXT DEFAULT '{}',
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    // Migration: Add dollars to Idle_Profiles
    addColumn(database, 'Idle_Profiles', 'dollars', 'INTEGER DEFAULT 1000000');

    database.exec(`CREATE TABLE IF NOT EXISTS Idle_Inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      team_code TEXT NOT NULL,
      tier INTEGER DEFAULT 1,
      role TEXT DEFAULT 'Top',
      level INTEGER DEFAULT 1,
      experience INTEGER DEFAULT 0,
      rarity TEXT DEFAULT 'Common',
      base_stats INTEGER DEFAULT 10,
      is_equipped BOOLEAN DEFAULT 0,
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE
    )`);

    // Migrations for Idle_Inventory
    addColumn(database, 'Idle_Inventory', 'role', "TEXT DEFAULT 'Top'");
    addColumn(database, 'Idle_Inventory', 'level', 'INTEGER DEFAULT 1');
    addColumn(database, 'Idle_Inventory', 'experience', 'INTEGER DEFAULT 0');
    addColumn(database, 'Idle_Inventory', 'rarity', "TEXT DEFAULT 'Common'");
    addColumn(database, 'Idle_Inventory', 'base_stats', 'INTEGER DEFAULT 10');

    database.exec(`CREATE TABLE IF NOT EXISTS Idle_Roster (
      userId TEXT NOT NULL,
      slot_id INTEGER NOT NULL,
      inventory_id INTEGER,
      current_mode TEXT DEFAULT 'Trainieren',
      PRIMARY KEY (userId, slot_id),
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE,
      FOREIGN KEY(inventory_id) REFERENCES Idle_Inventory(id) ON DELETE SET NULL
    )`);
}

module.exports = {
    initializeIdleGameSchema
};