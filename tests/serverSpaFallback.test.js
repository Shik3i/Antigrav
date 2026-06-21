const assert = require('node:assert/strict');
const { once } = require('node:events');
const { server } = require('../server');

test('direct SPA routes serve index.html from a hidden worktree path', async () => {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/admin`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<div id="root"><\/div>/);
  } finally {
    server.close();
    await once(server, 'close');
  }
});
