# Central Timer Refactor and Scrubbing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the central room timer's duplicated, race-prone logic with a deterministic server-authoritative timer domain and add administrator-only graphical remaining-time scrubbing to all seven timer visualizations.

**Architecture:** Keep `roomManager.js`, existing Socket.IO event names, REST behavior, and `Timer` props as compatibility boundaries. Move timer arithmetic into a pure domain module, isolate completion/scheduling and Socket.IO orchestration behind injectable services, and make the React client derive presentation from one synchronized hook plus pure selectors and geometry adapters.

**Tech Stack:** Node.js CommonJS, React 19, Socket.IO 4.8, Vitest 3, React Testing Library, jsdom, Vite 7.

---

## File Map

### Server

- Create `utils/timer/timerDomain.js`: pure timer state, validation, transitions, phase-duration calculation, and tick logic.
- Create `services/timerLifecycleService.js`: exactly-once completion effects and generation-aware delayed transitions.
- Create `sockets/timerSocketHandlers.js`: room-scoped authorization, timer action validation, acknowledgements, and broadcasts.
- Modify `roomManager.js`: initialize canonical timer fields and delegate timer methods to the domain.
- Modify `sockets/socketHandler.js`: register the extracted timer handlers and delegate the central timer tick/completion flow.
- Modify `controllers/roomController.js`: preserve the test REST endpoint while returning defined validation failures.

### Client

- Create `src/features/timer/timerSelectors.js`: exact remaining time, phase, phase duration, progress, formatting, and stale-revision checks.
- Create `src/features/timer/scrubberGeometry.js`: normalized pointer geometry for all seven visual modes.
- Create `src/features/timer/useSynchronizedTimer.js`: one requestAnimationFrame-driven presentation clock and stable completion listener.
- Create `src/features/timer/useTimerScrubber.js`: preview, pointer capture, keyboard control, one commit, and rollback.
- Create `src/features/timer/TimerVisuals.jsx`: the seven visual renderers wired to shared slider props.
- Modify `src/components/Timer.jsx`: compose the new hooks and visual component; retain controls and notification behavior.
- Modify `src/App.jsx`: use shared selectors for the document title and reject stale timer revisions.
- Delete `src/hooks/useTimer.js`: remove the unused duplicate implementation.
- Delete `src/utils/timerUtils.js`: replace its two consumers with shared selectors.

### Tests and configuration

- Create `tests/timer/timerDomain.test.js`.
- Create `tests/timer/roomManagerTimer.test.js`.
- Create `tests/timer/timerLifecycleService.test.js`.
- Create `tests/timer/timerSocketHandlers.test.js`.
- Create `tests/timer/timerSelectors.test.js`.
- Create `tests/timer/scrubberGeometry.test.js`.
- Create `tests/timer/useSynchronizedTimer.test.jsx`.
- Create `tests/timer/useTimerScrubber.test.jsx`.
- Create `tests/timer/Timer.test.jsx`.
- Modify `package.json` and `package-lock.json`: add React DOM test dependencies.

---

### Task 1: Establish the deterministic timer domain contract

**Files:**
- Create: `tests/timer/timerDomain.test.js`
- Create: `utils/timer/timerDomain.js`

- [ ] **Step 1: Write failing transition tests**

Cover creation, start, elapsed-time pause, reset, `SET_DURATION`, `SET_REMAINING`, invalid values, Pomodoro phase bounds, and exactly-once completion. Use fixed timestamps and assert complete results, including revision and generation increments:

