const db = require('../connection');
const towerConfig = require('../../config/towerClimb');

function mapTowerRoundRow(row) {
  if (!row) return null;
  return { ...row, selectedTiles: JSON.parse(row.selectedTiles || '[]'), trapPattern: JSON.parse(row.trapPattern || '[]'),
    currentPayout: Math.floor(row.bet * row.currentMultiplier), multiplierTable: towerConfig.getTowerMultiplierTable(row.tilesPerLevel),
    canCashout: row.status === 'running' && row.currentLevel > 0 };
}
const getActiveTowerRound = async (userId) => mapTowerRoundRow(db.prepare("SELECT * FROM TowerClimbRounds WHERE userId = ? AND status = 'running'").get(userId));
const getLatestTowerRound = async (userId) => mapTowerRoundRow(db.prepare('SELECT * FROM TowerClimbRounds WHERE userId = ? ORDER BY createdAt DESC LIMIT 1').get(userId));
const getTowerHistory = async (userId, limit = 10) => db.prepare('SELECT * FROM TowerClimbRounds WHERE userId = ? ORDER BY createdAt DESC LIMIT ?').all(userId, limit).map(mapTowerRoundRow);

async function startTowerRound(userId, bet, tilesPerLevel) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const user = db.prepare('SELECT koala_balance FROM Users WHERE id = ?').get(userId);
    if (!user || user.koala_balance < bet) throw new Error('Insufficient balance');
    if (db.prepare("SELECT id FROM TowerClimbRounds WHERE userId = ? AND status = 'running'").get(userId)) {
      const error = new Error('Already have an active round'); error.status = 400; throw error;
    }
    db.prepare('UPDATE Users SET koala_balance = koala_balance - ? WHERE id = ?').run(bet, userId);
    db.prepare('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)').run(userId, -bet, 'Tower Climb Bet');
    const trapPattern = Array.from({ length: 8 }, () => Math.floor(Math.random() * tilesPerLevel));
    const result = db.prepare('INSERT INTO TowerClimbRounds (userId, bet, tilesPerLevel, trapPattern) VALUES (?, ?, ?, ?)')
      .run(userId, bet, tilesPerLevel, JSON.stringify(trapPattern));
    db.exec('COMMIT');
    return { round: mapTowerRoundRow(db.prepare('SELECT * FROM TowerClimbRounds WHERE id = ?').get(result.lastInsertRowid)), newBalance: user.koala_balance - bet };
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

function towerResponse(roundId, userId) {
  return { round: mapTowerRoundRow(db.prepare('SELECT * FROM TowerClimbRounds WHERE id = ?').get(roundId)),
    newBalance: (db.prepare('SELECT koala_balance FROM Users WHERE id = ?').get(userId) || {}).koala_balance };
}

async function resolveTowerPick(userId, tileIndex, expectedLevel) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const row = db.prepare("SELECT * FROM TowerClimbRounds WHERE userId = ? AND status = 'running'").get(userId);
    if (!row) throw new Error('No active round');
    if (row.currentLevel !== expectedLevel) throw new Error('Level mismatch');
    const traps = JSON.parse(row.trapPattern); const selected = JSON.parse(row.selectedTiles);
    const isTrap = traps[row.currentLevel] === tileIndex;
    selected.push({ level: row.currentLevel, tileIndex, trapIndex: traps[row.currentLevel], result: isTrap ? 'trap' : 'safe' });
    if (isTrap) {
      db.prepare("UPDATE TowerClimbRounds SET status='lost', selectedTiles=?, resolvedAt=CURRENT_TIMESTAMP WHERE id=?")
        .run(JSON.stringify(selected), row.id);
    } else {
      const nextLevel = row.currentLevel + 1;
      const nextMultiplier = towerConfig.getTowerMultiplierTable(row.tilesPerLevel)[nextLevel];
      if (nextLevel >= 8) {
        const payout = Math.floor(row.bet * nextMultiplier);
        db.prepare("UPDATE TowerClimbRounds SET status='won', currentLevel=?, currentMultiplier=?, selectedTiles=?, payout=?, resolvedAt=CURRENT_TIMESTAMP WHERE id=?")
          .run(nextLevel, nextMultiplier, JSON.stringify(selected), payout, row.id);
        db.prepare('UPDATE Users SET koala_balance=koala_balance+? WHERE id=?').run(payout, userId);
        db.prepare('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)').run(userId, payout, 'Tower Climb Win (Max Level)');
      } else {
        db.prepare('UPDATE TowerClimbRounds SET currentLevel=?, currentMultiplier=?, selectedTiles=? WHERE id=?')
          .run(nextLevel, nextMultiplier, JSON.stringify(selected), row.id);
      }
    }
    db.exec('COMMIT');
    return towerResponse(row.id, userId);
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

async function cashoutTowerRound(userId) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const row = db.prepare("SELECT * FROM TowerClimbRounds WHERE userId=? AND status='running'").get(userId);
    if (!row) throw new Error('No active round');
    if (row.currentLevel === 0) throw new Error('Cannot cashout at level 0');
    const payout = Math.floor(row.bet * row.currentMultiplier);
    db.prepare("UPDATE TowerClimbRounds SET status='cashed_out', payout=?, resolvedAt=CURRENT_TIMESTAMP WHERE id=?").run(payout, row.id);
    db.prepare('UPDATE Users SET koala_balance=koala_balance+? WHERE id=?').run(payout, userId);
    db.prepare('INSERT INTO KoalaTransactions (user_id, amount, reason) VALUES (?, ?, ?)').run(userId, payout, 'Tower Climb Cashout');
    db.exec('COMMIT');
    return { ...towerResponse(row.id, userId), payout };
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
const getUserTowerClimbCount = async (userId) => db.prepare('SELECT COUNT(*) AS count FROM TowerClimbRounds WHERE userId=?').get(userId).count;

module.exports = { getActiveTowerRound, getLatestTowerRound, getTowerHistory, startTowerRound, resolveTowerPick, cashoutTowerRound, getUserTowerClimbCount };
