const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8'
}).trim();

test('application and deployment entrypoints live at repository root', () => {
  for (const file of ['package.json', 'server.js', 'Dockerfile', 'docker-compose.yml']) {
    assert.ok(fs.existsSync(path.join(repoRoot, file)), `${file} must exist at repo root`);
  }
  assert.ok(!fs.existsSync(path.join(repoRoot, 'shared-timer-app')), 'shared-timer-app must not exist at repo root');

  const workflow = fs.readFileSync(
    path.join(repoRoot, '.github/workflows/docker-publish.yml'),
    'utf8'
  );
  assert.ok(!workflow.match(/context:\s*\.\/shared-timer-app/), 'GitHub Actions workflow must not contain context: ./shared-timer-app');
  assert.ok(workflow.match(/context:\s*\./), 'GitHub Actions workflow must contain context: .');
});

test('generated development artifacts are not tracked', () => {
  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' });
  assert.ok(!tracked.match(/(^|\/)\.playwright-mcp\//m), 'Git must not track .playwright-mcp/');
  assert.ok(!tracked.match(/(^|\/)__pycache__\//m), 'Git must not track __pycache__/');
  assert.ok(!tracked.match(/(^|\/)scratch\//m), 'Git must not track scratch/');
});