```js
const {
  createTimerState,
  applyTimerAction,
  tickTimer,
  getPhaseDurationMs
} = require('../../utils/timer/timerDomain');

describe('timerDomain', () => {
  const config = { durationMs: 20 * 60_000, pomodoro: { pauseMinutes: 5 } };

  test('SET_DURATION validates and resets a running timer', () => {
    const running = applyTimerAction(
      { config, state: createTimerState(config.durationMs) },
      { type: 'START' },
      1_000
    ).value;

    const result = applyTimerAction(running, { type: 'SET_DURATION', payload: 30 }, 301_000);

    expect(result.ok).toBe(true);
    expect(result.value.config.durationMs).toBe(30 * 60_000);
    expect(result.value.state).toMatchObject({
      remainingMs: 30 * 60_000,
      elapsedActiveMs: 0,
      isRunning: false,
      lastTickTime: null
    });
  });

  test.each([NaN, Infinity, -1, 0, 0.5, 121, 'abc'])('rejects invalid duration %p', payload => {
    const initial = { config, state: createTimerState(config.durationMs) };
    const result = applyTimerAction(initial, { type: 'SET_DURATION', payload }, 1_000);
    expect(result).toMatchObject({ ok: false, error: 'INVALID_DURATION' });
    expect(initial.config.durationMs).toBe(20 * 60_000);
  });

  test('SET_REMAINING preserves running state and resets the time anchor', () => {
    const initial = applyTimerAction(
      { config, state: createTimerState(config.durationMs) },
      { type: 'START' },
      1_000
    ).value;
    const result = applyTimerAction(initial, { type: 'SET_REMAINING', payload: 600_000 }, 5_000);
    expect(result.value.state).toMatchObject({
      remainingMs: 600_000,
      isRunning: true,
      lastTickTime: 5_000
    });
  });

  test('emits one completion across repeated ticks', () => {
    const initial = applyTimerAction(
      { config: { ...config, durationMs: 1_000 }, state: createTimerState(1_000) },
      { type: 'START' },
      1_000
    ).value;
    const first = tickTimer(initial, 2_100);
    const second = tickTimer(first.value, 3_000);
    expect(first.completion).toMatchObject({ sequence: 1, elapsedActiveMs: 1_100 });
    expect(second.completion).toBeNull();
  });

  test('uses the explicit Pomodoro phase duration', () => {
    const state = { ...createTimerState(config.durationMs), isPomodoro: true, pomodoroPhase: 'break' };
    expect(getPhaseDurationMs(config, state)).toBe(5 * 60_000);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/timer/timerDomain.test.js`

Expected: FAIL because `utils/timer/timerDomain.js` does not exist.

- [ ] **Step 3: Implement the pure domain API**

Implement and export these constants and functions:

```js
const MIN_DURATION_MINUTES = 1;
const MAX_DURATION_MINUTES = 120;
const MIN_REMAINING_MS = 1_000;

function createTimerState(durationMs) {
  return {
    isRunning: false,
    remainingMs: durationMs,
    lastTickTime: null,
    hasStarted: false,
    isPomodoro: false,
    pomodoroPhase: 'work',
    pomodoroCycles: 0,
    autoRestart: true,
    elapsedActiveMs: 0,
    timerRevision: 0,
    transitionGeneration: 0,
    completionSequence: 0
  };
}

function getPhaseDurationMs(config, state) {
  if (state.isPomodoro && state.pomodoroPhase === 'break') {
    return Math.round((config.pomodoro?.pauseMinutes || 5) * 60_000);
  }
  return config.durationMs;
}
```

`applyTimerAction(snapshot, action, now)` must return `{ ok, value, completion, error }`, never mutate its input, and implement `START`, `PAUSE`, `RESET`, `SET_DURATION`, `SET_REMAINING`, `END_EARLY`, `SET_POMODORO`, `TOGGLE_AUTO_RESTART`, and `ADVANCE_POMODORO`. `tickTimer(snapshot, now)` must accrue `elapsedActiveMs`, clamp remaining time to zero, stop once, increment `completionSequence`, and return the completion descriptor only on the crossing tick. Rewardable elapsed time is `Math.min(elapsedActiveMs, getPhaseDurationMs(config, state))`.

- [ ] **Step 4: Run the domain test and verify GREEN**

Run: `npm test -- tests/timer/timerDomain.test.js`

Expected: PASS.

- [ ] **Step 5: Commit the timer domain**

```bash
git add utils/timer/timerDomain.js tests/timer/timerDomain.test.js
git commit -m "refactor: add deterministic timer domain"
```

---

### Task 2: Delegate room timer operations to the domain

**Files:**
- Create: `tests/timer/roomManagerTimer.test.js`
- Modify: `roomManager.js`

- [ ] **Step 1: Write failing room-manager compatibility tests**

Use `vi.spyOn(Date, 'now')` and clean `roomManager.rooms` after every test. Assert that existing methods keep their Boolean return convention, missing rooms return `false` instead of throwing, reads do not mutate timer state, and `tick(now)` returns completion descriptors:

