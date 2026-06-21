const rssService = require('../services/rssService');
const dbLayer = require('../database');

/**
 * Executes the RSS refresh cycle.
 */
const runRssRefresh = async () => {
    console.log('[rssCron] Starting background news refresh...');
    await dbLayer.logSystemEvent('info', 'rssCron', 'Starting background news refresh...');
    
    try {
        const stats = await rssService.refreshAllFeeds();
        const msg = `News refresh completed. Success: ${stats.success}, Failed: ${stats.failed}`;
        console.log(`[rssCron] ${msg}`);
        await dbLayer.logSystemEvent('info', 'rssCron', msg);

        // Daily Cleanup: Purge articles older than 7 days
        // We run this periodically, but purgeRssArticles handles the threshold.
        // It's safe to run during every refresh as it's a quick indexed query.
        const purgedCount = await dbLayer.purgeRssArticles(168); // 7 days = 168 hours
        if (purgedCount > 0) {
            console.log(`[rssCron] Purged ${purgedCount} old articles (> 7 days).`);
            await dbLayer.logSystemEvent('info', 'rssCron', `Auto-Cleanup: ${purgedCount} articles deleted.`);
        }

        return stats;
    } catch (err) {
        console.error('[rssCron] Critical failure:', err.message);
        if (dbLayer.logError) {
            dbLayer.logError('RSS Cron Critical Failure', err.stack);
        }
        await dbLayer.logSystemEvent('error', 'rssCron', `Critical failure: ${err.message}`);
        return { success: 0, failed: 1, error: err.message };
    }
};

/**
 * Initializes the RSS cron job.
 */
const startRssCron = () => {
    // Run once after 8s (offset from other crons like betResolver), then every 20 minutes
    setTimeout(runRssRefresh, 8000);
    setInterval(runRssRefresh, 20 * 60 * 1000);
    
    console.log('[rssCron] RSS cron job initialized (runs every 20 minutes).');
    dbLayer.logSystemEvent('info', 'rssCron', 'RSS cron job initialized (runs every 20 minutes).');
};

module.exports = { startRssCron, runRssRefresh };
