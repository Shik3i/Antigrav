const assert = require('assert');
const dbLayer = require('../database');
const db = dbLayer.db;

const USER_ID = 'plan-blackjack-economy-user';

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function cleanup() {
  await run('DELETE FROM KoalaTransactions WHERE user_id = ?', [USER_ID]);
  await run('DELETE FROM BlackjackStats WHERE userId = ?', [USER_ID]);
  await run('DELETE FROM Users WHERE id = ?', [USER_ID]);
}

(async () => {
  await cleanup();

  try {
    await dbLayer.addUser(USER_ID, 'Blackjack Economy');
    await dbLayer.updateUserBalance(USER_ID, 100000);

    const initialBalance = await dbLayer.getUserBalance(USER_ID);
    assert.strictEqual(initialBalance, 100000, 'seeded balance should be available before the round starts');

    const afterRoundBuyIn = await dbLayer.applyBlackjackRoundBuyIn([{ userId: USER_ID, amount: 10000 }]);
    assert.strictEqual(afterRoundBuyIn[0].balance, 90000, 'starting a round should deduct the reserved wager');

    const afterDouble = await dbLayer.applyBlackjackBetDelta(USER_ID, 5000, 'Blackjack Double Down');
    assert.strictEqual(afterDouble, 85000, 'double down should deduct immediately during the active round');

    let insufficientError = null;
    try {
      await dbLayer.applyBlackjackRoundBuyIn([{ userId: USER_ID, amount: 200000 }]);
    } catch (err) {
      insufficientError = err;
    }

    assert(insufficientError, 'oversized round buy-in should be rejected');

    const finalBalance = await dbLayer.getUserBalance(USER_ID);
    assert.strictEqual(finalBalance, 85000, 'rejected round buy-in must not change stored balance');
  } finally {
    await cleanup();
  }

  console.log('blackjack economy regression passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
