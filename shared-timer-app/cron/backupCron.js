const { createBackup, getAutoBackupState } = require('../controllers/backupController');

/**
 * Initializes the automatic database backup schedule.
 * Runs every 24 hours if enabled in ServerSettings.
 */
const startBackupCron = () => {
  console.log('[Cron] Backup service initialized (Daily Interval)');
  
  // 24-hour interval
  setInterval(async () => {
    try {
      const isEnabled = await getAutoBackupState();
      if (isEnabled) {
        console.log('[Cron] Auto-backup enabled. Starting daily backup routine...');
        await createBackup({ type: 'automatic' });
      }
    } catch (err) {
      console.error('[Cron] Auto-backup routine failed:', err);
    }
  }, 24 * 60 * 60 * 1000);
};

module.exports = { startBackupCron };
