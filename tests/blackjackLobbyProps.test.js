const assert = require('assert');
const fs = require('fs');
const path = require('path');

const lobbySource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'features', 'blackjack', 'components', 'BlackjackLobby.jsx'),
  'utf8'
);

const propsBlockMatch = lobbySource.match(/export default function BlackjackLobby\(\{\s*([\s\S]*?)\s*\}\) \{/);
assert(propsBlockMatch, 'BlackjackLobby should declare a destructured props object');

const props = propsBlockMatch[1]
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

assert(
  props.includes('handleSwitchRoom'),
  'BlackjackLobby must accept handleSwitchRoom because the Beitreten button calls it'
);

console.log('blackjack lobby props regression passed');
