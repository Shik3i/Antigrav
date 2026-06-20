const assert = require('assert');
const dbLayer = require('../database');
const db = dbLayer.db;

const USER_ID = 'plan-blackjack-economy-user';

function run(sql, params = []) {
  return db.prepare(sql).run(...params);
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

    const afterRoundBuyIn = await dbLayer.applyBlackjackRoundBuyIn([{ userId: USER_ID, amount: 10000, sideBetAmount: 5000 }]);
    assert.strictEqual(afterRoundBuyIn[0].balance, 85000, 'starting a round should deduct the reserved wager plus side bets');

    const afterDouble = await dbLayer.applyBlackjackBetDelta(USER_ID, 5000, 'Blackjack Double Down');
    assert.strictEqual(afterDouble, 80000, 'double down should deduct immediately during the active round');

    let insufficientError = null;
    try {
      await dbLayer.applyBlackjackRoundBuyIn([{ userId: USER_ID, amount: 200000 }]);
    } catch (err) {
      insufficientError = err;
    }

    assert(insufficientError, 'oversized round buy-in should be rejected');

    const finalBalance = await dbLayer.getUserBalance(USER_ID);
    assert.strictEqual(finalBalance, 80000, 'rejected round buy-in must not change stored balance');

    await dbLayer.applyBlackjackSettlement([
      {
        userId: USER_ID,
        username: 'Blackjack Economy',
        settlementType: 'main',
        bet: 10000,
        payout: 20000,
        netProfit: 10000,
        blackjack: false
      },
      {
        userId: USER_ID,
        username: 'Blackjack Economy',
        settlementType: 'sideBet',
        sideBetKey: 'twins',
        bet: 2000,
        payout: 22000,
        netProfit: 20000
      }
    ]);

    const stats = db.prepare('SELECT gamesPlayed, totalWagered, totalWon FROM BlackjackStats WHERE userId = ?')
      .get(USER_ID);
    assert.strictEqual(stats.gamesPlayed, 1, 'side bet settlement should not count as an extra blackjack hand');
    assert.strictEqual(stats.totalWagered, 10000, 'side bet wager should not inflate main blackjack wager stats');
    assert.strictEqual(stats.totalWon, 20000, 'side bet payout should not inflate main blackjack win stats');

    const balanceAfterMixedWin = await dbLayer.getUserBalance(USER_ID);
    assert.strictEqual(
      balanceAfterMixedWin,
      122000,
      'main payout plus winning side bet payout should be credited after upfront buy-in deductions'
    );

    await dbLayer.applyBlackjackRoundBuyIn([{ userId: USER_ID, amount: 10000, sideBetAmount: 3000 }]);
    await dbLayer.applyBlackjackSettlement([
      {
        userId: USER_ID,
        username: 'Blackjack Economy',
        settlementType: 'main',
        bet: 10000,
        payout: 0,
        netProfit: -10000,
        blackjack: false
      },
      {
        userId: USER_ID,
        username: 'Blackjack Economy',
        settlementType: 'sideBet',
        sideBetKey: 'bust',
        bet: 3000,
        payout: 0,
        netProfit: -3000
      }
    ]);

    const balanceAfterMixedLoss = await dbLayer.getUserBalance(USER_ID);
    assert.strictEqual(
      balanceAfterMixedLoss,
      109000,
      'losing main bet and losing side bet should stay deducted with no extra settlement credit'
    );
  } finally {
    await cleanup();
  }

  console.log('blackjack economy regression passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
