const assert = require('node:assert/strict');
const dbLayer = require('../../database');

test('database readiness resolves only after required schema exists', async () => {
  assert(dbLayer.ready instanceof Promise);
  await dbLayer.ready;
  const columns = dbLayer.db.prepare('PRAGMA table_info(Users)').all();
  assert(columns.some((column) => column.name === 'id'));
});
