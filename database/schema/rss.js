const { addColumn, hasColumn } = require('./utils');

function initializeRssSchema(database) {
    // --- RSS News Tables ---
    database.exec(`CREATE TABLE IF NOT EXISTS RssFeeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      icon TEXT,
      is_default BOOLEAN DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Default RSS feed
    database.prepare('INSERT OR IGNORE INTO RssFeeds (name, url, icon, is_default) VALUES (?, ?, ?, ?)')
      .run('Tagesschau', 'https://www.tagesschau.de/xml/rss2/', 'https://www.tagesschau.de/favicon.ico', 1);

    database.exec(`CREATE TABLE IF NOT EXISTS RssArticles_Cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feedId INTEGER NOT NULL,
      title TEXT NOT NULL,
      imageUrl TEXT,
      snippet TEXT,
      link TEXT NOT NULL,
      pubDate DATETIME,
      cachedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(feedId) REFERENCES RssFeeds(id) ON DELETE CASCADE
    )`);

    database.exec(`CREATE TABLE IF NOT EXISTS UserRssPreferences (
      userId TEXT NOT NULL,
      feedId INTEGER NOT NULL,
      showOnSite BOOLEAN DEFAULT 1,
      showInTicker BOOLEAN DEFAULT 0,
      PRIMARY KEY (userId, feedId),
      FOREIGN KEY(userId) REFERENCES Users(id) ON DELETE CASCADE,
      FOREIGN KEY(feedId) REFERENCES RssFeeds(id) ON DELETE CASCADE
    )`);

    // Migration for UserRssPreferences
    const hadHiddenPreference = hasColumn(database, 'UserRssPreferences', 'isHidden');
    const hadShowOnSite = hasColumn(database, 'UserRssPreferences', 'showOnSite');
    addColumn(database, 'UserRssPreferences', 'showOnSite', 'BOOLEAN DEFAULT 1');
    if (!hadShowOnSite && hadHiddenPreference) {
      database.exec('UPDATE UserRssPreferences SET showOnSite = 0 WHERE isHidden = 1');
    }
    addColumn(database, 'UserRssPreferences', 'showInTicker', 'BOOLEAN DEFAULT 0');
    database.exec(`
      INSERT OR IGNORE INTO UserRssPreferences (userId, feedId, showOnSite, showInTicker)
      SELECT u.id, f.id, 1, 1 FROM Users u, RssFeeds f WHERE f.is_default = 1
    `);
    database.exec('UPDATE UserRssPreferences SET showInTicker = 1 WHERE feedId IN (SELECT id FROM RssFeeds WHERE is_default = 1)');

    // Indexes
    database.exec('CREATE INDEX IF NOT EXISTS idx_rss_articles_feed_date ON RssArticles_Cache(feedId, pubDate DESC)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_rss_feeds_default ON RssFeeds(is_default)');
}

module.exports = {
    initializeRssSchema
};