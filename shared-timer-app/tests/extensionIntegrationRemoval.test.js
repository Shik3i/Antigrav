const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const activeSources = [
  'socketEvents.json',
  'sockets/socketHandler.js',
  'src/App.jsx',
  'src/components/MemberPanel.jsx',
  'src/pages/Settings.jsx',
  'src/utils/prefetchRoutes.js'
];

const forbiddenMarkers = [
  'EXTENSION_MESSAGE',
  'EXTENSION_PONG',
  'EXTENSION_OUTBOUND',
  'EXTENSION_INBOUND',
  'hasExtension',
  'extension-info',
  'ExtensionInfo',
  'Get Browser Extension',
  'Screen Sync (Netflix/YT)'
];

test('active extension integration is removed', () => {
  for (const relativePath of activeSources) {
    const source = read(relativePath);
    for (const marker of forbiddenMarkers) {
      assert.equal(
        source.includes(marker),
        false,
        `${relativePath} must not contain obsolete extension marker: ${marker}`
      );
    }
  }

  assert.equal(
    fs.existsSync(path.join(root, 'src/pages/ExtensionInfo.jsx')),
    false,
    'The obsolete extension information page must be deleted'
  );

  console.log('extension integration removal regression passed');
});
