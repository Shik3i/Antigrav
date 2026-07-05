const fs = require('fs');
const path = require('path');

test('speedcube mobile styles do not globally override all glass cards', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/pages/SpeedcubeTimer.jsx'), 'utf8');

  expect(source).not.toContain('.glass-card {\n      overflow: visible !important;\n      padding: 40px 24px !important;');
  expect(source).toContain('.speedcube-timer-card {\n      overflow: visible !important;\n      padding: 40px 24px !important;');
  expect(source).toContain('className="glass-card speedcube-timer-card"');
});