```js
test('pauseTimer does not throw for an unknown room', () => {
  expect(roomManager.pauseTimer('missing')).toBe(false);
});

test('getRoomState is side-effect free', () => {
  roomManager.createRoom('read-only', 'Read only', 20);
  roomManager.startTimer('read-only', 1_000);
  const before = structuredClone(roomManager.getRoom('read-only').state);
  roomManager.getRoomState('read-only');
  expect(roomManager.getRoom('read-only').state).toEqual(before);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/timer/roomManagerTimer.test.js`

Expected: FAIL because reads currently update remaining time and missing-room methods can throw.

- [ ] **Step 3: Refactor the compatibility facade**

Import the domain functions. Initialize timer fields through `createTimerState(durationMs)` while preserving todos, canvas, event history, stats, and minigame fields. Add one private delegator:

```js
_applyTimerAction(roomId, action, now = Date.now()) {
  const room = this.getRoom(roomId);
  if (!room) return { ok: false, changed: false, error: 'ROOM_NOT_FOUND' };
  const result = applyTimerAction({ config: room.config, state: room.state }, action, now);
  if (!result.ok) return { ...result, changed: false };
  room.config = { ...room.config, ...result.value.config };
  room.state = { ...room.state, ...result.value.state };
  return { ...result, changed: true, room };
}
```

Keep `startTimer`, `pauseTimer`, `resetTimer`, and `setDuration` returning Booleans for existing callers. Add `setRemaining(roomId, remainingMs, now)` and `endEarly(roomId, now)` returning the full result for the extracted socket handler. Make `getRoomState` a pure serialization step. Change `tick(now = Date.now())` to use `tickTimer` and return `{ room, completion }` entries.

- [ ] **Step 4: Run focused server tests**

Run: `npm test -- tests/timer/timerDomain.test.js tests/timer/roomManagerTimer.test.js tests/deathrollStart.test.js`

Expected: PASS.

- [ ] **Step 5: Commit the facade refactor**

```bash
git add roomManager.js tests/timer/roomManagerTimer.test.js
git commit -m "refactor: delegate room timers to timer domain"
```

---

### Task 3: Add generation-safe completion orchestration

**Files:**
- Create: `tests/timer/timerLifecycleService.test.js`
- Create: `services/timerLifecycleService.js`

- [ ] **Step 1: Write failing fake-timer tests**

Create the service with injected `roomManager`, `io`, `dbLayer`, `broadcastCoinUpdate`, `setTimeoutFn`, and `clearTimeoutFn`. Test one completion side-effect sequence, duplicate completion suppression, stale auto-restart cancellation, stale Pomodoro cancellation, and disposal:

```js
vi.useFakeTimers();
const service = createTimerLifecycleService(dependencies);
await service.handleCompletion(room, {
  roomId: room.id,
  sequence: 1,
  generation: 3,
  rewardableElapsedMs: 60_000
});
await service.handleCompletion(room, {
  roomId: room.id,
  sequence: 1,
  generation: 3,
  rewardableElapsedMs: 60_000
});
expect(io.to(room.id).emit).toHaveBeenCalledWith(EVENTS.TIMER_COMPLETED, expect.any(Object));
expect(dbLayer.recordTimerCompletion).toHaveBeenCalledTimes(1);
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/timer/timerLifecycleService.test.js`

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement the lifecycle service**

The factory returns `handleCompletion(room, completion)`, `invalidate(roomId)`, and `dispose()`. Key in-flight and processed work by `${roomId}:${completion.sequence}`. Store one delayed callback per room. Before a callback runs, compare both `transitionGeneration` and `completionSequence` with the captured values. Emit completion and sync exactly once; record and reward unique user IDs exactly once. Use `completion.rewardableElapsedMs / 60_000` for persistence and rewards. `invalidate` clears the room's delayed callback.

- [ ] **Step 4: Run and verify GREEN**

Run: `npm test -- tests/timer/timerLifecycleService.test.js`

Expected: PASS with fake timers and no open handles.

- [ ] **Step 5: Commit the lifecycle service**

```bash
git add services/timerLifecycleService.js tests/timer/timerLifecycleService.test.js
git commit -m "refactor: isolate timer completion lifecycle"
```

---

### Task 4: Extract room-scoped timer Socket.IO handlers

**Files:**
- Create: `tests/timer/timerSocketHandlers.test.js`
- Create: `sockets/timerSocketHandlers.js`
- Modify: `socketEvents.json`

- [ ] **Step 1: Write failing handler tests with fake sockets**

