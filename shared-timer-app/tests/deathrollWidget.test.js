const assert = require('assert');
const fs = require('fs');
const path = require('path');

test('DeathrollWidget uses SlotReels and slot machine cabinet', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'DeathrollWidget.jsx'),
    'utf8'
  );

  assert(!src.includes('scrambleIntervalRef'), 'Scramble interval must be removed');
  assert(!src.includes('window.setInterval'), 'setInterval must be removed');
  assert(src.includes('SlotReels'), 'Must render SlotReels component');
  assert(src.includes("import SlotReels"), 'Must import SlotReels');
  assert(src.includes('2200'), 'isRolling timer must be 2200ms');
  assert(src.includes('Black Ops One'), 'Cabinet title must use Black Ops One font');
  assert(src.includes('DEATHROLL'), 'Cabinet must show DEATHROLL title');
  assert(src.includes('cabinet--critical'), 'Must apply cabinet-pulse class for critical tier');
  assert(src.includes('isRolling'), 'Must maintain isRolling state for SlotReels');
});
