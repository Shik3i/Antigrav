# Blackjack Refactor Design

**Date:** 2026-04-23

**Goal:** Split the oversized blackjack backend and frontend files into focused modules without changing external behavior, while establishing a reusable casino-game architecture that can support both seat/turn-based games like blackjack and simultaneous betting games like roulette.

**In Scope:**
- Refactor [`utils/blackjackRoomManager.js`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/utils/blackjackRoomManager.js) behind a stable public API.
- Refactor [`src/pages/Blackjack.jsx`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/src/pages/Blackjack.jsx) into a route shell plus feature-local modules.
- Introduce a shared casino backend core for real cross-game concerns.
- Improve the blackjack page's maintainability and mobile layout.
- Preserve current REST and socket contracts during the migration.

**Out of Scope:**
- Changing blackjack rules, payouts, or player-visible game behavior on purpose.
- Implementing roulette or poker in this refactor.
- Moving blackjack state from memory into persistent storage.
- Reworking unrelated games or global layout systems.

## Problem Summary

The current blackjack implementation has two oversized files doing too much:

- [`utils/blackjackRoomManager.js`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/utils/blackjackRoomManager.js) mixes room creation, player state, seating, betting, round flow, dealer logic, settlement, bot automation, ticking, and serialization.
- [`src/pages/Blackjack.jsx`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/src/pages/Blackjack.jsx) mixes route-level data loading, socket synchronization, derived state, rendering, animations, and a large amount of embedded CSS.

This creates three concrete problems:

1. Behavior is harder to reason about and test because unrelated concerns are tightly coupled.
2. Mobile improvements are harder because layout, interaction, and data wiring live in one page component.
3. Future casino games are at risk of copying the same monolith pattern unless the structure is corrected now.

## Design Principles

1. Preserve behavior first. Keep socket events, REST endpoints, and table flow stable during the refactor.
2. Split by responsibility. Each new module should own one coherent concern.
3. Keep public entrypoints stable. Existing consumers should still depend on one backend facade and one route entrypoint.
4. Prefer a phase-first shared model. Shared casino infrastructure should revolve around tables, participants, rounds, phases, deadlines, and serialization, not around blackjack turns.
5. Only abstract real commonality. Shared code should reflect concerns visible across games today, not speculative framework design.
6. Keep game rules local. Anything tied to blackjack rules, dealer behavior, or hand progression remains blackjack-specific.
7. Design mobile as a first-class mode. The frontend split should support different layout strategies for mobile and desktop.

## Backend Target Architecture

The backend should move from one large blackjack-specific manager to:

- a thin blackjack facade that preserves the current public API
- a shared casino core for cross-game concerns
- blackjack-specific modules for blackjack rules and state transitions

The key structural choice is **phase-first**, not **seat-first**.

That means the shared layer should understand concepts like:
- table
- participant
- round
- phase
- deadline
- serialization
- tick/timer orchestration

It should **not** require every game to have:
- seats
- a current active player
- turn order
- hands
- a dealer

Those belong only to games that need them.

## Why Phase-First Instead of Seat-First

A seat/turn-oriented shared layer fits blackjack and poker well, but it is the wrong foundation for roulette.

Roulette needs to support:
- simultaneous betting by many players
- open and closed betting phases
- spin resolution
- payout settlement without active-turn progression

If the shared layer is built around `currentPlayerTurn` and seating, roulette becomes a forced fit with awkward exceptions. A phase-first model handles both patterns cleanly:

- **Blackjack** can express phases like `waiting`, `betting`, `dealing`, `player_turns`, `dealer_turn`, `settlement`
- **Roulette** can express phases like `waiting`, `betting_open`, `betting_closed`, `spin`, `settlement`

This allows shared orchestration without overgeneralizing game rules.

## Proposed Backend Structure

```text
utils/
  blackjackRoomManager.js

  casino/
    core/
      tableRegistry.js
      participants.js
      roundLifecycle.js
      phaseTimers.js
      serialization.js
      stateFactories.js

    blackjack/
      tableLifecycle.js
      bets.js
      roundFlow.js
      turns.js
      dealer.js
      settlement.js
      botStrategy.js
      serialization.js
```

This refactor does not need to create `utils/casino/roulette/` now, but the structure should leave a clear place for it later.

## Backend Module Responsibilities

### Public Facade

- `utils/blackjackRoomManager.js`

Responsibilities:
- remain the only public blackjack backend entrypoint for current consumers
- own or receive access to the blackjack room registry
- compose shared casino core helpers and blackjack modules
- preserve the current export surface wherever practical

It should become orchestration glue, not a large logic owner.

### Shared Casino Core

- `utils/casino/core/tableRegistry.js`
  - create, store, fetch, and remove table state
  - normalize room ids and shared table metadata

- `utils/casino/core/stateFactories.js`
  - create base table state
  - create participant state
  - create shared round/phase state
  - provide shared structural defaults

