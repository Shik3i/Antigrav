const { addColumn } = require('./utils');

function initializeNavbarSchema(database) {
    // --- NavbarSettings ---
    database.exec(`CREATE TABLE IF NOT EXISTS NavbarSettings (
      key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      path TEXT NOT NULL,
      category TEXT DEFAULT 'Other',
      isVisible BOOLEAN DEFAULT 1,
      isLocked BOOLEAN DEFAULT 0,
      sortOrder INTEGER DEFAULT 0,
      has_daily_badge BOOLEAN DEFAULT 0,
      icon TEXT
    )`);

    // Migrations
    addColumn(database, 'NavbarSettings', 'has_daily_badge', 'BOOLEAN DEFAULT 0');
    addColumn(database, 'NavbarSettings', 'isLocked', 'BOOLEAN DEFAULT 0');
    addColumn(database, 'NavbarSettings', 'icon', 'TEXT');

    // Default navbar items
    const defaults = [
      ['dashboard', 'Sync Timers', '/', 'Timers', 1, 1],
      ['countdowns', 'Countdowns', '/countdowns', 'Timers', 1, 2],
      ['speedcube', 'Speedcube Timer', '/speedcube', 'Timers', 1, 3],
      ['statistics', 'Statistics', '/highscores', 'Timers', 1, 4],
      ['esports', 'Esports', '/esports', 'Esports', 1, 1],
      ['esports-bets', 'Community Bets', '/global-bets', 'Esports', 1, 2],
      ['financial-dashboard', 'Financial Dashboard', '/koala-dashboard', 'Esports', 1, 3],
      ['achievements', 'Achievements & Boni', '/achievements', 'Esports', 1, 4],
      ['koala-flap', 'KoalaFlap', '/games/koalaflap', 'Games', 1, 1],
      ['scratch-cards', 'Scratchcards', '/scratchcards', 'Games', 1, 2],
      ['rift-defense', 'LEC Rift Defense', '/games/rift-defense', 'Games', 1, 3],
      ['game-leaderboards', 'Game Leaderboards', '/games/leaderboard', 'Games', 1, 4],
      ['settings', 'Settings', '/settings', 'System', 1, 1],
      ['roadmap', 'Feature Roadmap', '/features', 'System', 1, 2],
      ['changelog', 'Changelog', '/changelog', 'System', 1, 3],
      ['admin', 'Admin Panel', '/admin', 'System', 1, 4],
      ['friends', 'Friends', '/friends', 'Social', 1, 1]
    ];

    const insertNavbarItem = database.prepare(
      'INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const values of defaults) insertNavbarItem.run(...values);

    // Additional navbar items
    database.exec(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder, icon)
            VALUES ('friends', 'Friends', '/friends', 'Social', 1, 1, 'Users')`);
    database.exec(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder)
            VALUES ('admin', 'Admin Panel', '/admin', 'System', 1, 4)`);

    // LoL Idle Game Link
    database.exec(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder)
            VALUES ('lol-idle', 'Road to Worlds', '/games/lol-idle', 'Games', 1, 1.5)`);

    // Color Sync Link
    database.exec(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder)
            VALUES ('colorsync', 'Color Sync', '/color-sync', 'Games', 1, 6)`);

    // Leveling Tracker Link
    database.exec(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder)
            VALUES ('leveling-tracker', 'Leveling Tracker', '/leveling', 'Timers', 1, 5)`);

    // Tetris Link
    database.exec(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder)
            VALUES ('tetris', 'Tetris', '/tetris', 'Games', 1, 7)`);

    // Polymarket General Link
    database.exec(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder)
            VALUES ('polymarket-general', 'Polymarket General', '/polymarket-general', 'Esports', 1, 5)`);

    // Wordle Link
    database.exec(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder)
            VALUES ('wordle', 'Wordle', '/wordle', 'Games', 1, 8)`);

    // Tower Climb Link
    database.exec(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder)
            VALUES ('tower-climb', 'Tower Climb', '/games/tower-climb', 'Games', 1, 9)`);

    // Lotto Imitat Link
    database.exec(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder)
            VALUES ('lotto', 'Lotto Imitat', '/lotto', 'Games', 1, 10)`);

    // Blackjack Link
    database.exec(`INSERT OR IGNORE INTO NavbarSettings (key, label, path, category, isVisible, sortOrder)
            VALUES ('blackjack', 'Blackjack', '/games/blackjack', 'Games', 1, 11)`);

    // Indexes
    database.exec('CREATE INDEX IF NOT EXISTS idx_navbar_visible_sort ON NavbarSettings(isVisible, sortOrder)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_navbar_sort ON NavbarSettings(sortOrder)');
}

module.exports = {
    initializeNavbarSchema
};