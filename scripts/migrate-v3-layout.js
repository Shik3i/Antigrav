const fs = require('node:fs');
const path = require('node:path');

function removeIfEmpty(directory) {
  if (!fs.existsSync(directory)) return;
  if (fs.statSync(directory).isDirectory() && fs.readdirSync(directory).length === 0) {
    fs.rmdirSync(directory);
  }
}

function moveFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  try {
    fs.renameSync(source, destination);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
    fs.unlinkSync(source);
  }
}

function migrateLegacyLayout({ rootDir = path.resolve(__dirname, '..'), logger = console.log } = {}) {
  const legacyRoot = path.join(rootDir, 'shared-timer-app');
  const moved = [];
  const conflicts = [];

  function migrateEntry(source, destination, relativePath) {
    if (!fs.existsSync(source)) return;
    const sourceStats = fs.lstatSync(source);

    if (sourceStats.isDirectory()) {
      if (!fs.existsSync(destination)) {
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        try {
          fs.renameSync(source, destination);
          moved.push(relativePath.replaceAll('\\', '/'));
          return;
        } catch (error) {
          if (error.code !== 'EXDEV') throw error;
        }
      }

      fs.mkdirSync(destination, { recursive: true });
      for (const child of fs.readdirSync(source)) {
        migrateEntry(
          path.join(source, child),
          path.join(destination, child),
          path.join(relativePath, child)
        );
      }
      removeIfEmpty(source);
      return;
    }

    const normalized = relativePath.replaceAll('\\', '/');
    if (fs.existsSync(destination)) {
      conflicts.push(normalized);
      logger(`[v3 migration] Kept legacy ${normalized}: destination already exists.`);
      return;
    }

    moveFile(source, destination);
    moved.push(normalized);
    logger(`[v3 migration] Moved ${normalized} to the repository root.`);
  }

  if (!fs.existsSync(legacyRoot)) return { moved, conflicts };

  migrateEntry(path.join(legacyRoot, '.env'), path.join(rootDir, '.env'), '.env');
  migrateEntry(path.join(legacyRoot, 'data'), path.join(rootDir, 'data'), 'data');
  removeIfEmpty(legacyRoot);

  return { moved, conflicts };
}

if (require.main === module) {
  const result = migrateLegacyLayout();
  if (result.conflicts.length > 0) {
    console.warn(`[v3 migration] ${result.conflicts.length} conflict(s) require manual review.`);
  }
}

module.exports = { migrateLegacyLayout };
