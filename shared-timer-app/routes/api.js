const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');
const authController = require('../controllers/authController');
const friendsController = require('../controllers/friendsController');
const riftDefenseController = require('../controllers/riftDefenseController');
const idleGameController = require('../controllers/idleGameController');
const colorSyncController = require('../controllers/colorSyncController');
const { body, validationResult } = require('express-validator');
const xss = require('xss');

// Basic validation middleware
const validate = (req, res, next) => {
    const errors = validationResult(req);
    // Return the first error message clearly to the user
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
    }
    next();
};

router.get('/highscores', apiController.getHighscores);
router.get('/highscores/coins', apiController.getHighscoresCoins);
router.get('/highscores/accuracy', apiController.getBettingAccuracy);
router.get('/highscores/history', apiController.getActivityHistory);
router.get('/news', apiController.getNews);
router.get('/esports', apiController.getEsports);
router.get('/esports/teams', apiController.getEsportsTeams);
router.get('/esports/odds/polymarket', apiController.getPolymarketOdds);
router.get('/esports/odds/backup', apiController.getTheOddsApi);
router.post('/esports/bets', authController.authenticateToken, apiController.placeBet);
router.get('/esports/bets', authController.authenticateToken, apiController.getBets);
router.get('/esports/bets/recent', authController.optionalAuthenticateToken, apiController.getRecentBets);
router.get('/koala/transactions', authController.authenticateToken, apiController.getKoalaTransactions);
router.post('/games/koalaflap/submit', authController.authenticateToken, apiController.submitKoalaFlapScore);
router.get('/games/leaderboard', apiController.getGameLeaderboards);
router.get('/games/upgrades', authController.optionalAuthenticateToken, apiController.getGameUpgrades);
router.post('/games/upgrades/purchase', authController.authenticateToken, apiController.purchaseGameUpgrade);
router.get('/games/koalaflap/config', authController.optionalAuthenticateToken, apiController.getKoalaFlapConfig);
router.get('/games/mission/status', authController.optionalAuthenticateToken, apiController.getMissionStatus);
router.post('/admin/games/settings', authController.authenticateToken, apiController.updateAdminGameSettings);
router.get('/admin/games/scores', authController.authenticateToken, apiController.getAdminGameScores);
router.delete('/admin/games/scores/:id', authController.authenticateToken, apiController.deleteAdminGameScore);

// Admin Bet Management
router.get('/admin/bets', authController.authenticateToken, apiController.getAdminBets);
router.post('/admin/bets/:id/status', authController.authenticateToken, apiController.updateAdminBetStatus);
router.post('/admin/bets/trigger-resolver', authController.authenticateToken, apiController.triggerAdminBetResolver);
router.get('/admin/actions', authController.authenticateToken, apiController.getAdminActions);

// Navbar Settings
router.get('/navbar-settings', apiController.getPublicNavbarSettings);
router.get('/admin/navbar-settings', authController.authenticateToken, apiController.getAdminNavbarSettings);
router.post('/admin/navbar-settings', authController.authenticateToken, apiController.updateNavbarSettings);

router.post('/users', apiController.registerUser);
router.get('/users/profile/:username', apiController.getUserProfile);
router.get('/rooms', authController.optionalAuthenticateToken, apiController.getRooms);
router.post('/rooms', [
    body('name').trim().isLength({ min: 1, max: 30 }).withMessage('Room name must be 1-30 characters').customSanitizer(xss),
    body('defaultDurationMinutes').optional().isFloat({ min: 1, max: 120 }),
    body('isPublic').optional().isBoolean()
], validate, apiController.createRoom);
router.post('/rooms/:id/media', apiController.broadcastMediaCommand);

// Auth & Accounts
router.post('/auth/register', [
    body('username').trim().isLength({ min: 3, max: 20 }).withMessage('Username must be 3-20 characters').customSanitizer(xss),
    body('password').isLength({ min: 3 }).withMessage('Password must be at least 3 characters')
], validate, authController.register);

