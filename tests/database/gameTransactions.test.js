const assert = require('node:assert/strict');
const dbLayer = require('../../database');

function snapshotUserEconomy(userId) {
  return {
    user: { ...dbLayer.db.prepare('SELECT koala_balance FROM Users WHERE id = ?').get(userId) },
    transactions: dbLayer.db.prepare('SELECT amount, reason FROM KoalaTransactions WHERE user_id = ? ORDER BY id')
      .all(userId).map((row) => ({ ...row }))
  };
}

test('failed game purchases leave balances and transaction history unchanged', async () => {
  await dbLayer.ready;
  const userId = `game-rollback-${Date.now()}-${Math.random()}`;
  dbLayer.db.prepare('INSERT INTO Users (id, displayName, username, koala_balance) VALUES (?, ?, ?, ?)')
    .run(userId, 'Game Rollback', userId, 100);

  try {
    const before = snapshotUserEconomy(userId);
    await assert.rejects(() => dbLayer.applyBlackjackRoundBuyIn([{ userId, amount: 101 }]), /Not enough/);
    await assert.rejects(() => dbLayer.startTowerRound(userId, 101, 3), /Insufficient/);
    await assert.rejects(() => dbLayer.purchaseScratchcardTransaction(userId, 1, 'Test', 101, [], 0), /Insufficient/);
    await assert.rejects(() => dbLayer.buyWordleHint(userId, '2099-01-01'), /Insufficient/);
    assert.deepEqual(snapshotUserEconomy(userId), before);
  } finally {
    dbLayer.db.prepare('DELETE FROM KoalaTransactions WHERE user_id = ?').run(userId);
    dbLayer.db.prepare('DELETE FROM Users WHERE id = ?').run(userId);
  }
});

test('successful upgrade purchase commits balance, inventory, and transaction together', async () => {
  await dbLayer.ready;
  const userId = `upgrade-commit-${Date.now()}-${Math.random()}`;
  dbLayer.db.prepare('INSERT INTO Users (id, displayName, username, koala_balance) VALUES (?, ?, ?, ?)')
    .run(userId, 'Upgrade Commit', userId, 2000);

  try {
    await dbLayer.purchaseUpgrade(userId, 'coin_base_value', 500);
    assert.equal(dbLayer.db.prepare('SELECT koala_balance FROM Users WHERE id = ?').get(userId).koala_balance, 1500);
    assert.equal(dbLayer.db.prepare('SELECT current_level FROM UserUpgrades WHERE userId = ? AND upgrade_id = ?')
      .get(userId, 'coin_base_value').current_level, 1);
    assert.equal(dbLayer.db.prepare('SELECT COUNT(*) AS count FROM KoalaTransactions WHERE user_id = ?').get(userId).count, 1);
  } finally {
    dbLayer.db.prepare('DELETE FROM UserUpgrades WHERE userId = ?').run(userId);
    dbLayer.db.prepare('DELETE FROM KoalaTransactions WHERE user_id = ?').run(userId);
    dbLayer.db.prepare('DELETE FROM Users WHERE id = ?').run(userId);
  }
});