- `utils/casino/core/participants.js`
  - join/leave/reconnect helpers
  - connection state updates
  - optional seat-related helpers for games that use seats
  - must not force seats on games that do not need them

- `utils/casino/core/roundLifecycle.js`
  - round id progression
  - shared phase/status transitions
  - helpers for entering/exiting phases

- `utils/casino/core/phaseTimers.js`
  - deadline timestamps
  - auto-start and phase timing helpers
  - shared tick-oriented time checks

- `utils/casino/core/serialization.js`
  - room summary payloads for lobby views
  - shared participant summaries
  - generic state serialization helpers used by specific games

### Blackjack Modules

- `utils/casino/blackjack/tableLifecycle.js`
  - blackjack room creation defaults
  - join, leave, add bot, move seat, list room behavior
  - seating rules for blackjack tables

- `utils/casino/blackjack/bets.js`
  - bet validation
  - place bet behavior
  - betting-phase side effects

- `utils/casino/blackjack/roundFlow.js`
  - start round
  - initial hand setup
  - dealing transitions
  - bridge from betting into player turns

- `utils/casino/blackjack/turns.js`
  - hit, stand, double down, split
  - active hand progression
  - player turn advancement

- `utils/casino/blackjack/dealer.js`
  - dealer turn start
  - dealer draw/stand behavior

- `utils/casino/blackjack/settlement.js`
  - payout calculation
  - last-settlement payloads
  - discard/reset logic after a round

- `utils/casino/blackjack/botStrategy.js`
  - bot betting decisions
  - bot turn decisions
  - bot timing decisions

- `utils/casino/blackjack/serialization.js`
  - blackjack-specific room state payloads
  - dealer hole-card visibility handling
  - settlement payload shaping

## Dependency Rules

- `blackjackRoomManager.js` may import from `utils/casino/core/` and `utils/casino/blackjack/`.
- Shared core modules must not import blackjack modules.
- Blackjack modules may depend on shared core modules plus existing blackjack rules/cards utilities.
- Controllers and sockets should continue to depend only on [`utils/blackjackRoomManager.js`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/utils/blackjackRoomManager.js).
- Avoid circular imports by keeping shared queries/factories/timers in dedicated core modules.

## How Blackjack Fits the Shared Core

Blackjack should use the shared core for:
- room registration
- participant presence
- shared phase/deadline mechanics
- lobby summaries
- generic tick orchestration patterns

Blackjack should keep these concepts local:
- dealer hand
- player hands
- active hand index
- split/double-down rules
- current player turn
- dealer drawing rules
- blackjack settlement outcomes

This keeps blackjack expressive without contaminating the shared layer with game-specific assumptions.

## Future Roulette Readiness

The shared architecture must explicitly leave space for roulette, which differs structurally from blackjack.

Roulette is expected to reuse:
- table registration
- participant presence
- round and phase timing
- generic serialization helpers
- common controller/socket integration patterns

Roulette should not be forced to reuse:
- seating
- turn order
- active-player progression
- dealer-hand concepts
- hand-state concepts

That is the main reason the shared core is phase-first.

## Roulette Starting Points

To make follow-up work easier, the refactor should leave behind a clear and intentionally modest starting point for roulette. This is not a full roulette design. It is a continuation hook so later work can begin without revisiting the architecture decision.

### Minimal Roulette Module Shape

When roulette work starts, it should fit beside blackjack like this:

```text
utils/
  casino/
    roulette/
      tableLifecycle.js
      bets.js
      roundFlow.js
      wheel.js
      settlement.js
      serialization.js
```

### Shared Core Expectations For Roulette

Roulette should be able to reuse:
- table registration and table lookup
- participant presence and reconnect behavior
- shared round ids and phase progression helpers
- deadline/timer handling for betting windows and spin delays
- shared room-summary serialization for lobby views
- shared tick orchestration conventions

Roulette should be free to define its own:
- bet schema
- table limits
- phase names beyond the shared concept of a phase
- settlement logic
- wheel/spin resolution
- UI payload details

### Minimal Roulette State Shape

The shared core should leave room for a roulette table state roughly like:

```js
{
  roomId: 'roulette-main',
  game: 'roulette',
  status: 'waiting',
  roundId: 1,
  participants: [],
  phase: 'betting_open',
  phaseDeadlineAt: null,
  betsByUserId: {},
  winningNumber: null,
  winningColor: null,
  lastSettlement: []
}
```

This is intentionally rough. The important point is that it fits the shared table/round/phase model without requiring seats or a current active player.

### Minimal Roulette Phase Flow

The first roulette implementation should be able to express:

1. `waiting`
2. `betting_open`
3. `betting_closed`
4. `spin`
5. `settlement`

That is enough to validate the shared phase-first architecture before expanding roulette rules or UI depth.

### Minimal Roulette API Expectations

The current blackjack refactor does not need to create these APIs, but it should avoid choices that would block a later roulette facade exposing methods like:

