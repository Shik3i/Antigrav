# Central Timer Refactor and Scrubbing Design

## Scope

Refactor the central synchronized room timer across the server timer state, Socket.IO action and completion flow, React synchronization, and all timer visualizations. Preserve the existing public REST behavior, Socket.IO event names, and `Timer` component props while allowing internal modules and state structures to change.

The work also adds administrator-only graphical remaining-time adjustment to every existing timer visualization. It does not refactor unrelated countdowns, casino timers, game timers, or arbitrary `setTimeout` and `setInterval` usage elsewhere in the application.

## Goals

- Make the server the single authoritative source for timer state.
- Correct reproducible timer and synchronization defects rather than preserving them.
- Make timer transitions deterministic and testable with a controlled clock.
- Prevent stale auto-restart and Pomodoro callbacks from overwriting newer actions.
- Process each completion and its rewards exactly once.
- Remove duplicate client countdown and completion responsibilities.
- Keep clients synchronized after dropped volatile updates and reconnects.
- Let room writers set the remaining time by clicking, dragging, or using the keyboard in every timer visualization.
- Preserve the current running or paused state after a remaining-time adjustment.

## Confirmed Defects and Risks

The current implementation has no focused central timer tests. The full baseline suite passes 123 tests, but those tests do not exercise the central timer flow.

The following defects are confirmed by deterministic reproduction or direct control-flow inspection:

- `SET_DURATION` changes the configured duration while a timer is running without resetting the remaining time, despite the documented reset contract.
- Invalid duration payloads can store `NaN` in both `durationMs` and `remainingMs`.
- The `END_EARLY` button emits the same action twice from one confirmation.
- Auto-restart and Pomodoro transitions use untracked delayed callbacks that can overwrite a timer manually restarted during the delay.
- The client infers the Pomodoro phase from remaining-time arithmetic instead of using `pomodoroPhase`, producing incorrect labels and progress.
- `Timer.jsx`, `src/hooks/useTimer.js`, `src/utils/timerUtils.js`, and the document-title effect duplicate countdown calculations and completion responsibilities.
- The completion listener in `Timer.jsx` is recreated for each room-state object, while untracked UI timeouts can outlive their owning render lifecycle.
- Global socket-role lookup permits cross-room mutation unless the room-scoped authorization design is applied to timer actions.

## Chosen Architecture

Use a staged domain extraction behind stable facades.

A pure timer domain module owns validated transitions for start, pause, reset, duration change, remaining-time change, tick, completion, and Pomodoro phase change. It receives the current time explicitly rather than reading the wall clock internally. Each transition returns a complete next state and transition metadata without performing Socket.IO, database, reward, notification, or scheduling side effects.

`roomManager.js` remains the compatibility facade for existing callers and delegates timer operations to the domain module. Room membership and unrelated workspace state remain in `roomManager.js`; timer arithmetic and lifecycle rules do not.

A feature-specific Socket.IO timer handler owns room-scoped authorization, payload validation, action dispatch, acknowledgements, state broadcasts, and completion orchestration. Existing event names remain valid. The current monolithic socket handler delegates central timer events to this module.

On the client, one synchronized timer hook derives display time from the latest authoritative snapshot and server offset. Pure selectors derive formatted time, progress, active phase, and phase duration. `Timer.jsx` becomes primarily a visual and interaction component, while the document title uses the same shared calculation. The unused duplicate timer hook is replaced or removed.

## Server State and Transition Rules

The canonical timer state includes:

- `isRunning`
- `remainingMs`
- `lastTickTime`
- `hasStarted`
- `pomodoroPhase`
- a monotonic timer revision
- a transition generation used to invalidate delayed work
- a completion identifier used for exactly-once completion handling

All durations and remaining values are finite integer milliseconds. Room creation and duration changes enforce the supported one-to-120-minute duration range. Remaining-time adjustment enforces a minimum of 1,000 milliseconds and a maximum equal to the current phase duration.

`SET_DURATION` implements its documented behavior: it changes the configured work duration, resets the current timer to that duration, stops it, and invalidates pending delayed transitions. It does not preserve an unrelated partial countdown.

`SET_REMAINING` changes only `remainingMs`, increments the revision and transition generation, and preserves `isRunning`. When the timer is running, `lastTickTime` is reset to the authoritative action time so elapsed time is not counted twice. When paused, `lastTickTime` remains `null`.

Setting remaining time to zero is not permitted. Ending early remains an explicit action and rewards only elapsed active time. A manual remaining-time adjustment must never create a completion or full-duration reward by itself.

## Completion and Delayed Transitions

A timer completion is emitted by the domain transition exactly once for a timer generation. The completion orchestrator uses its completion identifier to ensure that statistics, persistence, rewards, notifications, room events, and follow-up scheduling are not duplicated.

Auto-restart and Pomodoro follow-ups capture the completion identifier and transition generation. Before executing, they verify that the room still exists and that its current generation still matches. Start, pause, reset, duration change, remaining-time change, mode change, and early termination invalidate incompatible pending work.

If an administrator manually restarts or adjusts a timer during the three-second completion delay, the old callback becomes a no-op. Pomodoro phase changes use the explicit `pomodoroPhase` state, and each phase uses its own duration for progress and scrubbing bounds.

## Socket Data Flow and Compatibility

For every timer mutation:

1. Resolve the exact target room.
2. Confirm that the calling socket is a writer in that room.
3. Validate the action and payload without mutation.
4. Apply one atomic timer-domain transition.
5. Broadcast the canonical room snapshot.
6. Return an acknowledgement containing success or a defined error.