Build small EventEmitter-based socket and room-broadcast fakes. Test correct-room writer success, cross-room writer rejection, invalid payload rejection without mutation, optional acknowledgement, `SET_REMAINING`, and exactly one `END_EARLY` lifecycle call.

```js
registerTimerSocketHandlers({ socket, io, roomManager, lifecycleService });
const ack = vi.fn();
await socket.receive(EVENTS.TIMER_ACTION, {
  roomId: 'room-a',
  action: 'SET_REMAINING',
  payload: 300_000
}, ack);
expect(roomManager.setRemaining).toHaveBeenCalledWith('room-a', 300_000, expect.any(Number));
expect(ack).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
expect(io.to('room-a').emit).toHaveBeenCalledWith(EVENTS.SYNC_STATE, expect.any(Object));
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/timer/timerSocketHandlers.test.js`

Expected: FAIL because the extracted handler does not exist.

- [ ] **Step 3: Implement the handler factory**

Use exact-room membership rather than `getUserBySocket`:

```js
function getRoomWriter(socket, roomManager, roomId) {
  const room = roomManager.getRoom(roomId);
  const member = room?.users.get(socket.id);
  if (!room || !member || member.role !== 'write') return null;
  return { room, member };
}
```

Register `EVENTS.TIMER_ACTION`, `EVENTS.SET_POMODORO`, and `EVENTS.TOGGLE_AUTO_RESTART`. Accept `(payload, ack)` without requiring an acknowledgement. On success, invalidate incompatible lifecycle work, emit one canonical `SYNC_STATE`, add one room event, and acknowledge `{ ok: true, state }`. On failure, emit the existing error event and acknowledge `{ ok: false, error }`.

- [ ] **Step 4: Run and verify GREEN**

Run: `npm test -- tests/timer/timerSocketHandlers.test.js`

Expected: PASS, including cross-room rejection.

- [ ] **Step 5: Commit the extracted handlers**

```bash
git add sockets/timerSocketHandlers.js socketEvents.json tests/timer/timerSocketHandlers.test.js
git commit -m "refactor: extract room timer socket handlers"
```

---

### Task 5: Integrate the lifecycle and handlers into the server

**Files:**
- Modify: `sockets/socketHandler.js`
- Modify: `controllers/roomController.js`
- Modify: `tests/timer/timerSocketHandlers.test.js`

- [ ] **Step 1: Add a failing integration assertion**

Assert that one registered socket has only one timer-action listener and one early-end request invokes one completion path. Also assert the REST test endpoint returns HTTP 400 for an invalid duration rather than serializing `NaN`.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/timer/timerSocketHandlers.test.js tests/timer/roomManagerTimer.test.js`

Expected: FAIL while the monolithic timer handlers remain registered.

- [ ] **Step 3: Replace the monolithic flow**

Inside `setupSocketHandlers(io)`, create one lifecycle service, call `registerTimerSocketHandlers` inside the connection callback, delete the old timer/Pomodoro/auto-restart handlers, and replace the central timer portion of the 1 Hz loop with:

```js
const completed = roomManager.tick(Date.now());
completed.forEach(({ room, completion }) => {
  timerLifecycleService.handleCompletion(room, completion).catch(error => {
    console.error('Timer completion failed:', error);
  });
});
roomManager.rooms.forEach((room, roomId) => {
  if (room.state.isRunning) {
    io.volatile.to(roomId).emit(EVENTS.SYNC_STATE, roomManager.getRoomState(roomId));
  }
});
```

Keep blackjack and roulette ticking unchanged. Map REST validation errors to HTTP 400 with `{ success: false, error }`.

- [ ] **Step 4: Run all server timer tests**

Run: `npm test -- tests/timer/timerDomain.test.js tests/timer/roomManagerTimer.test.js tests/timer/timerLifecycleService.test.js tests/timer/timerSocketHandlers.test.js`

Expected: PASS with no duplicate listener or completion assertions.

- [ ] **Step 5: Commit server integration**

```bash
git add sockets/socketHandler.js controllers/roomController.js tests/timer/timerSocketHandlers.test.js
git commit -m "fix: make room timer lifecycle authoritative"
```

---

### Task 6: Add client timer selectors and revision handling

**Files:**
- Create: `tests/timer/timerSelectors.test.js`
- Create: `src/features/timer/timerSelectors.js`
- Modify: `src/App.jsx`
- Delete: `src/utils/timerUtils.js`

- [ ] **Step 1: Write failing pure selector tests**

Test exact remaining time with offset, paused values, formatting, explicit Pomodoro phase, phase-specific progress, and stale revision detection:

```js
expect(getTimerPresentation({
  roomState: breakRoom,
  serverTimeOffset: 50,
  now: 10_000
})).toMatchObject({ phase: 'break', phaseDurationMs: 300_000, progress: 1 });

