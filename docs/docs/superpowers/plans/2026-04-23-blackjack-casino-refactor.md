# Blackjack Casino Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor blackjack into a thin facade plus a phase-first casino core, while preserving behavior and leaving clean starting points for later roulette work.

**Architecture:** Keep [`utils/blackjackRoomManager.js`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/utils/blackjackRoomManager.js) and [`src/pages/Blackjack.jsx`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/src/pages/Blackjack.jsx) as stable entrypoints. Move shared table/participant/phase concerns into `utils/casino/core/`, move blackjack rules into `utils/casino/blackjack/`, and shape the core around rounds and phases instead of seats and turns so roulette can later plug into the same base without exceptions.

**Tech Stack:** Node.js, CommonJS, Express, Socket.IO, React 19, Vite, CSS

---

## File Structure

**Shared casino core**
- Create: `utils/casino/core/stateFactories.js`
- Create: `utils/casino/core/tableRegistry.js`
- Create: `utils/casino/core/participants.js`
- Create: `utils/casino/core/roundLifecycle.js`
- Create: `utils/casino/core/phaseTimers.js`
- Create: `utils/casino/core/serialization.js`

**Blackjack backend modules**
- Modify: [`utils/blackjackRoomManager.js`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/utils/blackjackRoomManager.js)
- Create: `utils/casino/blackjack/tableLifecycle.js`
- Create: `utils/casino/blackjack/bets.js`
- Create: `utils/casino/blackjack/roundFlow.js`
- Create: `utils/casino/blackjack/turns.js`
- Create: `utils/casino/blackjack/dealer.js`
- Create: `utils/casino/blackjack/settlement.js`
- Create: `utils/casino/blackjack/botStrategy.js`
- Create: `utils/casino/blackjack/serialization.js`

**Frontend modules**
- Modify: [`src/pages/Blackjack.jsx`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/src/pages/Blackjack.jsx)
- Create: `src/features/blackjack/hooks/useBlackjackRoom.js`
- Create: `src/features/blackjack/hooks/useBlackjackTimers.js`
- Create: `src/features/blackjack/components/BlackjackPageShell.jsx`
- Create: `src/features/blackjack/components/BlackjackTable.jsx`
- Create: `src/features/blackjack/components/BlackjackDealer.jsx`
- Create: `src/features/blackjack/components/BlackjackSeat.jsx`
- Create: `src/features/blackjack/components/BlackjackControls.jsx`
- Create: `src/features/blackjack/components/BlackjackLobby.jsx`
- Create: `src/features/blackjack/components/BlackjackLeaderboard.jsx`
- Create: `src/features/blackjack/components/SettlementToast.jsx`
- Create: `src/features/blackjack/components/BlackjackCelebration.jsx`
- Create: `src/features/blackjack/components/PlayingCard.jsx`
- Create: `src/features/blackjack/utils/formatters.js`
- Create: `src/features/blackjack/utils/layout.js`
- Create: `src/features/blackjack/blackjack.css`

**Verification**
- Create: `tests/blackjackRoomManager.test.js`
- Create: `tests/blackjackRoundFlow.test.js`
- Create: `tests/blackjackSettlement.test.js`

### Task 1: Extract Phase-First Shared Core Foundations

**Files:**
- Create: `tests/blackjackRoomManager.test.js`
- Create: `utils/casino/core/stateFactories.js`
- Create: `utils/casino/core/tableRegistry.js`
- Create: `utils/casino/core/participants.js`
- Create: `utils/casino/core/serialization.js`
- Modify: [`utils/blackjackRoomManager.js`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/utils/blackjackRoomManager.js)

- [ ] **Step 1: Write the failing regression script**

