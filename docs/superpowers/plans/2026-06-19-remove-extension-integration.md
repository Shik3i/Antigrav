# Remove Obsolete Extension Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the unused Antigrav browser-extension proxy, messaging path, UI, route, and current documentation without affecting KoalaWeb room behavior or the standalone KoalaSync project.

**Architecture:** Delete the obsolete path at every boundary: browser window messages, client Socket.IO emission, server Socket.IO relay, shared event name, and user-facing entry points. Preserve historical changelog entries, and add a source-level regression test that prevents any active integration marker from returning.

**Tech Stack:** React, React Router, Socket.IO, Node.js, Vitest, Vite

---

### Task 1: Add a regression test for the obsolete integration

**Files:**
- Create: `shared-timer-app/tests/extensionIntegrationRemoval.test.js`

- [ ] **Step 1: Write the failing structural regression test**

```js
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
```

- [ ] **Step 2: Run the test and confirm it fails before implementation**

Run: `npx vitest run tests/extensionIntegrationRemoval.test.js`

Expected: FAIL because active source files still contain extension markers and `ExtensionInfo.jsx` still exists.

### Task 2: Remove browser and room UI integration

**Files:**
- Modify: `shared-timer-app/src/App.jsx`
- Modify: `shared-timer-app/src/components/MemberPanel.jsx`
- Modify: `shared-timer-app/src/pages/Settings.jsx`
- Modify: `shared-timer-app/src/utils/prefetchRoutes.js`
- Delete: `shared-timer-app/src/pages/ExtensionInfo.jsx`

- [ ] **Step 1: Remove the application bridge and route**

From `src/App.jsx`, delete the `ExtensionInfo` lazy import, the `handleWindowMessage` function, its `window.addEventListener('message', ...)` registration and cleanup, and the `/extension-info` route. Keep the authentication invalidation listener and all ordinary Socket.IO lifecycle handlers unchanged.

- [ ] **Step 2: Remove room controls and extension presence UI**

From `src/components/MemberPanel.jsx`, remove the unused `Tv`, `Play`, `Pause`, and `Plug` icon imports; delete `handleMediaAction`; delete the `hasExtension` plug badge; and delete the complete `Screen Sync (Netflix/YT)` control block. Keep all timer, Pomodoro, minigame, member, and room-connection controls unchanged.

- [ ] **Step 3: Remove the Settings entry point and route prefetch**

From `src/pages/Settings.jsx`, remove the unused `Download` icon import and the `/extension-info` link. From `src/utils/prefetchRoutes.js`, remove the `/extension-info` loader entry.

- [ ] **Step 4: Delete the obsolete page**

Delete `src/pages/ExtensionInfo.jsx` with no replacement route. React Router's existing catch-all behavior will handle visits to the removed URL.

### Task 3: Remove the server relay protocol

**Files:**
- Modify: `shared-timer-app/socketEvents.json`
- Modify: `shared-timer-app/sockets/socketHandler.js`

- [ ] **Step 1: Remove the shared event name**

Delete the `"EXTENSION_MESSAGE": "extension_message"` entry from `socketEvents.json`, preserving valid JSON and the surrounding event order.

- [ ] **Step 2: Remove the generic payload relay**

Delete the complete `GENERIC EXTENSION PAYLOAD PIPE` handler from `sockets/socketHandler.js`, including the optional room-history write and blind room broadcast. Keep the neighboring deathroll and admin handlers unchanged.

- [ ] **Step 3: Run the focused regression test**

Run: `npx vitest run tests/extensionIntegrationRemoval.test.js`

Expected: PASS and output `extension integration removal regression passed`.

### Task 4: Remove current extension documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Remove current integration claims**

Delete the extensibility bullet that advertises the KoalaSync browser extension and delete the complete current `Browser-Erweiterung` section with website, release, and source links. Keep the README section separators valid and do not alter historical application changelog data.

- [ ] **Step 2: Verify active references are gone**

Run:

```bash
rg -n "EXTENSION_|extension_message|hasExtension|extension-info|ExtensionInfo|Get Browser Extension|Screen Sync \(Netflix/YT\)|KoalaSync|Browser-Erweiterung" \
  shared-timer-app/src shared-timer-app/sockets shared-timer-app/socketEvents.json README.md
```

Expected: no matches. `shared-timer-app/src/data/changelog.json` is intentionally excluded.

### Task 5: Verify application behavior

**Files:**
- Test: `shared-timer-app/tests/extensionIntegrationRemoval.test.js`

- [ ] **Step 1: Run the complete test suite**

Run: `npm test` from `shared-timer-app/`.

Expected: 30 test files pass, including the new removal regression test.

- [ ] **Step 2: Build the production frontend**

Run: `npm run build` from `shared-timer-app/`.

Expected: Vite exits with status 0 and no `ExtensionInfo` chunk appears in the output.

- [ ] **Step 3: Run the full local application**

Start `npm start` and `npm run dev -- --host 127.0.0.1` from `shared-timer-app/`.

Expected: backend listens on port 3001 and Vite serves the frontend on its reported local URL.

- [ ] **Step 4: Perform browser smoke tests**

Verify the home page and `/settings` render without a visible runtime error, the Settings page has no browser-extension link, and `/extension-info` no longer renders the deleted KoalaSync page.

- [ ] **Step 5: Stop both local processes**

Terminate only the backend and Vite processes started for this verification.

### Task 6: Review final scope

**Files:**
- Review: all files listed above

- [ ] **Step 1: Check formatting and changes**

Run: `git diff --check && git status --short && git diff --stat`

Expected: no whitespace errors; only the previously approved `SyncExtension/` deletion, README update, implementation documents, new regression test, and targeted active-integration removals are present.

- [ ] **Step 2: Confirm historical records remain**

Run: `git diff -- shared-timer-app/src/data/changelog.json`

Expected: no output.
