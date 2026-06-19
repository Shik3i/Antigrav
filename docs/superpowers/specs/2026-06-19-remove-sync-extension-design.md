# Remove Local SyncExtension Design

## Goal

Remove the obsolete local `SyncExtension/` browser-extension source from the Antigrav repository without changing or breaking the extension-facing behavior of `shared-timer-app`.

## Current State

The repository contains a legacy extension implementation under `SyncExtension/`. The web application does not import, bundle, serve, or otherwise read files from that directory. Its current extension information page already points users to the standalone KoalaSync website, GitHub repository, and release downloads.

The web application still contains runtime integration for communicating with an installed KoalaSync extension. That integration is part of `shared-timer-app` and must remain unchanged.

## Selected Approach

Delete the tracked `SyncExtension/` directory completely. Do not modify extension messaging, Socket.IO events, extension status detection, the `/extension-info` route, or external KoalaSync links in `shared-timer-app`.

Update the root `README.md` so it no longer claims that a browser extension is included in this repository. Describe KoalaSync as a separate optional project and link to its website, releases, and source repository. Remove `SyncExtension/` from the documented repository tree and remove documentation follow-ups that assume a local extension directory.

## Boundaries

Files in scope:

- all tracked files below `SyncExtension/`, which will be deleted
- root `README.md`, which will be updated

Files and behavior explicitly out of scope:

- `shared-timer-app` application code
- extension messaging and synchronization behavior
- Socket.IO event names and handlers
- KoalaSync download, website, and source-code targets
- unrelated cleanup or refactoring

## Verification

After the deletion and README update:

1. Search the repository for references that incorrectly describe `SyncExtension/` as a local directory.
2. Run the existing Vitest suite with `npm test` from `shared-timer-app/`.
3. Build the production frontend with `npm run build`.
4. Start the application and perform a browser smoke test of the rendered site, including `/extension-info`, confirming that the external KoalaSync presentation still renders and no runtime error is visible.
5. Review the final Git diff to ensure no `shared-timer-app` source file changed.

## Success Criteria

- `SyncExtension/` no longer exists in the repository.
- `shared-timer-app` tests and production build pass.
- The application renders successfully in a browser.
- `/extension-info` remains available and points to the standalone KoalaSync project.
- The root README accurately describes the resulting repository structure and extension relationship.