```js
const assert = require('assert');
const blackjackRoomManager = require('../utils/blackjackRoomManager');

const ROOM_ID = 'plan-blackjack-core';
const USER_ID = 'plan-user-core';

const existingRoom = blackjackRoomManager.getRoom(ROOM_ID);
if (existingRoom) {
  blackjackRoomManager.leaveRoom(ROOM_ID, USER_ID);
}

blackjackRoomManager.createRoom(ROOM_ID, 5);
blackjackRoomManager.joinRoom(ROOM_ID, {
  userId: USER_ID,
  username: 'planuser',
  displayName: 'Plan User'
});

const summary = blackjackRoomManager.listRooms().find((room) => room.roomId === ROOM_ID);
assert(summary, 'room should appear in listRooms');
assert.strictEqual(summary.status, 'betting');
assert.strictEqual(summary.occupiedSeats.length, 1);

const room = blackjackRoomManager.getRoom(ROOM_ID);
assert(room, 'room should exist');
assert.strictEqual(room.phase, 'betting');
assert.strictEqual(room.players[0].seat, 1);

blackjackRoomManager.leaveRoom(ROOM_ID, USER_ID);
```

- [ ] **Step 2: Run the script to verify it fails**

Run: `node tests/blackjackRoomManager.test.js`  
Expected: fail because `tests/blackjackRoomManager.test.js` does not exist yet, and after adding it, fail because `room.phase` is not yet defined on blackjack rooms

- [ ] **Step 3: Create shared state factories with roulette-ready base fields**

```js
function createBaseTableState({ roomId, game, maxPlayers }) {
  return {
    roomId,
    game,
    status: 'waiting',
    phase: 'waiting',
    maxPlayers,
    roundId: 1,
    participants: []
  };
}

function createParticipantState(user, overrides = {}) {
  return {
    userId: String(user.userId || user.id),
    username: user.username || user.displayName || 'Guest',
    displayName: user.displayName || user.username || 'Guest',
    isBot: Boolean(user.isBot),
    connected: true,
    seat: null,
    preferences: user.preferences || {},
    ...overrides
  };
}

module.exports = {
  createBaseTableState,
  createParticipantState
};
```

- [ ] **Step 4: Create a registry helper that keeps room lookup and id normalization out of the facade**

```js
function normalizeRoomId(roomId) {
  return String(roomId || '').trim();
}

function getRoom(rooms, roomId) {
  const safeRoomId = normalizeRoomId(roomId);
  if (!safeRoomId) return null;
  return rooms.get(safeRoomId) || null;
}

function setRoom(rooms, room) {
  rooms.set(room.roomId, room);
  return room;
}

module.exports = {
  normalizeRoomId,
  getRoom,
  setRoom
};
```

- [ ] **Step 5: Create participant helpers with optional seat handling**

```js
function getOrderedPlayers(room) {
  return [...room.players].sort((a, b) => a.seat - b.seat);
}

function getPlayerByUserId(room, userId) {
  return room.players.find((player) => String(player.userId) === String(userId)) || null;
}

function getNextFreeSeat(room) {
  const taken = new Set(room.players.map((player) => player.seat));
  for (let seat = 1; seat <= room.maxPlayers; seat += 1) {
    if (!taken.has(seat)) return seat;
  }
  return null;
}

module.exports = {
  getOrderedPlayers,
  getPlayerByUserId,
  getNextFreeSeat
};
```

- [ ] **Step 6: Create shared lobby serialization that does not depend on blackjack-only logic**

```js
function serializeTableSummary(room, orderedPlayers) {
  return {
    roomId: room.roomId,
    game: room.game,
    maxPlayers: room.maxPlayers,
    status: room.status,
    phase: room.phase || room.status,
    playerCount: room.players.length,
    connectedCount: room.players.filter((player) => player.connected).length,
    occupiedSeats: orderedPlayers.map((player) => ({
      userId: player.userId,
      username: player.username,
      displayName: player.displayName || player.username,
      isBot: Boolean(player.isBot),
      seat: player.seat,
      connected: player.connected
    }))
  };
}

module.exports = {
  serializeTableSummary
};
```

- [ ] **Step 7: Rewire `blackjackRoomManager.js` to use the new helpers and set `phase` alongside `status`**

```js
const { createBaseTableState, createParticipantState } = require('./casino/core/stateFactories');
const { normalizeRoomId, getRoom: getRegisteredRoom, setRoom } = require('./casino/core/tableRegistry');
const { getOrderedPlayers, getPlayerByUserId, getNextFreeSeat } = require('./casino/core/participants');
const { serializeTableSummary } = require('./casino/core/serialization');
```

