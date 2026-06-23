function initializeIndexesSchema(database) {
    // ─── Performance Indexes ───────────────────────────────────────
    database.exec('CREATE INDEX IF NOT EXISTS idx_timer_userId ON TimerEvents(userId)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_timer_completedAt ON TimerEvents(completedAt)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_koala_tx_userId ON KoalaTransactions(user_id)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_countdowns_userId ON Countdowns(userId)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_countdowns_visibility ON Countdowns(isPublic, isGlobal)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_friends_userId ON Friends(userId)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_friends_friendId ON Friends(friendId)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_friends_user_status ON Friends(userId, status, friendId)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_friends_friend_status ON Friends(friendId, status, userId)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_users_koalabalance ON Users(koala_balance)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_users_last_active ON Users(lastActive)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_bets_userid ON Bets(userId)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_bets_status ON Bets(status)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_timer_user_completed ON TimerEvents(userId, completedAt DESC)');

    // ─── Game-Specific Indexes ──────────────────────────────────
    database.exec('CREATE INDEX IF NOT EXISTS idx_blackjack_stats_totalWon ON BlackjackStats(totalWon DESC)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_blackjack_stats_gamesPlayed ON BlackjackStats(gamesPlayed DESC)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_blackjack_stats_blackjacksHit ON BlackjackStats(blackjacksHit DESC)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_blackjack_stats_totalWagered ON BlackjackStats(totalWagered DESC)');

    // ─── Navbar Indexes ────────────────────────────────────────
    database.exec('CREATE INDEX IF NOT EXISTS idx_navbar_visible_sort ON NavbarSettings(isVisible, sortOrder)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_navbar_sort ON NavbarSettings(sortOrder)');

    // ─── Esports Indexes ──────────────────────────────────────
    database.exec('CREATE INDEX IF NOT EXISTS idx_esports_teams_name ON EsportsTeams(name)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_esports_teams_updated ON EsportsTeams(updated_at DESC)');

    // ─── Scratchcard Indexes ──────────────────────────────────
    database.exec('CREATE INDEX IF NOT EXISTS idx_scratchcards_userId ON Scratchcards(userId)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_scratchcards_status ON Scratchcards(status)');

    // ─── Tower Climb Indexes ─────────────────────────────────
    database.exec('CREATE INDEX IF NOT EXISTS idx_tower_rounds_user_created ON TowerClimbRounds(userId, createdAt DESC)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_tower_rounds_user_status ON TowerClimbRounds(userId, status)');
    database.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_tower_rounds_user_running ON TowerClimbRounds(userId) WHERE status = 'running'");

    // ─── Rift Defense Indexes ────────────────────────────────
    database.exec('CREATE INDEX IF NOT EXISTS idx_riftdefense_userId ON RiftDefense_Towers(userId)');

    // ─── Color Sync Indexes ──────────────────────────────────
    database.exec('CREATE INDEX IF NOT EXISTS idx_colorsync_scores_userId ON ColorSync_Scores(userId)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_colorsync_lobby_participants_lobbyId ON ColorSync_LobbyParticipants(lobby_id)');

    // ─── RSS Indexes ─────────────────────────────────────────
    database.exec('CREATE INDEX IF NOT EXISTS idx_rss_articles_feed_date ON RssArticles_Cache(feedId, pubDate DESC)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_rss_feeds_default ON RssFeeds(is_default)');

    // ─── Market Indexes ──────────────────────────────────────
    database.exec('CREATE INDEX IF NOT EXISTS idx_market_deleted_name ON MMO_MarketPrices(isDeleted, itemName)');

    // ─── Admin Indexes ───────────────────────────────────────
    database.exec('CREATE INDEX IF NOT EXISTS idx_admin_actions_timestamp ON AdminActions(timestamp)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_features_status ON FeatureRequests(status)');

    // ─── Lotto Indexes ───────────────────────────────────────
    database.exec('CREATE INDEX IF NOT EXISTS idx_lotto_tickets_user ON LottoTickets(userId)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_lotto_tickets_draw ON LottoTickets(drawDate, status)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_lotto_tickets_user_draw ON LottoTickets(userId, drawDate)');

    // ─── Pokemon Indexes ─────────────────────────────────────
    database.exec('CREATE INDEX IF NOT EXISTS idx_esports_teams_name ON EsportsTeams(name)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_esports_teams_updated ON EsportsTeams(updated_at DESC)');
}

module.exports = {
    initializeIndexesSchema
};