- `createRoom`
- `joinRoom`
- `leaveRoom`
- `placeBet`
- `clearBets`
- `startRound`
- `tick`
- `getRoomState`
- `listRooms`

### Practical Hand-Off Goal

After the blackjack refactor, starting roulette should mostly mean:
- creating `utils/casino/roulette/` modules
- adding a roulette facade parallel to blackjack
- reusing the casino core for table, participant, round, phase, timer, and summary concerns

It should not require redesigning the shared architecture first.

## Frontend Target Architecture

The frontend should move from a monolithic page into feature-local modules under `src/features/blackjack/`, while keeping [`src/pages/Blackjack.jsx`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/src/pages/Blackjack.jsx) as the route entrypoint.

Proposed structure:

```text
src/
  pages/
    Blackjack.jsx

  features/
    blackjack/
      hooks/
        useBlackjackRoom.js
        useBlackjackTimers.js
      components/
        BlackjackPageShell.jsx
        BlackjackTable.jsx
        BlackjackDealer.jsx
        BlackjackSeat.jsx
        BlackjackControls.jsx
        BlackjackLobby.jsx
        BlackjackLeaderboard.jsx
        SettlementToast.jsx
        BlackjackCelebration.jsx
        PlayingCard.jsx
      utils/
        formatters.js
        layout.js
      blackjack.css
```

### Frontend Responsibilities

- `Blackjack.jsx`
  - route-level wiring only
  - auth guard and page composition

- `useBlackjackRoom.js`
  - socket subscription
  - room selection and fallback fetches
  - action dispatch helpers
  - derived flags needed across components

- `useBlackjackTimers.js`
  - turn countdown
  - auto-start countdown
  - settlement timing display

- components
  - split dealer, seats, controls, lobby, leaderboard, celebration, and settlement UI into focused units

- `blackjack.css`
  - move embedded styles out of the page component
  - define layout tiers and shared visual tokens

## Mobile Requirements

The current table-heavy layout should become an explicit desktop mode, not the only layout model.

On mobile:
- dealer zone stays near the top
- seat views become stacked or scrollable instead of relying on table spread geometry
- primary actions move into a sticky bottom control tray
- countdown and current-turn indicators remain visible while scrolling
- decorative layers scale down or collapse before they interfere with interaction

Use three layout tiers:
- mobile
- tablet
- desktop

The layout rules for each tier should be deliberate instead of stretching one absolute-positioned table layout across all widths.

## Migration Strategy

Refactor in behavior-preserving layers:

1. Extract shared factories, queries, and summary serialization into `utils/casino/core/`.
2. Extract blackjack lifecycle helpers while keeping the facade stable.
3. Extract blackjack betting, round flow, turn handling, dealer logic, settlement, and bot logic.
4. Reduce `tick()` to orchestration that delegates to focused helpers.
5. Split frontend helpers and leaf components first.
6. Move socket/data lifecycle into hooks.
7. Extract CSS and introduce explicit responsive layout tiers.

This order minimizes integration risk because public entrypoints remain stable throughout the migration.

## Testing Strategy

### Backend

Add focused regression coverage for:
- room creation and join/leave behavior
- seat movement constraints
- bet validation
- round start transitions
- hit/stand/double/split behavior
- turn progression across multiple hands
- dealer resolution
- settlement payouts
- `tick()`-driven transitions including auto-start, timeouts, and bot actions

If there is no mature test harness yet, the implementation plan should still add lightweight executable regression checks around extracted pure logic.

### Frontend

Verify:
- room loading and reconnection behavior
- action buttons still emit the same socket events
- settlement and countdown rendering still work
- mobile sticky controls remain usable
- desktop table layout retains its current feel

## Risks And Mitigations

- Risk: the shared core becomes too blackjack-shaped
  - Mitigation: keep seats and turn order optional and local to blackjack modules

- Risk: the shared core becomes too abstract to be useful
  - Mitigation: extract only concerns already visible as common table-game infrastructure

- Risk: circular imports appear during backend extraction
  - Mitigation: isolate factories, timers, and serialization in dedicated core modules and keep the facade as top-level orchestrator

- Risk: subtle gameplay regressions appear during turn/dealer/settlement extraction
  - Mitigation: add regression checks before and during each extraction phase

- Risk: frontend splitting changes behavior while moving JSX and styles
  - Mitigation: extract leaf components and hooks incrementally and preserve the route shell

## Success Criteria

The refactor is successful when:

- [`utils/blackjackRoomManager.js`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/utils/blackjackRoomManager.js) becomes a thin facade instead of the primary logic container
- the shared casino backend is phase-first rather than seat-first
- blackjack-specific rules remain local to blackjack modules
- the structure leaves a clean path for later `roulette/` and `poker/` modules
- [`src/pages/Blackjack.jsx`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/src/pages/Blackjack.jsx) becomes a route shell rather than a feature monolith
- mobile usability improves without changing the blackjack contract
- controller and socket integrations continue to work through stable public entrypoints
