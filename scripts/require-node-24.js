function checkNodeVersion(version = process.version) {
  const match = /^v?(\d+)/.exec(version);
  const major = match ? Number.parseInt(match[1], 10) : null;
  return { ok: major === 24, major };
}

if (require.main === module) {
  const result = checkNodeVersion();
  if (!result.ok) {
    const detected = result.major === null ? process.version : `Node.js ${result.major}`;
    console.error(`KoalaWeb v3 requires Node.js 24 (detected: ${detected}). Use the repository .nvmrc before installing or starting.`);
    process.exitCode = 1;
  }
}

module.exports = { checkNodeVersion };