expect(isStaleTimerSnapshot({ state: { timerRevision: 4 } }, { state: { timerRevision: 3 } })).toBe(true);
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/timer/timerSelectors.test.js`

Expected: FAIL because the selector module does not exist.

- [ ] **Step 3: Implement selectors and update App**

Export `getExactRemainingMs`, `formatTimerTitle`, `getPhaseDurationMs`, `getTimerPresentation`, and `isStaleTimerSnapshot`. In `App.jsx`, import from the feature module. Apply incoming room snapshots with a functional state update that rejects only lower timer revisions while still accepting equal-revision user-list updates. Keep `lastRoomSyncAt` updated for every received snapshot.

- [ ] **Step 4: Run focused tests and build**

Run: `npm test -- tests/timer/timerSelectors.test.js && npm run build`

Expected: tests PASS and Vite build succeeds.

- [ ] **Step 5: Commit shared selectors**

```bash
git add src/features/timer/timerSelectors.js src/App.jsx tests/timer/timerSelectors.test.js
git rm src/utils/timerUtils.js
git commit -m "refactor: centralize client timer selectors"
```

---

### Task 7: Replace duplicate client synchronization with one hook

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `tests/timer/useSynchronizedTimer.test.jsx`
- Create: `src/features/timer/useSynchronizedTimer.js`
- Delete: `src/hooks/useTimer.js`

- [ ] **Step 1: Add the DOM test dependencies**

Run: `npm install --save-dev @testing-library/react jsdom`

Expected: `package.json` and lockfile contain both dev dependencies.

- [ ] **Step 2: Write failing hook tests**

Add `// @vitest-environment jsdom`. Use `renderHook` and `act` from `@testing-library/react`; fake `requestAnimationFrame`, notifications, and the socket. Verify recalibration, pause, stable named listener cleanup, one completion reaction, and cancellation on unmount.

```jsx
const { result, unmount } = renderHook(() => useSynchronizedTimer(props));
expect(result.current.remainingMs).toBe(600_000);
expect(socket.on).toHaveBeenCalledTimes(1);
unmount();
expect(socket.off).toHaveBeenCalledWith(EVENTS.TIMER_COMPLETED, expect.any(Function));
expect(cancelAnimationFrame).toHaveBeenCalled();
```

- [ ] **Step 3: Run and verify RED**

Run: `npm test -- tests/timer/useSynchronizedTimer.test.jsx`

Expected: FAIL because the hook does not exist.

- [ ] **Step 4: Implement the synchronized hook**

Use selectors for every recalibration. Keep notification and sound callbacks in refs or React Effect Events so the Socket.IO subscription depends only on `socket`. Track the confetti timeout and cancel it before replacement and on unmount. Do not create `AudioContext` or request notification permission from synchronization effects. Return `{ remainingMs, showConfetti, presentation }`.

- [ ] **Step 5: Run and verify GREEN**

Run: `npm test -- tests/timer/useSynchronizedTimer.test.jsx tests/timer/timerSelectors.test.js`

Expected: PASS.

- [ ] **Step 6: Remove the unused hook and commit**

```bash
git add package.json package-lock.json src/features/timer/useSynchronizedTimer.js tests/timer/useSynchronizedTimer.test.jsx
git rm src/hooks/useTimer.js
git commit -m "refactor: unify client timer synchronization"
```

---

### Task 8: Implement and test all scrubber geometries

**Files:**
- Create: `tests/timer/scrubberGeometry.test.js`
- Create: `src/features/timer/scrubberGeometry.js`

- [ ] **Step 1: Write failing table-driven geometry tests**

Test the cardinal points for circular modes, horizontal bounds for bar/battery/minimal, vertical bounds for hourglass, clamping outside bounds, and `progressToRemainingMs` quantization to whole seconds.

