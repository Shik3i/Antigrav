const { db } = require('../database');
const fs = require('fs');
const path = require('path');
const logging = require('../database/logging');

const BACKUP_DIR = path.join(__dirname, '..', 'database', 'backups');

/**
 * Creates a manual backup using VACUUM INTO
 * This ensures a consistent snapshot of the database.
 */
const createBackup = async () => {
  return new Promise((resolve, reject) => {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                      now.getHours().toString().padStart(2, '0') + '-' + 
                      now.getMinutes().toString().padStart(2, '0') + '-' + 
                      now.getSeconds().toString().padStart(2, '0');
    const filename = `backup_${timestamp}.sqlite`;
    const destPath = path.join(BACKUP_DIR, filename);

    // Ensure directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // SQLite "VACUUM INTO" is the cleanest way to backup a running DB without blocking or inconsistency
    db.run(`VACUUM INTO ?`, [destPath], function(err) {
      if (err) {
        console.error('[Backup] Failed to create backup:', err);
        if (logging && logging.logError) {
          logging.logError('Backup failed', err, { destPath });
        }
        reject(err);
      } else {
        console.log(`[Backup] Successfully created: ${filename}`);
        // Prune after backup
        pruneBackups().catch(e => console.error('[Backup] Pruning failed:', e));
        resolve({ filename, timestamp: now });
      }
    });
  });
};

/**
 * Fetches the list of all available backups
 */
const getBackupsList = async () => {
  if (!fs.existsSync(BACKUP_DIR)) return [];

  const files = fs.readdirSync(BACKUP_DIR)
    .filter(file => file.endsWith('.sqlite') || file.endsWith('.db'))
    .map(file => {
      const fullPath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(fullPath);
      return {
        filename: file,
        size: stats.size,
        createdAt: stats.mtime
      };
    });

  return files.sort((a, b) => b.createdAt - a.createdAt);
};

/**
 * Toggles the auto-backup state in ServerSettings
 */
const setAutoBackupState = async (enabled) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR REPLACE INTO ServerSettings (key, value) VALUES ('auto_backup_enabled', ?)`,
      [enabled ? 'true' : 'false'],
      (err) => {
        if (err) reject(err);
        else resolve({ enabled });
      }
    );
  });
};

/**
 * Gets the current auto-backup state
 */
const getAutoBackupState = async () => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT value FROM ServerSettings WHERE key = 'auto_backup_enabled'`, (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.value === 'true' : false);
    });
  });
};

/**
 * GFS (Grandfather-Father-Son) Pruning Algorithm
 * Retention Policy:
 * - Daily: Keep 1/day for last 7 days
 * - Weekly: Keep 1/week for last 4 weeks
 * - Monthly: Keep 1/month for last 12 months
 */
const pruneBackups = async () => {
  const backups = await getBackupsList();
  if (backups.length === 0) return;

  const now = new Date();
  const toDelete = [];
  const keptFiles = new Set();

  // Helper to get date strings
  const getDayStr = (date) => date.toISOString().split('T')[0];
  const getWeekStr = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay()); // Start of week (Sunday)
    return d.toISOString().split('T')[0];
  };
  const getMonthStr = (date) => date.toISOString().slice(0, 7); // YYYY-MM

  // Buckets for retention
  const dailyBucket = new Map(); // dayStr -> filename
  const weeklyBucket = new Map(); // weekStr -> filename
  const monthlyBucket = new Map(); // monthStr -> filename

  // Time boundaries
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const fourWeeksAgo = new Date(now);
  fourWeeksAgo.setDate(now.getDate() - 28);

  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(now.getMonth() - 12);

  for (const backup of backups) {
    const bDate = new Date(backup.createdAt);
    let keep = false;

    // 1. Daily: Last 7 days
    if (bDate >= sevenDaysAgo) {
      const day = getDayStr(bDate);
      if (!dailyBucket.has(day)) {
        dailyBucket.set(day, backup.filename);
        keep = true;
      }
    }

    // 2. Weekly: Last 4 weeks
    if (bDate >= fourWeeksAgo) {
      const week = getWeekStr(bDate);
      if (!weeklyBucket.has(week)) {
        weeklyBucket.set(week, backup.filename);
        keep = true;
      }
    }

    // 3. Monthly: Last 12 months
    if (bDate >= twelveMonthsAgo) {
      const month = getMonthStr(bDate);
      if (!monthlyBucket.has(month)) {
        monthlyBucket.set(month, backup.filename);
        keep = true;
      }
    }

    if (!keep) {
      toDelete.push(backup.filename);
    } else {
      keptFiles.add(backup.filename);
    }
  }

  // Final check: don't delete files that are in multiple buckets
  const finalToDelete = toDelete.filter(f => !keptFiles.has(f));

  for (const filename of finalToDelete) {
    try {
      fs.unlinkSync(path.join(BACKUP_DIR, filename));
      console.log(`[Backup Prune] Deleted old backup: ${filename}`);
    } catch (err) {
      console.error(`[Backup Prune] Failed to delete ${filename}:`, err);
    }
  }
};

module.exports = {
  createBackup,
  getBackupsList,
  setAutoBackupState,
  getAutoBackupState,
  pruneBackups
};
