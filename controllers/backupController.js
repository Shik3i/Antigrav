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

  try {
    const targetDir = type === 'manual' ? BACKUP_MANUAL_DIR : BACKUP_AUTO_DIR;
    
    // Ensure directories exist
    [BACKUP_AUTO_DIR, BACKUP_MANUAL_DIR].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    const now = new Date();
    const timestamp = now.toISOString().split('T')[0] + '_' + 
                      now.getHours().toString().padStart(2, '0') + '-' + 
                      now.getMinutes().toString().padStart(2, '0') + '-' +
                      now.getSeconds().toString().padStart(2, '0');
    
    // Sanitize note: remove non-alphanumeric/spaces, truncate
    const sanitizedNote = note.replace(/[^a-z0-9\s-]/gi, '').trim().replace(/\s+/g, '-').slice(0, 30);
    const filename = type === 'manual' 
      ? `manual_${timestamp}${sanitizedNote ? '_' + sanitizedNote : ''}.sqlite`
      : `backup_${timestamp}.sqlite`;
      
    const destPath = path.join(targetDir, filename);

    db.prepare('VACUUM INTO ?').run(destPath);
    console.log(`[Backup] Successfully created ${type} backup: ${filename}`);
    if (type === 'automatic') {
      try { await pruneBackups(); } catch (error) { console.error('[Backup] Pruning failed:', error); }
    }
    return { filename, timestamp: now, type };
  } catch (error) {
    console.error(`[Backup] Failed to create ${type} backup:`, error);
    if (logging && logging.logError) logging.logError(`${type.toUpperCase()} Backup failed`, error, { destPath: error.destPath });
    throw error;
  } finally {
    isBackingUp = false;
  }
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
 * Fetches the list of all available backups partitioned by tier.
 * Prioritizes date parsing from filename to prevent mtime drift.
 */
const getBackupsList = async () => {
  const parseDateFromFilename = (file) => {
    // backup_YYYY-MM-DD_HH-mm-ss.sqlite or manual_YYYY-MM-DD_HH-mm-ss...
    const match = file.match(/(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})/);
    if (match) {
      const [datePart, timePart] = [match[1], match[2].replace(/-/g, ':')];
      return new Date(`${datePart}T${timePart}`);
    }
    return null;
  };

  const getFilesFromDir = async (dir) => {
    if (!fs.existsSync(dir)) return [];
    const files = await fs.promises.readdir(dir);
    const result = [];

    for (const file of files) {
      if (!file.endsWith('.sqlite') && !file.endsWith('.db')) continue;
      const fullPath = path.join(dir, file);
      const stats = await fs.promises.stat(fullPath);
      
      // Authoritative date: Filename first, fallback to mtime
      const date = parseDateFromFilename(file) || stats.mtime;

      result.push({
        filename: file,
        size: stats.size,
        createdAt: date,
        note: extractNoteFromFilename(file)
      });
    }

    return result.sort((a, b) => b.createdAt - a.createdAt);
  };

  const [autoFiles, manualFiles] = await Promise.all([
    getFilesFromDir(BACKUP_AUTO_DIR),
    getFilesFromDir(BACKUP_MANUAL_DIR)
  ]);

  return {
    automatic: autoFiles,
    manual: manualFiles
  };
};

/**
 * Toggles the auto-backup state in ServerSettings
 */
const setAutoBackupState = async (enabled) => {
  db.prepare("INSERT OR REPLACE INTO ServerSettings (key, value) VALUES ('auto_backup_enabled', ?)")
    .run(enabled ? 'true' : 'false');
  return { enabled };
};

/**
 * Gets the current auto-backup state
 */
const getAutoBackupState = async () => {
  const row = db.prepare("SELECT value FROM ServerSettings WHERE key = 'auto_backup_enabled'").get();
  return row ? row.value === 'true' : false;
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
    }
  }

  // Iterate the delete list. Each entry failed to claim a slot in any GFS
  // bucket (daily/weekly/monthly) and is safe to remove.

  for (const filename of toDelete) {
    try {
      // Use async unlink — blocking unlinkSync would stall the event loop
      // while pruning multiple files, violating the non-blocking cron rule.
      await fs.promises.unlink(path.join(BACKUP_AUTO_DIR, filename));
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
  try {
    const safeFilename = path.basename(filename);
    const fullPath = path.join(BACKUP_MANUAL_DIR, safeFilename);

    if (!fs.existsSync(fullPath)) {
      throw new Error('Backup file not found.');
    }

    // Use async unlink to prevent blocking the event loop
    await fs.promises.unlink(fullPath);
    console.log(`[Backup] Manually deleted: ${safeFilename}`);
    return { success: true, filename: safeFilename };
  } catch (err) {
    console.error('[Backup] Failed to delete manual backup:', err);
    throw err;
  }
};

/**
 * Resolves the absolute path for a backup file after validation.
 * @param {string} tier - 'automatic' or 'manual'
 * @param {string} filename - The backup filename
 * @returns {string|null} - Absolute path or null if invalid
 */
const getBackupPath = (tier, filename) => {
  if (tier !== 'automatic' && tier !== 'manual') return null;
  const baseDir = tier === 'manual' ? BACKUP_MANUAL_DIR : BACKUP_AUTO_DIR;
  const safeFilename = path.basename(filename);
  const fullPath = path.join(baseDir, safeFilename);
  
  if (fs.existsSync(fullPath)) return fullPath;
  return null;
};

module.exports = {
  createBackup,
  getBackupsList,
  setAutoBackupState,
  getAutoBackupState,
  pruneBackups,
  deleteManualBackup,
  getIsBackingUp,
  getBackupPath
};
