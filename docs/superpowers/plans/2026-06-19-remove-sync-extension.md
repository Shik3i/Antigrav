# Remove Local SyncExtension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the legacy local browser-extension source while preserving and verifying the standalone KoalaSync integration in the web application.

**Architecture:** The `SyncExtension/` tree is an independent legacy artifact and will be deleted without touching `shared-timer-app`. The root documentation will describe KoalaSync as an external optional companion, and the existing application will be validated through tests, a production build, and a browser smoke test.

**Tech Stack:** Git, Markdown, Node.js, npm, Vitest, Vite, React, in-app browser automation

---

### Task 1: Remove the legacy extension source

**Files:**
- Delete: `SyncExtension/README.md`
- Delete: `SyncExtension/background.js`
- Delete: `SyncExtension/bridge.js`
- Delete: `SyncExtension/content.js`
- Delete: `SyncExtension/icons/icon128.png`
- Delete: `SyncExtension/manifest.json`
- Delete: `SyncExtension/popup.html`
- Delete: `SyncExtension/popup.js`

- [ ] **Step 1: Confirm the application has no filesystem dependency on the directory**

Run: `rg -n "SyncExtension/|SyncExtension" shared-timer-app --glob '!src/data/changelog.json'`

Expected: no imports, file reads, build inputs, or runtime paths referencing the local directory. Historical changelog text may be excluded because it is application history, not a dependency.

- [ ] **Step 2: Delete every tracked file under the directory**

Apply a patch that deletes the eight tracked files listed above. Once empty, `SyncExtension/` disappears from Git automatically.

- [ ] **Step 3: Verify the deletion scope**

Run: `git status --short SyncExtension shared-timer-app`

Expected: only deleted files below `SyncExtension/`; no changes below `shared-timer-app/`.

### Task 2: Update the root documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Remove claims that an extension is bundled locally**

Change the overview, extensibility list, repository tree, browser-extension section, and documentation follow-up list so none describes `SyncExtension/` as part of this repository.

- [ ] **Step 2: Document the standalone KoalaSync project**

Keep the browser-extension section, but state that KoalaSync is an optional separate project used for synchronized media playback. Include these exact destinations:

```text
Website: https://sync.koalastuff.net
Releases: https://github.com/Shik3i/KoalaSync/releases
Source: https://github.com/Shik3i/KoalaSync
```

- [ ] **Step 3: Check documentation consistency**

Run: `rg -n "SyncExtension|Browser-Erweiterung|KoalaSync" README.md`

Expected: no `SyncExtension` result and only statements describing KoalaSync as external or standalone.

### Task 3: Verify the web application

**Files:**
- Test only: `shared-timer-app/`

- [ ] **Step 1: Run automated tests**

Run: `npm test` from `shared-timer-app/`.

Expected: Vitest exits with status 0.

- [ ] **Step 2: Build the production frontend**

Run: `npm run build` from `shared-timer-app/`.

Expected: Vite exits with status 0 and produces the production bundle.

- [ ] **Step 3: Start a local development server**

Run: `npm run dev -- --host 127.0.0.1` from `shared-timer-app/` and retain the reported local URL.

Expected: Vite reports a local HTTP URL without a startup error.

- [ ] **Step 4: Perform browser smoke tests**

Open the local site in the in-app browser. Confirm the application renders without a visible runtime error. Navigate to `/extension-info` and confirm that the KoalaSync heading and standalone website, release, and source links render.

- [ ] **Step 5: Stop the local server**

Terminate only the development-server process started in Step 3.

### Task 4: Review final scope and commit

**Files:**
- Review: `README.md`
- Review: `SyncExtension/`
- Review: `shared-timer-app/`

- [ ] **Step 1: Verify formatting and scope**

Run: `git diff --check && git diff -- shared-timer-app && git status --short`

Expected: no whitespace errors; no diff under `shared-timer-app/`; only the plan, README update, and `SyncExtension/` deletions are uncommitted.

- [ ] **Step 2: Commit the verified change**

```bash
git add README.md SyncExtension docs/superpowers/plans/2026-06-19-remove-sync-extension.md
git commit -m "chore: remove legacy sync extension"
```

Expected: Git creates one commit containing the deletion, README correction, and implementation plan.