```js
const tableState = createBaseTableState({
  roomId: safeRoomId,
  game: 'blackjack',
  maxPlayers: safeMaxPlayers
});

setRoom(rooms, {
  ...tableState,
  players: [],
  dealerHand: [],
  currentPlayerTurn: null,
  turnDeadlineAt: null,
  autoStartAt: null,
  autoStartQueuedByUserId: null,
  settlementCompleteAt: null,
  dealerPhase: null,
  dealerActionAt: null,
  botActionAt: null,
  lastSettlement: [],
  lastSettlementRoundId: null,
  lastAppliedSettlementRoundId: null,
  ...shoeState
});
```

```js
room.status = room.players.length > 0 ? 'betting' : 'waiting';
room.phase = room.status;
```

- [ ] **Step 8: Add the regression script file**

```js
const assert = require('assert');
const blackjackRoomManager = require('../utils/blackjackRoomManager');

const ROOM_ID = 'plan-blackjack-core';
const USER_ID = 'plan-user-core';

try {
  if (!blackjackRoomManager.getRoom(ROOM_ID)) {
    blackjackRoomManager.createRoom(ROOM_ID, 5);
  }

  blackjackRoomManager.joinRoom(ROOM_ID, {
    userId: USER_ID,
    username: 'planuser',
    displayName: 'Plan User'
  });

  const summary = blackjackRoomManager.listRooms().find((room) => room.roomId === ROOM_ID);
  assert(summary);
  assert.strictEqual(summary.phase, 'betting');

  const room = blackjackRoomManager.getRoom(ROOM_ID);
  assert(room);
  assert.strictEqual(room.phase, 'betting');
  assert.strictEqual(room.players[0].seat, 1);
} finally {
  blackjackRoomManager.leaveRoom(ROOM_ID, USER_ID);
}

console.log('blackjackRoomManager core regression passed');
```

- [ ] **Step 9: Run the regression script to verify it passes**

Run: `node tests/blackjackRoomManager.test.js`  
Expected: prints `blackjackRoomManager core regression passed`

- [ ] **Step 10: Commit**

```bash
git add tests/blackjackRoomManager.test.js utils/casino/core/stateFactories.js utils/casino/core/tableRegistry.js utils/casino/core/participants.js utils/casino/core/serialization.js utils/blackjackRoomManager.js
git commit -m "refactor: extract shared casino core primitives"
```

### Task 2: Extract Blackjack Table Lifecycle

**Files:**
- Create: `utils/casino/blackjack/tableLifecycle.js`
- Modify: [`utils/blackjackRoomManager.js`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/utils/blackjackRoomManager.js)
- Modify: `tests/blackjackRoomManager.test.js`

- [ ] **Step 1: Extend the regression script with reconnect, seat move, and bot coverage**

```js
blackjackRoomManager.moveSeat(ROOM_ID, {
  userId: USER_ID,
  username: 'planuser',
  displayName: 'Plan User'
}, 3);

let room = blackjackRoomManager.getRoom(ROOM_ID);
assert.strictEqual(room.players[0].seat, 3);

blackjackRoomManager.addBot(ROOM_ID);
room = blackjackRoomManager.getRoom(ROOM_ID);
assert.strictEqual(room.players.length, 2);
assert.strictEqual(room.status, 'betting');
assert.strictEqual(room.phase, 'betting');
```

- [ ] **Step 2: Run the regression script to verify the new assertions fail first**

Run: `node tests/blackjackRoomManager.test.js`  
Expected: fail until lifecycle logic is moved and the script is updated cleanly

- [ ] **Step 3: Create `tableLifecycle.js` and move room/join/leave/seat/bot behavior into it**

```js
function joinRoom(room, user, helpers) {
  const existing = helpers.getPlayerByUserId(room, user.userId);
  if (existing) {
    existing.connected = true;
    existing.username = user.username || user.displayName || existing.username;
    existing.displayName = user.displayName || user.username || existing.displayName || existing.username;
    existing.preferences = user.preferences || existing.preferences || {};
    return room;
  }

  const seat = helpers.getNextFreeSeat(room);
  room.players.push(helpers.createPlayerState(user, seat));
  room.players = helpers.getOrderedPlayers(room);
  room.status = 'betting';
  room.phase = 'betting';
  return room;
}

module.exports = {
  joinRoom
};
```

