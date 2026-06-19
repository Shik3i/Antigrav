# Remove Obsolete Extension Integration Design

## Goal

Remove every active browser-extension and proxy integration from `shared-timer-app` because the old extension no longer uses the website as a proxy and the integration is no longer in service.

## Current State

The legacy `SyncExtension/` source directory has already been removed. The web application still contains active integration code:

- a browser `postMessage` bridge and extension-presence detection in `App.jsx`
- an extension message event in `socketEvents.json`
- a Socket.IO relay in `sockets/socketHandler.js`
- force-sync emission, inbound browser messages, and extension status UI in `MemberPanel.jsx`
- an extension information page, route, route prefetch entry, and Settings link
- current extension descriptions and external links in the root README

These pieces form one obsolete data path: browser extension messages enter the page, are relayed through the KoalaWeb Socket.IO room, and are delivered back to browser extensions attached to other room members.

## Selected Approach

Delete the entire active data path and its user interface. Remove the event constant, server relay, browser event bridge, room-member controls and status, extension information page, route, prefetch entry, Settings link, and current README references.

Do not replace the integration with a feature flag or inactive compatibility layer. Leaving dormant proxy code would preserve unnecessary attack surface and maintenance cost without serving a current consumer.

## Historical Records

Existing entries in `src/data/changelog.json` remain unchanged. They describe behavior present in historical releases and are not active integration code. Searches used for final verification will distinguish these archival references from executable code and current documentation.

## Boundaries

In scope:

- `shared-timer-app/src/App.jsx`
- `shared-timer-app/socketEvents.json`
- `shared-timer-app/sockets/socketHandler.js`
- `shared-timer-app/src/components/MemberPanel.jsx`
- `shared-timer-app/src/pages/Settings.jsx`
- `shared-timer-app/src/pages/ExtensionInfo.jsx`
- `shared-timer-app/src/utils/prefetchRoutes.js`
- root `README.md`

Out of scope:

- unrelated Socket.IO room behavior
- unrelated MemberPanel controls
- historical changelog entries
- unrelated refactoring or formatting

## Expected Data Flow After Removal

KoalaWeb clients communicate only through the application’s supported Socket.IO and HTTP features. No browser `postMessage` event with an `EXTENSION_*` type is emitted, consumed, or forwarded. The server no longer accepts or broadcasts a generic extension payload.

## Verification

1. Add focused structural regression checks for absence of the extension bridge, Socket.IO event and relay, route, Settings link, MemberPanel UI, and prefetch entry.
2. Run the focused checks and the complete Vitest suite.
3. Run the Vite production build.
4. Search executable source and current documentation for remaining active extension references, excluding historical changelog data.
5. Start frontend and backend and smoke-test the start page, Settings navigation, and a representative room flow in the browser. Confirm `/extension-info` no longer renders the removed feature.
6. Review the final diff for unrelated changes.

## Success Criteria

- No active extension proxy, bridge, messaging event, status, control, route, page, prefetch, or Settings entry remains.
- Current README documentation does not advertise an extension integration.
- Historical changelog entries remain intact.
- Focused regression checks and the full automated test suite pass.
- The production build succeeds.
- Browser smoke tests show no visible runtime regression in the tested application flows.
