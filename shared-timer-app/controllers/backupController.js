const { db } = require('../database');
const fs = require('fs');
const path = require('path');
const logging = require('../database/logging');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'timerapp.db');
const BACKUP_BASE_DIR = path.join(path.dirname(DB_PATH), 'backups');
const BACKUP_AUTO_DIR = path.join(BACKUP_BASE_DIR, 'automatic');
const BACKUP_MANUAL_DIR = path.join(BACKUP_BASE_DIR, 'manual');

let isBackingUp = false;

/**
 * Creates a backup using VACUUM INTO
 * @param {Object} options - { type: 'automatic' | 'manual', note: string }
 */
const createBackup = async ({ type = 'automatic', note = '' } = {}) => {
  if (isBackingUp) {
    throw new Error('A backup operation is already in progress.');
  }

  isBackingUp = true;

  return new Promise((resolve, reject) => {
    const targetDir = type === 'manual' ? BACKUP_MANUAL_DIR : BACKUP_AUTO_DIR;
    
    // Ensure directories exist
    [BACKUP_AUTO_DIR, BACKUP_MANUAL_DIR].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                      now.getHours().toString().padStart(2, '0') + '-' + 
                      now.getMinutes().toString().padStart(2, '0');
    
    // Sanitize note: remove non-alphanumeric/spaces, truncate
    const sanitizedNote = note.replace(/[^a-z0-9\s-]/gi, '').trim().replace(/\s+/g, '-').slice(0, 30);
    const filename = type === 'manual' 
      ? `manual_${timestamp}${sanitizedNote ? '_' + sanitizedNote : ''}.sqlite`
      : `backup_${timestamp}.sqlite`;
      
    const destPath = path.join(targetDir, filename);

    db.run(`VACUUM INTO ?`, [destPath], function(err) {
      // Ensure we clear the lock regardless of outcome
      if (err) {
        isBackingUp = false;
        console.error(`[Backup] Failed to create ${type} backup:`, err);
        if (logging && logging.logError) {
          logging.logError(`${type.toUpperCase()} Backup failed`, err, { destPath });
        }
        reject(err);
      } else {
        console.log(`[Backup] Successfully created ${type} backup: ${filename}`);
        
        // Only prune automatic backups
        if (type === 'automatic') {
          pruneBackups().catch(e => console.error('[Backup] Pruning failed:', e));
        }
        
        isBackingUp = false;
        resolve({ filename, timestamp: now, type });
      }
    });
  });
};

/**
 * Returns whether a backup is currently in progress
 */
const getIsBackingUp = () => isBackingUp;

/**
 * Helper to extract note from manual backup filename
 */
const extractNoteFromFilename = (filename) => {
  if (!filename.startsWith('manual_')) return null;
  // manual_YYYY-MM-DD_HH-mm_NOTE.sqlite
  const parts = filename.replace('.sqlite', '').split('_');
  if (parts.length > 3) {
    return parts.slice(3).join(' ').replace(/-/g, ' ');
  }
  return null;
};

/**
 * Fetches the list of all available backups partitioned by tier
 */
const getBackupsList = async () => {
  const getFilesFromDir = (dir) => {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(file => file.endsWith('.sqlite') || file.endsWith('.db'))
      .map(file => {
        const fullPath = path.join(dir, file);
        const stats = fs.statSync(fullPath);
        return {
          filename: file,
          size: stats.size,
          createdAt: stats.mtime,
          note: extractNoteFromFilename(file)
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  };

  return {
    automatic: getFilesFromDir(BACKUP_AUTO_DIR),
    manual: getFilesFromDir(BACKUP_MANUAL_DIR)
  };
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
 * Strictly targets BACKUP_AUTO_DIR.
 * Retention Policy:
 * - Daily: Keep 1/day for last 7 days
 * - Weekly: Keep 1/week for last 4 weeks
 * - Monthly: Keep 1/month for last 12 months
 */
const pruneBackups = async () => {
  const { automatic: backups } = await getBackupsList();
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
      fs.unlinkSync(path.join(BACKUP_AUTO_DIR, filename));
      console.log(`[Backup Prune] Deleted old automatic backup: ${filename}`);
    } catch (err) {
      console.error(`[Backup Prune] Failed to delete ${filename}:`, err);
    }
  }
};

/**
 * Deletes a manual backup file.
 * Implements strict path joining and basename usage to prevent directory traversal.
 * @param {string} filename - The name of the file to delete
 */
const deleteManualBackup = async (filename) => {
  return new Promise((resolve, reject) => {
    try {
      // 1. Sanitize: path.basename ensures we only have the filename, stripping any ../ or /
      const safeFilename = path.basename(filename);
      
      // 2. Resolve absolute path within the manual directory
      const fullPath = path.join(BACKUP_MANUAL_DIR, safeFilename);

      // 3. Security Check: Verify file exists and is actually inside the manual directory
      if (!fs.existsSync(fullPath)) {
        return reject(new Error('Backup file not found.'));
      }

      // 4. Perform deletion
      fs.unlinkSync(fullPath);
      console.log(`[Backup] Manually deleted: ${safeFilename}`);
      resolve({ success: true, filename: safeFilename });
    } catch (err) {
      console.error('[Backup] Failed to delete manual backup:', err);
      reject(err);
    }
  });
};

module.exports = {
  createBackup,
  getBackupsList,
  setAutoBackupState,
  getAutoBackupState,
  pruneBackups,
  deleteManualBackup,
  getIsBackingUp
};