- [ ] **Step 4: Reduce the facade to validation plus delegation**

```js
function joinRoom(roomId, user) {
  if (!user?.userId) {
    throw new Error('Authenticated user is required.');
  }

  const room = getRoom(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  return lifecycle.joinRoom(room, user, lifecycleHelpers);
}
```

- [ ] **Step 5: Run the regression script to verify it passes**

Run: `node tests/blackjackRoomManager.test.js`  
Expected: prints `blackjackRoomManager core regression passed`

- [ ] **Step 6: Commit**

```bash
git add tests/blackjackRoomManager.test.js utils/casino/blackjack/tableLifecycle.js utils/blackjackRoomManager.js
git commit -m "refactor: extract blackjack table lifecycle"
```

### Task 3: Extract Phase and Round Transition Helpers

**Files:**
- Create: `tests/blackjackRoundFlow.test.js`
- Create: `utils/casino/core/roundLifecycle.js`
- Create: `utils/casino/core/phaseTimers.js`
- Create: `utils/casino/blackjack/bets.js`
- Create: `utils/casino/blackjack/roundFlow.js`
- Modify: [`utils/blackjackRoomManager.js`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/utils/blackjackRoomManager.js)

- [ ] **Step 1: Write the failing round-flow regression**

```js
const assert = require('assert');
const blackjackRoomManager = require('../utils/blackjackRoomManager');

const ROOM_ID = 'plan-blackjack-round-flow';
const USER_ID = 'plan-user-round';

blackjackRoomManager.createRoom(ROOM_ID, 3);
blackjackRoomManager.joinRoom(ROOM_ID, {
  userId: USER_ID,
  username: 'rounduser',
  displayName: 'Round User'
});

blackjackRoomManager.placeBet(ROOM_ID, USER_ID, 10000, 100000);
let room = blackjackRoomManager.getRoom(ROOM_ID);
assert.strictEqual(room.phase, 'betting');

blackjackRoomManager.startRound(ROOM_ID, USER_ID);
room = blackjackRoomManager.getRoom(ROOM_ID);
assert.strictEqual(room.phase, 'player_turns');
assert(room.currentPlayerTurn, 'a player turn should be active');
```

- [ ] **Step 2: Run the regression to verify it fails first**

Run: `node tests/blackjackRoundFlow.test.js`  
Expected: fail before the phase helpers and round-flow delegation are in place

- [ ] **Step 3: Add shared phase helpers that later roulette can reuse**

```js
function setPhase(room, phase, fields = {}) {
  room.phase = phase;
  room.status = phase;
  Object.assign(room, fields);
  return room;
}

function advanceRound(room) {
  room.roundId += 1;
  return room.roundId;
}

module.exports = {
  setPhase,
  advanceRound
};
```

- [ ] **Step 4: Add timing helpers based on generic deadlines instead of blackjack-only naming**

```js
function setPhaseDeadline(room, fieldName, now, delayMs) {
  room[fieldName] = now + delayMs;
  return room[fieldName];
}

function clearPhaseDeadline(room, fieldName) {
  room[fieldName] = null;
}

module.exports = {
  setPhaseDeadline,
  clearPhaseDeadline
};
```

- [ ] **Step 5: Move bet placement and round start into blackjack modules**

```js
function placeBet(room, player, amount, userBalance, helpers) {
  helpers.validateBetAmount(amount);
  if (!player.isBot && (!Number.isFinite(userBalance) || userBalance < amount)) {
    throw new Error('Not enough KoalaCoins for that bet.');
  }
  player.currentBet = amount;
  helpers.setPhase(room, 'betting');
  return room;
}
```

```js
function startRound(room, startedByUserId, helpers) {
  helpers.setPhase(room, 'dealing');
  helpers.preparePlayerHands(room);
  helpers.dealOpeningCards(room);
  helpers.setPhase(room, 'player_turns');
  helpers.selectFirstPlayerTurn(room, startedByUserId);
  return room;
}
```

