const assert = require('node:assert/strict');
const dbLayer = require('../../database');

test('failed economic mutation leaves the user balance unchanged', async () => {
  await dbLayer.ready;
  const userId = `economy-rollback-${Date.now()}-${Math.random()}`;
  dbLayer.db.prepare('INSERT INTO Users (id, displayName, username, koala_balance) VALUES (?, ?, ?, ?)')
    .run(userId, 'Rollback User', userId, 100);
  dbLayer.db.exec(`
    CREATE TEMP TRIGGER force_koala_transaction_failure
    BEFORE INSERT ON KoalaTransactions
    WHEN NEW.reason = 'force rollback'
    BEGIN
      SELECT RAISE(ABORT, 'forced transaction failure');
    END
  `);

  try {
    const before = dbLayer.db.prepare('SELECT koala_balance FROM Users WHERE id = ?').get(userId);
    await assert.rejects(
      () => dbLayer.addKoalaCoins(userId, 50, 'force rollback'),
      /forced transaction failure/
    );
    const after = dbLayer.db.prepare('SELECT koala_balance FROM Users WHERE id = ?').get(userId);
    assert.equal(after.koala_balance, before.koala_balance);
  } finally {
    dbLayer.db.exec('DROP TRIGGER IF EXISTS force_koala_transaction_failure');
    dbLayer.db.prepare('DELETE FROM KoalaTransactions WHERE user_id = ?').run(userId);
    dbLayer.db.prepare('DELETE FROM Users WHERE id = ?').run(userId);
  }
});

test('user functions retain Promise and row-shape contracts', async () => {
  await dbLayer.ready;
  const userId = `user-shape-${Date.now()}-${Math.random()}`;
  const username = `shape-${Date.now()}-${Math.random()}`;

  try {
    const addPromise = dbLayer.addUser(userId, 'Shape User');
    assert(addPromise instanceof Promise);
    assert.equal(await addPromise, 1);
    await dbLayer.updateUserName(userId, 'Updated Shape User');
    dbLayer.db.prepare('UPDATE Users SET username = ? WHERE id = ?').run(username, userId);
    const user = await dbLayer.getUserByUsername(username);
    assert.equal(user.id, userId);
    assert.equal(user.displayName, 'Updated Shape User');
  } finally {
    dbLayer.db.prepare('DELETE FROM Users WHERE id = ?').run(userId);
  }
});

test('external settings, countdown, and RSS contracts retain their result shapes', async () => {
  await dbLayer.ready;
  const previousPolymarket = await dbLayer.getPolymarketSettings();
  const suffix = `${Date.now()}-${Math.random()}`;
  let countdownId;
  let feedId;

  try {
    assert.equal(await dbLayer.updatePolymarketSettings(true), true);
    assert.deepEqual({ ...(await dbLayer.getPolymarketSettings()) }, { allowUsersToAdd: true });

    const countdown = await dbLayer.createCountdown(`Countdown ${suffix}`, '2030-01-01', null, 'Migration', true, false);
    countdownId = countdown.id;
    assert.equal(typeof countdownId, 'number');
    assert.equal((await dbLayer.getCountdownById(countdownId)).eventName, `Countdown ${suffix}`);

    const feed = await dbLayer.addRssFeed(`Feed ${suffix}`, `https://example.test/${suffix}.xml`);
    feedId = feed.id;
    assert.equal(typeof feedId, 'number');
    assert.equal((await dbLayer.getRssFeedById(feedId)).name, `Feed ${suffix}`);
  } finally {
    if (countdownId) await dbLayer.deleteCountdown(countdownId);
    if (feedId) await dbLayer.deleteRssFeed(feedId);
    await dbLayer.updatePolymarketSettings(previousPolymarket.allowUsersToAdd);
  }
});
