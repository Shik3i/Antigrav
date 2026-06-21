const assert = require('node:assert/strict');
const dbLayer = require('../../database');

test('timer completion retains its Promise contract and numeric write metadata', async () => {
  await dbLayer.ready;
  const userId = `node-sqlite-user-${Date.now()}`;
  const roomId = `node-sqlite-room-${Date.now()}`;
  dbLayer.db.prepare('INSERT INTO Users (id, displayName, username) VALUES (?, ?, ?)')
    .run(userId, 'Migration User', userId);

  try {
    const resultPromise = dbLayer.recordTimerCompletion(userId, roomId, 'Migration Room', 5);
    assert(resultPromise instanceof Promise);
    const eventId = await resultPromise;
    assert.equal(typeof eventId, 'number');
    assert.equal(await dbLayer.deleteTimerCompletion(eventId), 1);
  } finally {
    dbLayer.db.prepare('DELETE FROM TimerEvents WHERE userId = ?').run(userId);
    dbLayer.db.prepare('DELETE FROM Users WHERE id = ?').run(userId);
  }
});

test('friend records retain read, update, and delete contracts', async () => {
  await dbLayer.ready;
  const suffix = `${Date.now()}-${Math.random()}`;
  const firstId = `friend-first-${suffix}`;
  const secondId = `friend-second-${suffix}`;
  const insertUser = dbLayer.db.prepare('INSERT INTO Users (id, displayName, username) VALUES (?, ?, ?)');
  insertUser.run(firstId, 'First Friend', firstId);
  insertUser.run(secondId, 'Second Friend', secondId);

  try {
    const addPromise = dbLayer.addFriend(firstId, secondId);
    assert(addPromise instanceof Promise);
    assert.equal(await addPromise, 1);
    assert.equal((await dbLayer.getFriendStatus(firstId, secondId)).status, 'pending');
    assert.equal(await dbLayer.addFriend(firstId, secondId, 'accepted'), 1);
    assert.equal(await dbLayer.getUserFriendCount(firstId), 1);
    assert.equal(await dbLayer.removeFriend(firstId, secondId), 1);
  } finally {
    dbLayer.db.prepare('DELETE FROM Friends WHERE userId IN (?, ?) OR friendId IN (?, ?)')
      .run(firstId, secondId, firstId, secondId);
    dbLayer.db.prepare('DELETE FROM Users WHERE id IN (?, ?)').run(firstId, secondId);
  }
});

test('logging functions retain Promise contracts and numeric write metadata', async () => {
  await dbLayer.ready;
  const message = `node-sqlite-log-${Date.now()}-${Math.random()}`;
  const insertPromise = dbLayer.logError(message, null, 'migration-test');
  assert(insertPromise instanceof Promise);
  const logId = await insertPromise;
  assert.equal(typeof logId, 'number');

  try {
    const rows = await dbLayer.getErrorLogs(1000);
    assert(rows.some((row) => row.id === logId && row.message === message));
  } finally {
    assert.equal(await dbLayer.deleteErrorLog(logId), 1);
  }
});
