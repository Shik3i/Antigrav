const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'SlotReels.jsx'),
  'utf8'
);

test('SlotReels component meets all structural requirements', () => {
  assert(src.includes('STRIP_DIGITS'), 'Must define STRIP_DIGITS array');
  assert(src.includes('reel-strip--spinning'), 'Must apply reel-strip--spinning CSS class during spin');
  assert(src.includes('reel-column--locking'), 'Must apply reel-column--locking CSS class on lock');
  assert(src.includes('targetY'), 'Must define targetY function for translateY calculation');
  assert(src.includes('+ 10) * 74'), 'targetY must use second digit occurrence (index + 10) × 74px');
  assert(src.includes('1400'), 'Must schedule lock-in start at 1400ms');
  assert(src.includes('160'), 'Must stagger lock-in by 160ms per reel');
  assert(src.includes("export default SlotReels"), 'Must export SlotReels as default');
  assert(src.includes('value'), 'Must accept value prop');
  assert(src.includes('tier'), 'Must accept tier prop');
  assert(src.includes('isRolling'), 'Must accept isRolling prop');
  assert(src.includes('clearTimers') || src.includes('clearTimeout'), 'Must clean up timers on unmount/re-run');

  console.log('All SlotReels tests passed.');
});
