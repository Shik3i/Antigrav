# Blackjack Refactor Design

**Date:** 2026-04-23

**Goal:** Split the oversized blackjack backend and frontend files into focused modules without changing the game's external behavior, while making the UI easier to maintain and better on mobile screens.

**In Scope:**
- Refactor [`utils/blackjackRoomManager.js`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/utils/blackjackRoomManager.js) into smaller backend modules behind a stable public API.
- Refactor [`src/pages/Blackjack.jsx`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/src/pages/Blackjack.jsx) into a page shell, hooks, components, and dedicated styles.
- Make small supporting changes to controller and socket integration where they reduce coupling or preserve a clean boundary.
- Improve mobile layout and interaction patterns for the blackjack page.

**Out of Scope:**
- Rewriting blackjack game rules or payout rules.
- Migrating in-memory blackjack room state to database persistence.
- Reworking unrelated games or global layout systems.
- Replacing the current socket contract unless needed for a narrow cleanup.

## Problem Summary

The current blackjack implementation has two oversized files doing too much:

- [`utils/blackjackRoomManager.js`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/utils/blackjackRoomManager.js) mixes room creation, player state, seat movement, betting, round flow, dealer behavior, settlement, bot automation, ticking, and serialization.
- [`src/pages/Blackjack.jsx`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/src/pages/Blackjack.jsx) mixes route-level data fetching, socket synchronization, derived state, view composition, animations, and a large amount of embedded CSS.

This makes behavior harder to reason about, increases regression risk, and blocks mobile improvements because layout and state logic are tightly coupled.

## Design Principles

1. Preserve behavior first. The refactor should keep the current socket events, REST endpoints, and game flow working during the migration.
2. Split by responsibility, not by technical fashion. New files should each own one coherent concern.
3. Keep a stable orchestration boundary. Existing consumers should still import a single backend manager entrypoint and a single page route entrypoint.
4. Prefer pure logic extraction where possible. Game rules, settlement, and serialization should be testable without requiring socket or timer setup.
5. Design mobile-first on the frontend. Desktop table positioning can remain rich, but smaller screens need a simpler layout model.

## Backend Target Architecture

The backend should move from one stateful monolith to a small stateful facade plus focused modules under `utils/blackjack/`.

### Public Entry Point

- `utils/blackjackRoomManager.js`

This file remains the public API used by:
- [`controllers/blackjackController.js`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/controllers/blackjackController.js)
- [`sockets/socketHandler.js`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/sockets/socketHandler.js)

Its job becomes:
- own the shared `rooms` map
- compose helper modules
- expose the existing public methods with minimal orchestration glue

It should not continue to own most game logic inline.

### Internal Backend Modules

- `utils/blackjack/roomState.js`
  - creates room objects, player objects, hand objects
  - normalizes room ids and table sizes
  - owns small structural helpers like reset state creation

- `utils/blackjack/roomQueries.js`
  - `getRoom`
  - `getPlayerByUserId`
  - `getOrderedPlayers`
  - `getNextFreeSeat`
  - `getPlayerRoomId`
  - read-only helpers such as `hasActiveRound`

- `utils/blackjack/serialization.js`
  - serializes player state
  - serializes dealer hand visibility
  - serializes settlement entries
  - builds room state payloads for sockets and API consumers

- `utils/blackjack/tableLifecycle.js`
  - `createRoom`
  - `joinRoom`
  - `leaveRoom`
  - `addBot`
  - `moveSeat`
  - `listRooms`
  - auto-start scheduling decisions that are tied to lobby/betting state

- `utils/blackjack/roundActions.js`
  - `placeBet`
  - `startRound`
  - `hit`
  - `stand`
  - `doubleDown`
  - `split`

- `utils/blackjack/turnEngine.js`
  - `advanceTurn`
  - turn deadline updates
  - active hand progression rules

- `utils/blackjack/dealerEngine.js`
  - `beginDealerTurn`
  - `resolveDealerTurn`

- `utils/blackjack/settlement.js`
  - `settleRound`
  - payout calculation
  - end-of-round reset and discard handling

- `utils/blackjack/botEngine.js`
  - bot betting behavior
  - bot action decision rules
  - scheduling-related bot timing helpers

- `utils/blackjack/tickEngine.js`
  - drives periodic room updates
  - delegates to dealer, timeout, bot, settlement, and auto-start handlers
  - returns changed room ids

### Backend Dependency Rules

- `blackjackRoomManager.js` may import all blackjack modules.
- Domain modules may import cards/rules utilities and query helpers.
- Modules should avoid circular imports. Shared helpers belong in `roomState.js`, `roomQueries.js`, or `serialization.js`.
- `controllers/blackjackController.js` and `sockets/socketHandler.js` should continue to depend only on the facade, not on internal blackjack modules.

## Frontend Target Architecture

The frontend should move from a single page component into a route shell with feature-local modules under `src/features/blackjack/`.

### Public Entry Point

- `src/pages/Blackjack.jsx`

This file stays as the route-level entrypoint exported to the router. It should be reduced to:
- auth guard / top-level page setup
- feature composition
- minimal page-specific wiring

### Internal Frontend Modules

- `src/features/blackjack/hooks/useBlackjackRoom.js`
  - room selection
  - socket subscription
  - fallback fetches
  - action dispatch helpers
  - derived flags needed by the page shell

- `src/features/blackjack/hooks/useBlackjackTimers.js`
  - turn countdown
  - auto-start countdown
  - settlement timers if needed

- `src/features/blackjack/components/BlackjackTable.jsx`
  - main table scene composition
  - arranges dealer zone, seat region, and control region

