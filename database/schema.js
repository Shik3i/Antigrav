const db = require('./connection');
const path = require('node:path');
const fs = require('node:fs');

// Schema modules
const { initializeUsersSchema } = require('./schema/users');
const { initializeGamesSchema } = require('./schema/games');
const { initializeEconomySchema } = require('./schema/economy');
const { initializeAchievementsSchema } = require('./schema/achievements');
const { initializeLottoSchema } = require('./schema/lotto');
const { initializeScratchcardsSchema } = require('./schema/scratchcards');
const { initializeTowerClimbSchema } = require('./schema/towerClimb');
const { initializeBlackjackSchema } = require('./schema/blackjack');
const { initializeWordleSchema } = require('./schema/wordle');
const { initializeFortuneSchema } = require('./schema/fortune');
const { initializeRssSchema } = require('./schema/rss');
const { initializeNavbarSchema } = require('./schema/navbar');
const { initializeEsportsSchema } = require('./schema/esports');
const { initializePolymarketSchema } = require('./schema/polymarket');
const { initializeRiftDefenseSchema } = require('./schema/riftDefense');
const { initializeIdleGameSchema } = require('./schema/idleGame');
const { initializeColorSyncSchema } = require('./schema/colorSync');
const { initializeAdminSchema } = require('./schema/admin');
const { initializePokemonSchema } = require('./schema/pokemon');
const { initializeMarketSchema } = require('./schema/market');
const { initializeIndexesSchema } = require('./schema/indexes');
const { hasColumn, addColumn, seedWordleDictionary } = require('./schema/utils');

function initializeDatabaseSchema(database = db) {
    // Initialize all schema modules
    initializeUsersSchema(database);
    initializeGamesSchema(database);
    initializeEconomySchema(database);
    initializeAchievementsSchema(database);
    initializeLottoSchema(database);
    initializeScratchcardsSchema(database);
    initializeTowerClimbSchema(database);
    initializeBlackjackSchema(database);
    initializeWordleSchema(database);
    initializeFortuneSchema(database);
    initializeRssSchema(database);
    initializeNavbarSchema(database);
    initializeEsportsSchema(database);
    initializePolymarketSchema(database);
    initializeRiftDefenseSchema(database);
    initializeIdleGameSchema(database);
    initializeColorSyncSchema(database);
    initializeAdminSchema(database);
    initializePokemonSchema(database);
    initializeMarketSchema(database);
    initializeIndexesSchema(database);
}

module.exports = {
    initializeDatabaseSchema,
    hasColumn,
    addColumn,
    seedWordleDictionary
};