router.post('/auth/login', [
    body('username').trim().customSanitizer(xss),
    body('password').notEmpty()
], validate, authController.login);
router.get('/auth/users', authController.authenticateToken, authController.getUsers);
router.put('/auth/users/:id/superadmin', authController.authenticateToken, authController.setSuperadmin);
router.put('/auth/users/:id/password', authController.authenticateToken, authController.adminChangePassword);
router.get('/auth/users/:id/friends', authController.authenticateToken, authController.getUserFriendsAdmin);
router.delete('/auth/users/:id', authController.authenticateToken, authController.deleteUser);

// Banning endpoints
router.get('/auth/banned', authController.authenticateToken, authController.getBannedUsersList);
router.post('/auth/users/:id/ban', authController.authenticateToken, authController.banUserAdmin);
router.delete('/auth/users/:id/ban', authController.authenticateToken, authController.unbanUserAdmin);

router.get('/auth/me', authController.authenticateToken, authController.getMe);
router.put('/auth/me/password', authController.authenticateToken, authController.changeOwnPassword);

// Friends
router.post('/friends/request', authController.authenticateToken, friendsController.sendRequest);
router.post('/friends/accept', authController.authenticateToken, friendsController.acceptRequest);
router.post('/friends/remove', authController.authenticateToken, friendsController.removeFriend);
router.get('/friends', authController.authenticateToken, friendsController.getFriends);

router.get('/test/rooms', apiController.testDbRooms);
router.get('/test/esports', apiController.testEsports);
router.post('/test/rooms/:id/action', apiController.testRoomAction);

// Countdowns
router.get('/countdowns', authController.optionalAuthenticateToken, apiController.getCountdowns);
router.post('/countdowns', authController.authenticateToken, apiController.createCountdown);
router.delete('/countdowns/:id', authController.authenticateToken, apiController.deleteCountdown);

// Feature Roadmap
router.get('/features', authController.optionalAuthenticateToken, apiController.getFeatureRequests);
router.post('/features', authController.authenticateToken, apiController.createFeatureRequest);
router.post('/features/:id/vote', authController.optionalAuthenticateToken, apiController.voteFeatureRequest);
router.put('/features/:id/status', authController.authenticateToken, apiController.updateFeatureStatus);
router.put('/features/:id/comment', authController.authenticateToken, apiController.updateFeatureAdminComment);
router.delete('/features/:id', authController.authenticateToken, apiController.deleteFeatureRequest);

// ─── Error Logging ──────────────────────────────────────────
router.get('/errors', authController.authenticateToken, apiController.getErrorLogs);
router.get('/admin/system-logs', authController.authenticateToken, apiController.getSystemLogs); // [NEW]
router.delete('/admin/system-logs', authController.authenticateToken, apiController.deleteAllSystemLogs); // [NEW]
router.delete('/errors', authController.authenticateToken, apiController.clearErrorLogs);
router.delete('/errors/:id', authController.authenticateToken, apiController.deleteErrorLog);

router.get('/twitch/status', apiController.getTwitchStatus);

// ─── Changelog ──────────────────────────────────────────────
router.get('/changelog', apiController.getChangelog);

// ─── Achievements ─────────────────────────────────────────────
const achievementsController = require('../controllers/achievementsController');
router.get('/achievements/status', authController.authenticateToken, achievementsController.getStatus);
router.post('/achievements/claim/:id', authController.authenticateToken, achievementsController.claimAchievement);

// Admin Achievements
router.get('/admin/achievements/settings', authController.authenticateToken, achievementsController.getAdminSettings);
router.post('/admin/achievements/settings', authController.authenticateToken, achievementsController.updateAdminSettings);

// ─── Speedcube Timer ──────────────────────────────────────────
const speedcubeController = require('../controllers/speedcubeController');
router.get('/speedcube', authController.authenticateToken, speedcubeController.getTimes);
router.post('/speedcube', authController.authenticateToken, speedcubeController.addTime);
router.patch('/speedcube/:id/note', authController.authenticateToken, speedcubeController.updateNote);
router.delete('/speedcube/:id', authController.authenticateToken, speedcubeController.deleteTime);

