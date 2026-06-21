const { createBackup, getBackupsList, getAutoBackupState, getIsBackingUp } = require('../controllers/backupController');

const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CHECK_INTERVAL_MS  =      60 * 60 * 1000;  // Check every 1 hour

/**
 * Checks whether a backup is due (>= 24h since the last automatic backup)
 * and runs one if so. Safe to call on startup and on every hourly tick.
 *
 * Design: wall-clock comparison against the last backup file's timestamp
 * rather than a raw setInterval(24h). This means the schedule survives
 * server restarts — even a daily deploy won't skip a backup.
 */
const runIfDue = async () => {
  try {
    // 1. Check the in-progress lock first (sync, cheap) before hitting the DB.
    if (getIsBackingUp()) {
      console.warn('[Cron] Skipping auto-backup check: A backup operation is already in progress.');
      return;
    }

    // 2. Check whether auto-backup is enabled in ServerSettings.
    const isEnabled = await getAutoBackupState();
    if (!isEnabled) return;

    // 3. Find the timestamp of the most recent automatic backup.
    const { automatic: backups } = await getBackupsList();

    if (backups.length === 0) {
      // No backups exist at all — create the very first one.
      console.log('[Cron] No automatic backups found. Creating initial backup...');
      await createBackup({ type: 'automatic' });
      return;
    }

    const lastBackup      = backups[0]; // Already sorted newest-first by getBackupsList
    const lastBackupTime  = new Date(lastBackup.createdAt).getTime();
    const now             = Date.now();
    const elapsedMs       = now - lastBackupTime;
    const elapsedHours    = elapsedMs / (1000 * 60 * 60);

    if (elapsedMs >= BACKUP_INTERVAL_MS) {
      console.log(`[Cron] ${elapsedHours.toFixed(1)}h since last backup. Starting daily backup...`);
      await createBackup({ type: 'automatic' });
    } else {
      const dueInHours = (BACKUP_INTERVAL_MS - elapsedMs) / (1000 * 60 * 60);
      console.log(`[Cron] Backup check OK — ${elapsedHours.toFixed(1)}h elapsed. Next backup due in ~${dueInHours.toFixed(1)}h.`);
    }
  } catch (err) {
    console.error('[Cron] Auto-backup routine failed:', err);
  }
};

/**
 * Initializes the automatic database backup schedule.
 *
 * Uses wall-clock hourly polling instead of a raw 24h setInterval so that
 * server restarts (deploys, crashes, container recycles) cannot cause missed
 * backups. On every boot, a startup catch-up check fires after a short stagger
 * to ensure at most one 24h window is ever skipped.
 */
const startBackupCron = () => {
  console.log('[Cron] Backup service initialized (Wall-Clock Daily Scheduler)');

  // Staggered start per cron architecture rules: wait 15s for DB/server to be
  // fully ready, then do an immediate catch-up check, then poll every hour.
  setTimeout(() => {
    runIfDue();                              // Catch-up on startup
    setInterval(runIfDue, CHECK_INTERVAL_MS); // Recurring hourly check
  }, 15_000);
};

module.exports = { startBackupCron };
