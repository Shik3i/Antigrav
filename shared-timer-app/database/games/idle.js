const db = require('../connection');

const getIdleProfile = (userId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Idle_Profiles WHERE userId = ?', [userId], (err, row) => {
      if (err) reject(err);
      else { if (row && (row.dollars === null || row.dollars < 1000000)) row.dollars = 1000000; resolve(row); }
    });
  });
};

const createIdleProfile = (userId) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT OR IGNORE INTO Idle_Profiles (userId) VALUES (?)', [userId], function (err) { err ? reject(err) : resolve(this.changes); });
  });
};

const updateIdleProfile = (userId, data) => {
  return new Promise((resolve, reject) => {
    const keys = Object.keys(data); if (keys.length === 0) return resolve(0);
    const fields = keys.map(k => `${k} = ?`).join(', ');
    db.run(`UPDATE Idle_Profiles SET ${fields} WHERE userId = ?`, [...Object.values(data), userId], function (err) { err ? reject(err) : resolve(this.changes); });
  });
};

const updateInventoryUnit = (id, data) => {
  return new Promise((resolve, reject) => {
    const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
    db.run(`UPDATE Idle_Inventory SET ${fields} WHERE id = ?`, [...Object.values(data), id], (err) => err ? reject(err) : resolve());
  });
};

const getIdleInventory = (userId) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM Idle_Inventory WHERE userId = ?', [userId], (err, rows) => err ? reject(err) : resolve(rows || []));
  });
};

const addInventoryUnit = (userId, teamCode, rarity = 'Common', baseStats = 10, role = 'Top') => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO Idle_Inventory (userId, team_code, rarity, base_stats, role, level) VALUES (?, ?, ?, ?, ?, ?)', [userId, teamCode, rarity, baseStats, role, 1], function (err) { err ? reject(err) : resolve({ id: this.lastID, userId, team_code: teamCode, tier: 1, rarity, base_stats: baseStats, role, level: 1 }); });
  });
};

const deleteInventoryUnit = (unitId) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM Idle_Inventory WHERE id = ?', [unitId], (err) => err ? reject(err) : resolve());
  });
};

const mergeInventoryUnits = (userId, teamCode, tier, role) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.all('SELECT id FROM Idle_Inventory WHERE userId = ? AND team_code = ? AND tier = ? AND role = ? AND is_equipped = 0 LIMIT 3', [userId, teamCode, tier, role], (err, rows) => {
        if (err || rows.length < 3) return db.run('ROLLBACK', () => reject(err || new Error('Not enough units')));
        const ids = rows.map(r => r.id);
        db.run(`DELETE FROM Idle_Inventory WHERE id IN (${ids.join(',')})`, (err) => {
          if (err) return db.run('ROLLBACK', () => reject(err));
          db.run('INSERT INTO Idle_Inventory (userId, team_code, tier, role) VALUES (?, ?, ?, ?)', [userId, teamCode, tier + 1, role], function (err) { if (err) return db.run('ROLLBACK', () => reject(err)); db.run('COMMIT'); resolve({ id: this.lastID, tier: tier + 1, role }); });
        });
      });
    });
  });
};

const mergeAllInventoryUnits = (userId) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.all('SELECT id, team_code, tier, role FROM Idle_Inventory WHERE userId = ? AND is_equipped = 0', [userId], async (err, rows) => {
        if (err) return reject(err);
        const groups = {}; rows.forEach(r => { const key = `${r.team_code}-${r.tier}-${r.role}`; if (!groups[key]) groups[key] = []; groups[key].push(r.id); });
        const toDelete = []; const toInsert = [];
        Object.keys(groups).forEach(key => { const ids = groups[key]; const [team_code, tierStr, role] = key.split('-'); const tier = parseInt(tierStr); const sets = Math.floor(ids.length / 3); if (sets > 0) { for (let i = 0; i < sets; i++) { toDelete.push(...ids.slice(i * 3, (i + 1) * 3)); toInsert.push({ team_code, tier: tier + 1, role }); } } });
        if (toDelete.length === 0) return resolve({ changes: 0 });
        db.run('BEGIN TRANSACTION');
        try {
          db.run(`DELETE FROM Idle_Inventory WHERE id IN (${toDelete.join(',')})`);
          const stmt = db.prepare('INSERT INTO Idle_Inventory (userId, team_code, tier, role) VALUES (?, ?, ?, ?)');
          toInsert.forEach(item => stmt.run(userId, item.team_code, item.tier, item.role)); stmt.finalize();
          db.run('COMMIT', (err) => err ? reject(err) : resolve({ changes: toInsert.length }));
        } catch (e) { db.run('ROLLBACK'); reject(e); }
      });
    });
  });
};

const getIdleRoster = (userId) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT r.slot_id, i.* FROM Idle_Roster r LEFT JOIN Idle_Inventory i ON r.inventory_id = i.id WHERE r.userId = ? ORDER BY r.slot_id ASC', [userId], (err, rows) => err ? reject(err) : resolve(rows || []));
  });
};

