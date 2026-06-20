const assert = require('node:assert/strict');
const dbLayer = require('../../database');

test('score records retain insert, read, and delete contracts', async () => {
  await dbLayer.ready;
  const userId = `score-user-${Date.now()}-${Math.random()}`;
  const gameId = `score-game-${Date.now()}-${Math.random()}`;
  dbLayer.db.prepare('INSERT INTO Users (id, displayName, username) VALUES (?, ?, ?)')
    .run(userId, 'Score User', userId);

  let scoreId;
  try {
    const insertPromise = dbLayer.recordGameScore(userId, gameId, 42, 7);
    assert(insertPromise instanceof Promise);
    scoreId = (await insertPromise).id;
    assert.equal(typeof scoreId, 'number');
    const rows = await dbLayer.getAdminGameScores(gameId);
    assert(rows.some((row) => row.id === scoreId && row.score === 42));
    assert.equal(await dbLayer.deleteGameScore(scoreId), 1);
    scoreId = null;
  } finally {
    if (scoreId) dbLayer.db.prepare('DELETE FROM GameScores WHERE id = ?').run(scoreId);
    dbLayer.db.prepare('DELETE FROM Users WHERE id = ?').run(userId);
  }
});

test('speedcube records retain insert, update, read, and delete contracts', async () => {
  await dbLayer.ready;
  const userId = `cube-user-${Date.now()}-${Math.random()}`;
  dbLayer.db.prepare('INSERT INTO Users (id, displayName, username) VALUES (?, ?, ?)')
    .run(userId, 'Cube User', userId);

  let timeId;
  try {
    const inserted = await dbLayer.addSpeedcubeTime(userId, 1234, 'initial', 'R U');
    timeId = inserted.id;
    assert.equal(typeof timeId, 'number');
    assert.equal(await dbLayer.updateSpeedcubeNote(timeId, userId, 'updated'), 1);
    const rows = await dbLayer.getSpeedcubeTimes(userId);
    assert(rows.some((row) => row.id === timeId && row.note === 'updated'));
    assert.equal(await dbLayer.deleteSpeedcubeTime(timeId, userId), 1);
    timeId = null;
  } finally {
    if (timeId) dbLayer.db.prepare('DELETE FROM SpeedcubeTimes WHERE id = ?').run(timeId);
    dbLayer.db.prepare('DELETE FROM Users WHERE id = ?').run(userId);
  }
});