```js
test.each(['circle', 'dots', 'ring'])('%s starts at twelve o’clock', mode => {
  expect(pointerToProgress(mode, { x: 50, y: 0 }, rect)).toBeCloseTo(1);
  expect(pointerToProgress(mode, { x: 100, y: 50 }, rect)).toBeCloseTo(0.25);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/timer/scrubberGeometry.test.js`

Expected: FAIL because the geometry module does not exist.

- [ ] **Step 3: Implement geometry adapters**

Export `pointerToProgress(mode, point, rect)`, `progressToRemainingMs(progress, phaseDurationMs)`, and `applyKeyboardStep(key, currentMs, phaseDurationMs)`. Circular progress starts at twelve o'clock and increases clockwise. Hourglass maps the bottom to the one-second minimum and the top to the phase maximum. Use one-second arrow steps, 60-second Page Up/Page Down steps, Home for one second, and End for the phase maximum.

- [ ] **Step 4: Run and verify GREEN**

Run: `npm test -- tests/timer/scrubberGeometry.test.js`

Expected: PASS for every visual mode.

- [ ] **Step 5: Commit geometry helpers**

```bash
git add src/features/timer/scrubberGeometry.js tests/timer/scrubberGeometry.test.js
git commit -m "feat: add timer scrubber geometry adapters"
```

---

### Task 9: Build the shared scrubber hook

**Files:**
- Create: `tests/timer/useTimerScrubber.test.jsx`
- Create: `src/features/timer/useTimerScrubber.js`

- [ ] **Step 1: Write failing hook tests**

Use `renderHook` with jsdom. Test writer versus reader behavior, local preview during pointer movement, one emission on release, acknowledgement success, acknowledgement rejection rollback, disconnect rollback, keyboard commit, preserved running state, and cleanup of a pending acknowledgement timeout.

```jsx
act(() => result.current.onPointerMove(pointerEventAt(75, 50)));
expect(result.current.previewRemainingMs).toBe(phaseDurationMs / 4);
expect(socket.emit).not.toHaveBeenCalled();

act(() => result.current.onPointerUp(pointerEventAt(75, 50)));
expect(socket.emit).toHaveBeenCalledTimes(1);
expect(socket.emit).toHaveBeenCalledWith(
  EVENTS.TIMER_ACTION,
  { roomId, action: 'SET_REMAINING', payload: phaseDurationMs / 4 },
  expect.any(Function)
);
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/timer/useTimerScrubber.test.jsx`

Expected: FAIL because the scrubber hook does not exist.

- [ ] **Step 3: Implement the hook**

Return `displayRemainingMs`, `isScrubbing`, and `sliderProps`. `sliderProps` contains `role`, ARIA values, `tabIndex`, pointer handlers, and keyboard handler only for writers. Use `currentTarget.setPointerCapture(event.pointerId)` on pointer down. Keep preview local. On release, emit once with a 5-second acknowledgement timeout. Clear preview on success after the authoritative snapshot arrives, immediately on rejection/disconnect, and on unmount.

- [ ] **Step 4: Run and verify GREEN**

Run: `npm test -- tests/timer/useTimerScrubber.test.jsx tests/timer/scrubberGeometry.test.js`

Expected: PASS.

- [ ] **Step 5: Commit the hook**

```bash
git add src/features/timer/useTimerScrubber.js tests/timer/useTimerScrubber.test.jsx
git commit -m "feat: add accessible timer scrubbing hook"
```

---

### Task 10: Make all seven visual modes interactive

**Files:**
- Create: `tests/timer/Timer.test.jsx`
- Create: `src/features/timer/TimerVisuals.jsx`
- Modify: `src/components/Timer.jsx`

- [ ] **Step 1: Write failing component tests**

Mock `useAuth`, audio, notification, and the synchronized timer hook. Render each mode as writer and reader. Assert one slider per writer mode, no slider semantics for readers, mode-specific labels, `aria-valuemin="1"`, correct phase maximum, and a single `END_EARLY` emission after confirmation.

```jsx
test.each(['circle', 'bar', 'minimal', 'dots', 'battery', 'hourglass', 'ring'])(
  '%s exposes an admin slider',
  mode => {
    renderTimer({ mode, userRole: 'write' });
    expect(screen.getByRole('slider', { name: /remaining time/i })).toBeTruthy();
  }
);
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/timer/Timer.test.jsx`