- [ ] **Step 6: Run the round-flow regression to verify it passes**

Run: `node tests/blackjackRoundFlow.test.js`  
Expected: round creation, bet placement, and round start succeed with `phase === 'player_turns'`

- [ ] **Step 7: Commit**

```bash
git add tests/blackjackRoundFlow.test.js utils/casino/core/roundLifecycle.js utils/casino/core/phaseTimers.js utils/casino/blackjack/bets.js utils/casino/blackjack/roundFlow.js utils/blackjackRoomManager.js
git commit -m "refactor: extract phase and round flow helpers"
```

### Task 4: Extract Player Turn, Dealer, Settlement, and Tick Orchestration

**Files:**
- Create: `tests/blackjackSettlement.test.js`
- Create: `utils/casino/blackjack/turns.js`
- Create: `utils/casino/blackjack/dealer.js`
- Create: `utils/casino/blackjack/settlement.js`
- Create: `utils/casino/blackjack/botStrategy.js`
- Modify: [`utils/blackjackRoomManager.js`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/utils/blackjackRoomManager.js)

- [ ] **Step 1: Write the failing settlement regression**

```js
const assert = require('assert');
const blackjackRoomManager = require('../utils/blackjackRoomManager');

const ROOM_ID = 'plan-blackjack-settlement';
const USER_ID = 'plan-user-settlement';

blackjackRoomManager.createRoom(ROOM_ID, 3);
blackjackRoomManager.joinRoom(ROOM_ID, {
  userId: USER_ID,
  username: 'settler',
  displayName: 'Settler'
});
blackjackRoomManager.placeBet(ROOM_ID, USER_ID, 10000, 100000);
blackjackRoomManager.startRound(ROOM_ID, USER_ID);

let guard = 0;
while (blackjackRoomManager.getRoom(ROOM_ID)?.status === 'player_turns' && guard < 10) {
  blackjackRoomManager.stand(ROOM_ID, USER_ID);
  guard += 1;
}

while (blackjackRoomManager.getRoom(ROOM_ID)?.status !== 'betting' && guard < 30) {
  blackjackRoomManager.tick(Date.now() + guard * 5000);
  guard += 1;
}

const room = blackjackRoomManager.getRoom(ROOM_ID);
assert(room, 'room should still exist');
assert.strictEqual(room.phase, 'betting');
assert(Array.isArray(room.lastSettlement), 'settlement should be recorded');
```

- [ ] **Step 2: Run the settlement regression to verify it fails first**

Run: `node tests/blackjackSettlement.test.js`  
Expected: fail before dealer/settlement/tick extraction is complete

- [ ] **Step 3: Move player action logic into `turns.js`**

```js
function stand(room, userId, helpers) {
  const player = helpers.getPlayerByUserId(room, userId);
  const activeHand = player?.hands?.[player.activeHandIndex];
  activeHand.stood = true;
  helpers.syncPlayerState(player);
  helpers.advanceTurn(room);
  return room;
}
```

- [ ] **Step 4: Move dealer and settlement resolution into dedicated modules**

```js
function resolveDealerTurn(room, helpers) {
  while (helpers.getDealerValue(room) < 17) {
    helpers.drawDealerCard(room);
  }
  helpers.setPhase(room, 'settlement');
  return room;
}
```

```js
function settleRound(room, helpers) {
  room.lastSettlement = helpers.buildSettlementEntries(room);
  helpers.resetRoundState(room);
  helpers.setPhase(room, 'betting');
  return room;
}
```

- [ ] **Step 5: Keep `tick()` as orchestration only**

```js
function tick(now = Date.now()) {
  const changedRoomIds = [];

  rooms.forEach((room, roomId) => {
    const changed = tickHelpers.processRoom(room, roomId, now);
    if (changed) changedRoomIds.push(roomId);
  });

  return changedRoomIds;
}
```

- [ ] **Step 6: Run all backend regression scripts**

Run: `node tests/blackjackRoomManager.test.js && node tests/blackjackRoundFlow.test.js && node tests/blackjackSettlement.test.js`  
Expected: all three scripts exit with code `0`