The existing `timer_action`, `sync_state`, and `timer_completed` events remain available. `SET_REMAINING` is added as a new `timer_action` value with an integer-millisecond payload. Existing fire-and-forget callers remain compatible; the graphical scrubber uses the optional acknowledgement.

Rejected actions do not mutate state. Unknown rooms, missing room-scoped permission, unknown actions, non-finite payloads, and out-of-range values return defined errors through the acknowledgement and the existing error event where compatibility requires it.

Snapshots include the timer revision. Clients ignore snapshots older than the latest applied revision. Socket.IO processing remains last-writer-wins for concurrent administrators: the last valid action processed by the server becomes authoritative.

## Client Synchronization

The synchronized timer hook accepts the authoritative room snapshot and `serverTimeOffset`. While running, it derives the current display value from `remainingMs`, `lastTickTime`, and the corrected server time. `requestAnimationFrame` only refreshes presentation; it does not become a second source of timer truth.

Each newer server snapshot recalibrates the display. A dropped volatile one-second broadcast can cause only temporary display error; the next snapshot or non-volatile mutation broadcast corrects it. Reconnection rejoins the room and replaces local display state with the current authoritative snapshot.

Socket listeners use stable named handlers and exact cleanup. Completion UI timers are tracked and cancelled on replacement or unmount. Browser notification permission and audio activation are requested only from an appropriate user gesture, not repeatedly from synchronization effects.

## Graphical Remaining-Time Adjustment

Only users with the room role `write` can interact with timer graphics. Readers receive the same visuals without slider semantics or pointer handlers.

A shared scrubber hook owns:

- pointer capture and release;
- a local preview value;
- keyboard input;
- clamping and quantization;
- one Socket.IO commit when interaction finishes;
- acknowledgement timeout and rejection rollback.

The running or paused state is preserved. During pointer movement, only the local preview changes. The client sends one `SET_REMAINING` action when the pointer is released. If the server rejects or times out, the preview is discarded and the control returns to the latest authoritative value.

Each visualization maps its geometry to normalized remaining progress:

- `circle`, `dots`, and `ring`: pointer angle around the center, starting at twelve o'clock and increasing clockwise;
- `bar` and `battery`: horizontal position from empty on the left to full on the right;
- `hourglass`: vertical position mapped to the displayed remaining-sand direction;
- `minimal`: horizontal dragging over the time display.

All modes expose accessible slider semantics for writers, including the current value, minimum, maximum, and keyboard controls. Arrow keys adjust by a small fixed step, Page Up and Page Down use a larger step, and Home and End select the allowed minimum and current phase maximum. Pointer and keyboard changes share the same validation and commit path.

## Error and Concurrency Behavior

- Invalid input never mutates server state.
- A rejected scrub rolls back to the last authoritative snapshot.
- Disconnect during scrubbing discards the uncommitted preview.
- A role change during scrubbing is enforced by the server at commit time.
- Concurrent administrator actions use server processing order and monotonic revisions.
- A manual action invalidates incompatible delayed callbacks.
- A completion identifier prevents duplicate rewards and notifications.
- Early completion uses measured elapsed active time and cannot be triggered by scrubbing to zero.

## Test Strategy

Development follows red-green-refactor. Every confirmed defect receives a failing regression test before its fix.

### Timer Domain Tests

- start, pause, resume, reset, and tick with a controlled clock;
- duration change while running and paused;
- invalid, non-finite, negative, and out-of-range inputs;
- remaining-time changes while running and paused;
- minimum and maximum scrub bounds;
- exactly-once completion across repeated ticks;
- explicit Pomodoro phase duration, label inputs, and progress;
- invalidation of stale auto-restart and Pomodoro transitions.

### Socket Integration Tests

- writer mutation in the correct room;
- rejection of a writer attempting to mutate another room;
- canonical broadcast and acknowledgement for `SET_REMAINING`;
- unchanged state after rejected actions;
- reconnect followed by authoritative resynchronization;
- last-writer-wins behavior with monotonic revisions;
- one completion event, room event, statistics update, persistence call, and reward operation;
- one `END_EARLY` action per user confirmation.

### Client and Geometry Tests

- exact remaining-time derivation with server offset;
- stale snapshot rejection;
- phase selector and phase-specific progress;
- angle mapping for circle, dots, and ring;
- horizontal mapping for bar, battery, and minimal;
- vertical mapping for hourglass;
- pointer preview without intermediate socket emissions;
- one commit on pointer release;
- running and paused state preservation;
- keyboard steps and accessible slider attributes;
- rollback after acknowledgement failure or disconnect;
- listener and animation-frame cleanup.

### Verification

- Run focused tests after each transition or integration change.
- Run the complete Vitest suite.
- Run the production Vite build.
- Perform browser checks for all seven visual modes as a writer and reader.
- Verify pointer, touch, and keyboard adjustment.
- Verify running and paused scrubbing with two connected clients.
- Verify reconnect, rejected cross-room control, early completion, auto-restart, and Pomodoro transitions.

## Rollout

Land the work in small compatibility-preserving stages: pure domain tests and extraction, `roomManager` delegation, Socket.IO timer handler and completion orchestration, shared client synchronization, then graphical scrubbing. Each stage must leave the application testable and preserve the established external contracts.

No database migration is required. New timer revision, generation, and completion identifiers are in-memory state and disappear on the same server restart boundary as current room timers.