// ─── Scratchcards ─────────────────────────────────────────────
router.get('/scratchcards/config', authController.optionalAuthenticateToken, apiController.getScratchcardConfig);
router.get('/scratchcards/stats', apiController.getGlobalScratchcardStats);
router.get('/scratchcards/chart', apiController.getScratchcardLeaderboardData);
router.post('/scratchcards/buy', authController.authenticateToken, apiController.buyScratchcard);
router.post('/scratchcards/claim', authController.authenticateToken, apiController.claimScratchcard);

// Admin Scratchcard Pack Management
router.get('/admin/scratchcards/packs', authController.authenticateToken, apiController.getScratchcardPacks);
router.get('/admin/scratchcards/packs/:id', authController.authenticateToken, apiController.getScratchcardPackFull);
router.post('/admin/scratchcards/packs', authController.authenticateToken, apiController.adminCreateScratchPack);
router.put('/admin/scratchcards/packs/:id', authController.authenticateToken, apiController.adminUpdateScratchPack);
router.delete('/admin/scratchcards/packs/:id', authController.authenticateToken, apiController.adminDeleteScratchPack);

// ─── LEC Rift Defense ──────────────────────────────────────────
router.get('/rift-defense/shop-config', authController.authenticateToken, riftDefenseController.getShopConfig);
router.post('/rift-defense/buy-capsule', authController.authenticateToken, riftDefenseController.buyCapsule);
router.get('/rift-defense/inventory', authController.authenticateToken, riftDefenseController.getInventory);
router.post('/rift-defense/combine', authController.authenticateToken, riftDefenseController.combineTowers);
router.post('/rift-defense/combine-all', authController.authenticateToken, riftDefenseController.combineAllTowers);
router.post('/rift-defense/scrap', authController.authenticateToken, riftDefenseController.scrapTower);
router.post('/rift-defense/save-stats', authController.authenticateToken, riftDefenseController.saveStats);
router.get('/rift-defense/leaderboards', riftDefenseController.getLeaderboards);

// ─── LoL Idle Game (Road to Worlds) ──────────────────────────
router.get('/idle/status', authController.authenticateToken, idleGameController.getGameStatus);
router.post('/idle/gacha', authController.authenticateToken, idleGameController.performGachaPull);
router.post('/idle/merge', authController.authenticateToken, idleGameController.mergeUnits);
router.post('/idle/merge-all', authController.authenticateToken, idleGameController.mergeAllUnits);
router.post('/idle/equip', authController.authenticateToken, idleGameController.equipUnit);
router.post('/idle/sell', authController.authenticateToken, idleGameController.sellUnit);
router.post('/idle/roster/mode', authController.authenticateToken, idleGameController.updateRosterMode);
router.post('/idle/tournament/complete', authController.authenticateToken, idleGameController.validateTournament);

// ─── Color Sync (Color Guessing Game) ─────────────────────────
router.get('/colorsync/daily', colorSyncController.getDailyColor);
router.get('/colorsync/random', colorSyncController.getRandomColor);
router.post('/colorsync/submit', authController.authenticateToken, colorSyncController.submitScore);
router.post('/colorsync/lobby', authController.authenticateToken, colorSyncController.createLobby);
router.get('/colorsync/lobby/:uuid', colorSyncController.getLobbyData);
router.post('/colorsync/lobby/:uuid/submit', authController.authenticateToken, colorSyncController.submitLobbyScore);
router.get('/colorsync/daily-status', authController.authenticateToken, colorSyncController.checkDailyStatus);
router.get('/colorsync/daily-stats', colorSyncController.getDailyStats);

router.get('/pokemon', apiController.getPokemonData);
router.get('/pokemon/configs', apiController.getPublicPokemonConfigs);
router.get('/admin/pokemon-configs', authController.authenticateToken, apiController.getPokemonConfigs);
router.post('/admin/pokemon-configs/update', authController.authenticateToken, apiController.updatePokemonConfigs);

module.exports = router;