const assignInventoryToRoster = (userId, slotId, inventoryId) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      if (inventoryId === null) {
        db.get('SELECT inventory_id FROM Idle_Roster WHERE userId = ? AND slot_id = ?', [userId, slotId], (err, row) => {
          if (row && row.inventory_id) db.run('UPDATE Idle_Inventory SET is_equipped = 0 WHERE id = ?', [row.inventory_id]);
          db.run('UPDATE Idle_Roster SET inventory_id = NULL WHERE userId = ? AND slot_id = ?', [userId, slotId], (err) => err ? (db.run('ROLLBACK'), reject(err)) : (db.run('COMMIT'), resolve()));
        });
      } else {
        db.run('UPDATE Idle_Inventory SET is_equipped = 1 WHERE id = ?', [inventoryId]);
        db.get('SELECT inventory_id FROM Idle_Roster WHERE userId = ? AND slot_id = ?', [userId, slotId], (err, row) => {
          if (row && row.inventory_id) db.run('UPDATE Idle_Inventory SET is_equipped = 0 WHERE id = ?', [row.inventory_id]);
          db.run('INSERT INTO Idle_Roster (userId, slot_id, inventory_id) VALUES (?, ?, ?) ON CONFLICT(userId, slot_id) DO UPDATE SET inventory_id = excluded.inventory_id', [userId, slotId, inventoryId], (err) => err ? (db.run('ROLLBACK'), reject(err)) : (db.run('COMMIT'), resolve()));
        });
      }
    });
  });
};

const updateInventoryXP = (id, amount) => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE Idle_Inventory SET experience = experience + ? WHERE id = ?', [amount, id], function (err) { err ? reject(err) : resolve(this.changes); });
  });
};

const updateRosterMode = (userId, slotId, mode) => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE Idle_Roster SET current_mode = ? WHERE userId = ? AND slot_id = ?', [mode, userId, slotId], function (err) { err ? reject(err) : resolve(this.changes); });
  });
};

const addRiftDefenseTower = (userId, teamCode, starLevel = 1, rarityTier = 0) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO RiftDefense_Towers (userId, teamCode, starLevel, rarityTier) VALUES (?, ?, ?, ?)', [userId, teamCode, starLevel, rarityTier], function (err) { err ? reject(err) : resolve({ id: this.lastID, userId, teamCode, starLevel, rarityTier }); });
  });
};

const getUserRiftDefenseTowers = (userId) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM RiftDefense_Towers WHERE userId = ? ORDER BY starLevel DESC, teamCode ASC', [userId], (err, rows) => err ? reject(err) : resolve(rows || []));
  });
};

const deleteRiftDefenseTowers = (userId, teamCode, starLevel, limit) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM RiftDefense_Towers WHERE id IN (SELECT id FROM RiftDefense_Towers WHERE userId = ? AND teamCode = ? AND starLevel = ? LIMIT ?)', [userId, teamCode, starLevel, limit], function(err) { err ? reject(err) : resolve(this.changes); });
  });
};

const scrapRiftDefenseTower = (id, userId) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM RiftDefense_Towers WHERE id = ? AND userId = ?', [id, userId], function(err) { err ? reject(err) : resolve(this.changes); });
  });
};

const updateRiftDefenseStats = (userId, highestWave, minionsKilled, bossesKilled) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO RiftDefense_Stats (userId, highestWave, totalMinionsKilled, totalBossesKilled) VALUES (?, ?, ?, ?) ON CONFLICT(userId) DO UPDATE SET highestWave = MAX(highestWave, excluded.highestWave), totalMinionsKilled = totalMinionsKilled + excluded.totalMinionsKilled, totalBossesKilled = totalBossesKilled + excluded.totalBossesKilled, updatedAt = CURRENT_TIMESTAMP', [userId, highestWave, minionsKilled, bossesKilled], function(err) { err ? reject(err) : resolve(this.changes); });
  });
};

const getRiftDefenseLeaderboards = () => {
  return new Promise((resolve, reject) => {
    const q = (f) => `SELECT r.userId, u.username, u.displayName, u.preferences, r.${f} as value FROM RiftDefense_Stats r JOIN Users u ON r.userId = u.id ORDER BY r.${f} DESC LIMIT 50`;
    Promise.all([new Promise(res => db.all(q('highestWave'), [], (e, r) => res(r))), new Promise(res => db.all(q('totalMinionsKilled'), [], (e, r) => res(r))), new Promise(res => db.all(q('totalBossesKilled'), [], (e, r) => res(r)))])
      .then(([highestWave, totalMinions, totalBosses]) => resolve({ highestWave, totalMinions, totalBosses })).catch(reject);
  });
};

module.exports = {
  getIdleProfile,
  createIdleProfile,
  updateIdleProfile,
  updateInventoryUnit,
  getIdleInventory,
  addInventoryUnit,
  deleteInventoryUnit,
  mergeInventoryUnits,
  mergeAllInventoryUnits,
  getIdleRoster,
  assignInventoryToRoster,
  updateInventoryXP,
  updateRosterMode,
  addRiftDefenseTower,
  getUserRiftDefenseTowers,
  deleteRiftDefenseTowers,
  scrapRiftDefenseTower,
  updateRiftDefenseStats,
  getRiftDefenseLeaderboards,
};