- `src/features/blackjack/components/BlackjackDealer.jsx`
  - dealer cards
  - dealer status
  - discard/shoe visual blocks if kept

- `src/features/blackjack/components/BlackjackSeat.jsx`
  - player seat card
  - active hand rendering
  - seat-level controls and status display

- `src/features/blackjack/components/BlackjackControls.jsx`
  - betting chips
  - hit / stand / double / split controls
  - mobile sticky action tray behavior

- `src/features/blackjack/components/BlackjackLobby.jsx`
  - room selection
  - table size controls
  - auto-bet toggle
  - join/seat affordances not specific to active turns

- `src/features/blackjack/components/BlackjackLeaderboard.jsx`
  - leaderboard display and sorting controls

- `src/features/blackjack/components/SettlementToast.jsx`
- `src/features/blackjack/components/BlackjackCelebration.jsx`
- `src/features/blackjack/components/PlayingCard.jsx`

- `src/features/blackjack/utils/formatters.js`
  - `formatKC`
  - seat mapping helpers
  - chip breakdown helpers
  - small presentational helpers that do not need React

- `src/features/blackjack/blackjack.css`
  - all extracted styles and breakpoints

## Mobile Design Requirements

The current page uses a table-centric layout with substantial absolute positioning. That works on desktop but becomes brittle on small screens. The refactor should make mobile a first-class layout mode.

### Mobile Layout Rules

On narrow screens:
- the dealer area should remain near the top
- player seats should switch from spread table positions to a stacked or scrollable card layout
- controls should move into a sticky bottom action tray
- chip stacks and decorative table elements should scale down or collapse
- large animation layers should remain optional and not block interaction

### Responsive Breakpoints

Use three layout tiers:
- mobile: single-column, stacked interaction model
- tablet: compact table layout with reduced seat spread
- desktop: current immersive table layout with absolute seat positioning

Exact breakpoint values can follow the app's existing responsive conventions, but the CSS should keep the layout strategy separate per tier rather than trying to stretch one geometry system across all widths.

### Interaction Requirements

- Primary actions must remain reachable without horizontal scrolling.
- Countdown and current-turn state must stay visible while scrolling on mobile.
- Buttons should have larger hit areas on touch screens.
- Dense inline text should be reduced in favor of badges and compact labels.

## Modernization Goals

The refactor should modernize implementation style where it improves clarity without forcing unnecessary rewrites.

### Frontend

- Move large derived state blocks into hooks or plain helpers.
- Prefer feature-local utilities over page-local helper sprawl.
- Use CSS classes and variables instead of large inline style objects where practical.
- If event handlers depend on volatile state in effects, prefer modern React patterns that reduce stale closures and effect churn.
- Keep memoization pragmatic; do not add `useMemo` or `useCallback` everywhere by default.

### Backend

- Separate pure calculations from state mutation where feasible.
- Use small modules with explicit input/output contracts.
- Keep timer-driven transitions centralized in the tick engine rather than scattered across action handlers.

## Supporting File Changes

Small supporting edits are allowed if they reduce coupling:

- [`controllers/blackjackController.js`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/controllers/blackjackController.js)
  - keep controller behavior the same
  - optionally extract repeated response/emit helpers if needed for readability

- [`sockets/socketHandler.js`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/sockets/socketHandler.js)
  - keep event names and ack behavior stable
  - optionally extract blackjack-specific socket handler registration into a focused helper if this can be done with low migration risk

The important constraint is that the blackjack refactor should not spread new coupling into these files.

## Migration Strategy

Refactor in thin, behavior-preserving layers:

1. Extract backend shared helpers and serialization first.
2. Extract backend gameplay modules behind the existing manager API.
3. Verify socket/controller consumers still work without import changes.
4. Extract frontend pure helpers and leaf components first.
5. Move socket/data lifecycle into hooks.
6. Move embedded CSS into a dedicated feature stylesheet.
7. Introduce mobile-specific layout mode once component boundaries are stable.

This sequence reduces regression risk by preserving stable entrypoints during the split.

## Testing Strategy

### Backend Tests

Add focused tests for extracted logic if a test location already exists or is being introduced as part of the refactor:
- room creation and joining constraints
- betting validation
- split and double-down edge cases
- turn advancement across multiple hands
- dealer draw and stand behavior
- settlement payout outcomes
- bot decisions for common scenarios

If the project lacks an established backend unit test harness, the plan should still include targeted verification commands or lightweight test scaffolding for the new pure modules.

### Frontend Verification

- verify room loading and reconnection behavior
- verify player actions still emit the same socket events
- verify mobile layout for small viewport widths
- verify desktop table layout remains intact
- verify countdown visibility and sticky controls on mobile

## Risks and Mitigations

- Risk: circular imports after splitting backend modules
  - Mitigation: centralize shared helpers into dedicated query/state modules and keep the facade as the only top-level orchestrator

- Risk: subtle regressions in turn progression or settlement
  - Mitigation: extract pure logic first and add focused verification around round transitions

- Risk: frontend split changes behavior while moving JSX around
  - Mitigation: keep the route shell stable, extract leaf components first, then move data hooks

- Risk: mobile redesign breaks desktop table feel
  - Mitigation: treat mobile and desktop as separate layout modes with explicit breakpoints

## Success Criteria

The refactor is successful when:

- `blackjackRoomManager.js` is reduced to a thin facade instead of a large logic owner
- `Blackjack.jsx` becomes a page shell rather than a feature monolith
- blackjack-specific logic lives in focused feature/backend modules with clear responsibilities
- controller and socket integration still use stable public entrypoints
- the blackjack page is materially easier to use on mobile
- gameplay behavior remains consistent with the current implementation