- [ ] **Step 7: Commit**

```bash
git add tests/blackjackRoomManager.test.js tests/blackjackRoundFlow.test.js tests/blackjackSettlement.test.js utils/casino/blackjack/turns.js utils/casino/blackjack/dealer.js utils/casino/blackjack/settlement.js utils/casino/blackjack/botStrategy.js utils/blackjackRoomManager.js
git commit -m "refactor: extract blackjack gameplay engines"
```

### Task 5: Split the Frontend Feature and Mobile Layout

**Files:**
- Modify: [`src/pages/Blackjack.jsx`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/src/pages/Blackjack.jsx)
- Create: all `src/features/blackjack/**` files listed in File Structure

- [ ] **Step 1: Write a minimal manual verification checklist before moving JSX**

```txt
1. Join table
2. Place bet
3. Start round
4. Perform hit/stand
5. Verify countdown stays visible on mobile-width viewport
```

- [ ] **Step 2: Extract formatting and layout helpers first**

```js
export function formatKC(cents) {
  return `${(cents / 100).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} KC`;
}
```

- [ ] **Step 3: Extract hooks for room state and timers**

```js
export function useBlackjackTimers(roomState) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return {
    turnCountdownSeconds: roomState?.turnDeadlineAt ? Math.max(0, Math.ceil((roomState.turnDeadlineAt - now) / 1000)) : null,
    autoStartSeconds: roomState?.autoStartAt ? Math.max(0, Math.ceil((roomState.autoStartAt - now) / 1000)) : null
  };
}
```

- [ ] **Step 4: Extract leaf UI components and move CSS into `blackjack.css`**

```jsx
export default function SettlementToast({ settlements }) {
  if (!settlements?.length) return null;
  return <div className="blackjack-settlement-toast">...</div>;
}
```

- [ ] **Step 5: Reduce `Blackjack.jsx` to a route shell**

```jsx
export default function BlackjackPage() {
  return <BlackjackPageShell />;
}
```

- [ ] **Step 6: Run frontend verification**

Run: `npm run build`  
Expected: Vite build exits with code `0`

- [ ] **Step 7: Commit**

```bash
git add src/pages/Blackjack.jsx src/features/blackjack
git commit -m "refactor: split blackjack frontend feature modules"
```

### Task 6: Define Roulette Starting Points Without Implementing Roulette

**Files:**
- Modify: `utils/casino/core/stateFactories.js`
- Modify: `utils/casino/core/roundLifecycle.js`
- Modify: `utils/casino/core/serialization.js`
- Create: `docs/superpowers/specs/roulette-starting-points.md`

- [ ] **Step 1: Add explicit comments and neutral field names where the core still leans blackjack**

```js
// Phase-first core: can support both sequential turns (blackjack/poker)
// and simultaneous betting windows (roulette).
function createBaseTableState({ roomId, game, maxPlayers }) {
  return {
    roomId,
    game,
    status: 'waiting',
    phase: 'waiting',
    maxPlayers,
    roundId: 1,
    participants: []
  };
}
```

- [ ] **Step 2: Write the roulette starting-points note**

```md
# Roulette Starting Points

- Reuse `tableRegistry.js` for roulette room management.
- Reuse `roundLifecycle.js` for `betting_open`, `betting_closed`, `spin`, `settlement`.
- Keep roulette bets as per-player arrays keyed by round id.
- Do not introduce seats or `currentPlayerTurn` in roulette room state.
- Add a `utils/casino/roulette/` tree when roulette implementation starts.
```

- [ ] **Step 3: Verify the backend scripts still pass**

Run: `node tests/blackjackRoomManager.test.js && node tests/blackjackRoundFlow.test.js && node tests/blackjackSettlement.test.js`  
Expected: all scripts exit with code `0`

- [ ] **Step 4: Commit**

```bash
git add utils/casino/core/stateFactories.js utils/casino/core/roundLifecycle.js utils/casino/core/serialization.js docs/superpowers/specs/roulette-starting-points.md
git commit -m "docs: define roulette starting points for casino core"
```
