const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const cssPath = path.join(__dirname, '..', 'src', 'features', 'blackjack', 'blackjack.css');
const css = fs.readFileSync(cssPath, 'utf8');

function extractBlock(source, blockHeader) {
  const start = source.indexOf(blockHeader);
  assert.notStrictEqual(start, -1, `Expected to find CSS block: ${blockHeader}`);

  const bodyStart = source.indexOf('{', start);
  assert.notStrictEqual(bodyStart, -1, `Expected block opening brace for: ${blockHeader}`);

  let depth = 1;

  for (let index = bodyStart + 1; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;

    if (depth === 0) {
      return source.slice(bodyStart + 1, index);
    }
  }

  assert.fail(`Expected closing brace for: ${blockHeader}`);
}

const stackedMode980 = extractBlock(css, '@container blackjack-table (max-width: 980px)');

assert.match(css, /container-type:\s*inline-size;/, 'Expected blackjack.css to opt the table shell into container queries.');
assert.match(css, /container-name:\s*blackjack-table;/, 'Expected blackjack.css to name the blackjack table container.');
assert.match(css, /@container\s+blackjack-table/, 'Expected blackjack.css to define blackjack table container queries.');
assert.match(stackedMode980, /\.blackjack-seat\s*\{[\s\S]*transform:\s*none;/, 'Expected 980px stacked mode to reset base seat transforms.');
assert.match(stackedMode980, /\.blackjack-seat\.current-turn\s*\{[\s\S]*transform:\s*none;/, 'Expected 980px stacked mode to clear current-turn seat transforms.');
assert.match(stackedMode980, /\.blackjack-felt-pile\.left,\s*[\r\n]+\s*\.blackjack-felt-pile\.right\s*\{[\s\S]*left:\s*auto;[\s\S]*right:\s*auto;/, 'Expected 980px stacked mode to explicitly clear left and right felt pile offsets.');
assert.match(css, /--seat-5-outer-left-bottom:\s*240px;/, 'Expected separate outer-left bottom tuning for five-seat layout.');
assert.match(css, /--seat-5-outer-right-bottom:\s*220px;/, 'Expected separate outer-right bottom tuning for five-seat layout.');
assert.match(css, /--seat-5-outer-left-offset:\s*3\.2%;/, 'Expected separate outer-left offset tuning for five-seat layout.');
assert.match(css, /--seat-5-outer-right-offset:\s*2\.2%;/, 'Expected separate outer-right offset tuning for five-seat layout.');
assert.match(css, /\.blackjack-seat-5-2\s*\{[\s\S]*bottom:\s*var\(--seat-5-outer-left-bottom\);[\s\S]*left:\s*var\(--seat-5-outer-left-offset\);/, 'Expected seat 5-2 to use independent outer-left variables.');
assert.match(css, /\.blackjack-seat-5-5\s*\{[\s\S]*bottom:\s*var\(--seat-5-outer-right-bottom\);[\s\S]*right:\s*var\(--seat-5-outer-right-offset\);/, 'Expected seat 5-5 to use independent outer-right variables.');

console.log('blackjack responsive layout checks passed');