Expected: FAIL because the visual module and slider wiring do not exist and `END_EARLY` currently emits twice.

- [ ] **Step 3: Extract visual rendering**

Move the seven visualization branches into `TimerVisuals.jsx`. The component receives `{ mode, remainingMs, phaseDurationMs, phaseText, isRunning, isZenMode, sliderProps }`. Apply slider props to the meaningful interaction surface for each mode: SVG wrapper for circle/ring/dots, fill track for bar/battery, time-display wrapper for minimal, and glass wrapper for hourglass. Add a visible grab cursor and focus ring only for writers.

- [ ] **Step 4: Compose hooks in Timer and fix completion controls**

`Timer.jsx` obtains authoritative presentation from `useSynchronizedTimer`, passes it through `useTimerScrubber`, and renders `TimerVisuals`. Keep one `handleAction` helper that supports optional payload and acknowledgement. Delete the duplicated exact-time function, animation loop, and completion listener. Remove the duplicate second `handleAction('END_EARLY')`. Request notification permission and resume audio only from Start/Resume or an explicit interaction.

- [ ] **Step 5: Run client timer tests and build**

Run: `npm test -- tests/timer/timerSelectors.test.js tests/timer/scrubberGeometry.test.js tests/timer/useSynchronizedTimer.test.jsx tests/timer/useTimerScrubber.test.jsx tests/timer/Timer.test.jsx && npm run build`

Expected: all focused tests PASS and Vite build succeeds.

- [ ] **Step 6: Commit the interactive visual refactor**

```bash
git add src/features/timer/TimerVisuals.jsx src/components/Timer.jsx tests/timer/Timer.test.jsx
git commit -m "feat: make all timer visuals adjustable"
```

---

### Task 11: Run cross-client and lifecycle browser verification

**Files:**
- Modify only if a failing browser scenario requires a focused, test-backed correction in the files already listed.

- [ ] **Step 1: Run the complete automated suite**

Run: `npm test`

Expected: all test files pass with no unhandled rejection or open-handle warning.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: Vite completes successfully.

- [ ] **Step 3: Start backend and frontend**

Run backend: `npm start`

Run frontend in a second terminal: `npm run dev -- --host 127.0.0.1`

Expected: backend listens on its configured port and Vite reports a local URL.

- [ ] **Step 4: Verify all visual modes as writer and reader**

For each of `circle`, `bar`, `minimal`, `dots`, `battery`, `hourglass`, and `ring`:

1. Open the same room in two browser contexts.
2. Join one as writer and one as reader.
3. Verify only the writer has pointer and keyboard slider interaction.
4. Click and drag to a known fraction and verify one server commit.
5. Verify the reader converges to the same displayed second.
6. Repeat while running and paused; confirm the state is preserved.

- [ ] **Step 5: Verify race and recovery scenarios**

Verify auto-restart followed by a manual restart during the three-second delay, Pomodoro phase completion followed by manual adjustment, reconnect after at least one dropped sync interval, two writers committing different values, invalid cross-room control, and early completion. Expected: stale delayed work is ignored, latest server revision wins, cross-room mutation fails, and exactly one completion/reward notification occurs.

- [ ] **Step 6: Inspect the final diff**

Run: `git diff --check && git status --short && git diff --stat`

Expected: no whitespace errors, only files listed in this plan are changed, and no unrelated formatting appears.

- [ ] **Step 7: Commit any final test-backed correction**

If Step 4 or 5 required a correction, stage only its focused files and commit with `fix: stabilize timer synchronization`. If no correction was required, do not create an empty commit.

---

## Final Acceptance Criteria

- Existing REST routes, Socket.IO event names, and `Timer` props remain compatible.
- Central timer arithmetic has one deterministic implementation.
- Invalid duration and remaining-time payloads never mutate state.
- `SET_DURATION` resets and stops the timer as documented.
- `SET_REMAINING` preserves running or paused state and cannot select zero.
- Every timer visualization supports writer-only click, drag, touch, and keyboard adjustment.
- Readers remain non-interactive.
- Pomodoro labels, progress, bounds, and transitions use explicit phase state.
- Stale callbacks and stale snapshots cannot overwrite newer actions.
- Completion, statistics, persistence, rewards, room events, and notifications occur exactly once.
- Reconnect and dropped volatile updates converge to the server state.
- Focused tests, full Vitest suite, production build, and browser scenarios pass.
