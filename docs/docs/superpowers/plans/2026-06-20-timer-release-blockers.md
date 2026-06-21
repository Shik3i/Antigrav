# Timer Release Blockers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent cross-room timer snapshots from being rejected and contain timer-completion persistence failures without losing the Socket.IO acknowledgement.

**Architecture:** Keep revision ordering local to one room by checking snapshot IDs before comparing revisions. Keep timer state completion authoritative in memory while treating database persistence as best-effort: catch persistence failures inside the lifecycle service, report them through an injectable error callback, and allow the socket action to acknowledge the completed state.

**Tech Stack:** React selectors, Socket.IO, Node.js CommonJS, Vitest

---

### Task 1: Scope stale revision checks to one room

**Files:**
- Modify: `tests/timer/timerSelectors.test.js`
- Modify: `src/features/timer/timerSelectors.js:50-54`

- [ ] **Step 1: Write the failing cross-room regression test**

Add this assertion to the stale-revision test in `tests/timer/timerSelectors.test.js`:

```js
expect(isStaleTimerSnapshot(
  { id: 'room-a', state: { timerRevision: 20 } },
  { id: 'room-b', state: { timerRevision: 0 } }
)).toBe(false);
```

- [ ] **Step 2: Run the selector test and verify RED**

Run: `npm test -- tests/timer/timerSelectors.test.js`

Expected: FAIL because the current implementation returns `true` for the different-room snapshots.

- [ ] **Step 3: Implement the minimal room identity guard**

Change `isStaleTimerSnapshot` to:

```js
export function isStaleTimerSnapshot(current, incoming) {
  if (!current?.state || !incoming?.state) return false;
  if (current.id !== incoming.id) return false;
  const currentRevision = Number(current.state.timerRevision) || 0;
  const incomingRevision = Number(incoming.state.timerRevision) || 0;
  return incomingRevision < currentRevision;
}
```

- [ ] **Step 4: Run the selector test and verify GREEN**

Run: `npm test -- tests/timer/timerSelectors.test.js`

Expected: PASS with all selector tests green.

- [ ] **Step 5: Commit the room-switch fix**

```bash
git add shared-timer-app/src/features/timer/timerSelectors.js shared-timer-app/tests/timer/timerSelectors.test.js
git commit -m "fix: accept timer snapshots from a new room"
```

### Task 2: Contain timer persistence failures

**Files:**
- Modify: `tests/timer/timerLifecycleService.test.js`
- Modify: `tests/timer/timerSocketHandlers.test.js`
- Modify: `services/timerLifecycleService.js:3-96`

- [ ] **Step 1: Make persistence error reporting injectable in the test harness**

In `makeHarness`, add:

```js
const onPersistenceError = vi.fn();
const service = createTimerLifecycleService({
  io,
  roomManager,
  dbLayer,
  broadcastCoinUpdate,
  onPersistenceError
});
return {
  service,
  room,
  roomManager,
  dbLayer,
  io,
  emit,
  broadcastCoinUpdate,
  onPersistenceError
};
```

- [ ] **Step 2: Write the failing persistence regression test**

Add to `tests/timer/timerLifecycleService.test.js`:

```js
test('contains persistence failures after completing timer state', async () => {
  const h = makeHarness({ autoRestart: false });
  const error = new Error('database unavailable');
  h.dbLayer.getKoalaBaseline.mockRejectedValueOnce(error);

  await expect(h.service.handleCompletion(h.room, {
    roomId: 'room-a',
    sequence: 1,
    generation: 3,
    rewardableElapsedMs: 60_000
  })).resolves.toBe(true);

  expect(h.onPersistenceError).toHaveBeenCalledWith(error, {
    roomId: 'room-a',
    sequence: 1
  });
  expect(h.emit).toHaveBeenCalledWith(
    EVENTS.TIMER_COMPLETED,
    expect.objectContaining({ roomId: 'room-a', sequence: 1 })
  );
});
```

- [ ] **Step 3: Strengthen the existing socket acknowledgement test**

In the `END_EARLY` test in `tests/timer/timerSocketHandlers.test.js`, retain the acknowledgement mock and assert it receives success:

```js
const ack = vi.fn();
await h.socket.receive(
  EVENTS.TIMER_ACTION,
  { roomId: 'room-a', action: 'END_EARLY' },
  ack
);
expect(ack).toHaveBeenCalledWith(expect.objectContaining({ ok: true, changed: true }));
```

- [ ] **Step 4: Run lifecycle and socket tests and verify RED**

Run: `npm test -- tests/timer/timerLifecycleService.test.js tests/timer/timerSocketHandlers.test.js`

Expected: FAIL because `handleCompletion` currently rejects and the injected reporter is unsupported.

- [ ] **Step 5: Implement contained persistence error reporting**

Extend the service factory argument with:

```js
onPersistenceError = (error, context) => {
  console.error('Timer completion persistence failed:', context, error);
}
```

Replace the persistence section in `handleCompletion` with:

```js
try {
  const settings = await dbLayer.getKoalaBaseline();
  const coinsToAward = Math.floor(
    (completion.rewardableElapsedMs / 3_600_000) * settings.koala_points_per_hour
  );
  await Promise.all(Array.from(uniqueUsers.values()).map(user => (
    persistUserCompletion(room, user, completion, coinsToAward)
  )));
} catch (error) {
  onPersistenceError(error, { roomId: room.id, sequence: completion.sequence });
}

return true;
```

- [ ] **Step 6: Run lifecycle and socket tests and verify GREEN**

Run: `npm test -- tests/timer/timerLifecycleService.test.js tests/timer/timerSocketHandlers.test.js`

Expected: PASS with all lifecycle and socket tests green.

- [ ] **Step 7: Commit the persistence containment fix**

```bash
git add shared-timer-app/services/timerLifecycleService.js shared-timer-app/tests/timer/timerLifecycleService.test.js shared-timer-app/tests/timer/timerSocketHandlers.test.js
git commit -m "fix: contain timer completion persistence failures"
```

### Task 3: Full verification

**Files:**
- Verify only; no production file changes expected

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`

Expected: 49 test files pass with no failures and the test count increases by at least one.

- [ ] **Step 2: Remove only the synthetic rollback error produced by the database test**

Run the existing Node 24 cleanup query against `ErrorLogs`, restricted to message `addKoalaCoins failed: forced transaction failure` and context reason `force rollback`.

Expected: Only synthetic test entries are removed.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Vite exits with status `0`.

- [ ] **Step 4: Check repository hygiene**

Run: `git diff --check && git status --short`

Expected: No whitespace errors; only the user-provided production backup remains untracked.

