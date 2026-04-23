# Blackjack Casino Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the blackjack backend and frontend into focused modules, improve mobile usability, and establish a reusable casino game backend pattern for future roulette and poker work.

**Architecture:** Keep [`utils/blackjackRoomManager.js`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/utils/blackjackRoomManager.js) and [`src/pages/Blackjack.jsx`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/src/pages/Blackjack.jsx) as stable entrypoints while moving logic into `utils/casino/` and `src/features/blackjack/`. Backend changes should extract reusable table/room primitives plus blackjack-specific engines; frontend changes should split data flow, presentation, and styles so mobile and desktop layouts can diverge cleanly.

**Tech Stack:** Node.js, Express, Socket.IO, React 19, Vite, CommonJS backend modules, CSS, existing REST/socket contracts

---

## File Structure

**Backend facade and integration**
- Modify: [`utils/blackjackRoomManager.js`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/utils/blackjackRoomManager.js)
- Modify: [`controllers/blackjackController.js`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/controllers/blackjackController.js)
- Modify: [`sockets/socketHandler.js`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/sockets/socketHandler.js)

**Backend shared casino modules**
- Create: `utils/casino/roomState.js`
- Create: `utils/casino/roomQueries.js`
- Create: `utils/casino/serialization.js`

**Backend blackjack modules**
- Create: `utils/casino/blackjack/serialization.js`
- Create: `utils/casino/blackjack/tableLifecycle.js`
- Create: `utils/casino/blackjack/roundActions.js`
- Create: `utils/casino/blackjack/turnEngine.js`
- Create: `utils/casino/blackjack/dealerEngine.js`
- Create: `utils/casino/blackjack/settlement.js`
- Create: `utils/casino/blackjack/botEngine.js`
- Create: `utils/casino/blackjack/tickEngine.js`

**Frontend route shell and feature modules**
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

**Verification and lightweight tests**
- Create: `tests/blackjackRoomManager.test.js`
- Create: `tests/blackjackSettlement.test.js`

## Task 1: Create Backend Shared Casino Primitives

**Files:**
- Create: `utils/casino/roomState.js`
- Create: `utils/casino/roomQueries.js`
- Create: `utils/casino/serialization.js`
- Modify: [`utils/blackjackRoomManager.js`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/utils/blackjackRoomManager.js)
- Test: `node tests/blackjackRoomManager.test.js`

- [ ] **Step 1: Write the failing backend smoke test**

```js
const assert = require('assert');
const blackjackRoomManager = require('../utils/blackjackRoomManager');

const roomId = 'plan-test-room-shared';
blackjackRoomManager.createRoom(roomId, 5);

const rooms = blackjackRoomManager.listRooms();
assert(rooms.some((room) => room.roomId === roomId), 'room should appear in listRooms');

const room = blackjackRoomManager.getRoom(roomId);
assert(room, 'getRoom should return created room');
assert.strictEqual(room.maxPlayers, 5);
```

- [ ] **Step 2: Run test to verify it fails because the dedicated test file does not exist yet**

Run: `node tests/blackjackRoomManager.test.js`
Expected: `Error: Cannot find module` or missing file failure

- [ ] **Step 3: Add shared room state helpers**

```js
function normalizeRoomId(roomId) {
  return String(roomId || '').trim();
}

function createPlayerState(user, seat) {
  return {
    userId: String(user.userId || user.id),
    username: user.username || user.displayName || `User ${seat}`,
    displayName: user.displayName || user.username || `User ${seat}`,
    isBot: Boolean(user.isBot),
    seat,
    currentBet: 0,
    hands: [],
    activeHandIndex: 0,
    done: false,
    connected: true,
    preferences: user.preferences || {}
  };
}

module.exports = {
  normalizeRoomId,
  createPlayerState
};
```

- [ ] **Step 4: Add shared room query helpers**

```js
function getOrderedPlayers(room) {
  return [...room.players].sort((a, b) => a.seat - b.seat);
}

function getPlayerByUserId(room, userId) {
  return room.players.find((player) => String(player.userId) === String(userId)) || null;
}

module.exports = {
  getOrderedPlayers,
  getPlayerByUserId
};
```

- [ ] **Step 5: Add shared room summary serialization**

```js
function serializeRoomSummary(room, orderedPlayers) {
  return {
    roomId: room.roomId,
    game: room.game,
    maxPlayers: room.maxPlayers,
    status: room.status,
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
```

- [ ] **Step 6: Rewire the manager to import and use the shared helpers without changing exports**

```js
const { normalizeRoomId, createPlayerState, createHandState, resetPlayerRoundState } = require('./casino/roomState');
const { getOrderedPlayers, getPlayerByUserId, getNextFreeSeat, hasActiveRound, getPlayerRoomIdFromRooms } = require('./casino/roomQueries');
const { serializeRoomSummary } = require('./casino/serialization');
```

- [ ] **Step 7: Add the smoke test file**

```js
const assert = require('assert');
const blackjackRoomManager = require('../utils/blackjackRoomManager');

const roomId = 'plan-test-room-shared';
const existing = blackjackRoomManager.getRoom(roomId);
if (!existing) blackjackRoomManager.createRoom(roomId, 5);

const rooms = blackjackRoomManager.listRooms();
assert(rooms.some((room) => room.roomId === roomId));
assert.strictEqual(blackjackRoomManager.getRoom(roomId).maxPlayers, 5);

console.log('blackjackRoomManager shared smoke test passed');
```

- [ ] **Step 8: Run the smoke test**

Run: `node tests/blackjackRoomManager.test.js`
Expected: prints `blackjackRoomManager shared smoke test passed`

- [ ] **Step 9: Commit**

```bash
git add utils/casino/roomState.js utils/casino/roomQueries.js utils/casino/serialization.js utils/blackjackRoomManager.js tests/blackjackRoomManager.test.js
git commit -m "refactor: extract shared casino room primitives"
```

## Task 2: Extract Blackjack Serialization and Table Lifecycle

**Files:**
- Create: `utils/casino/blackjack/serialization.js`
- Create: `utils/casino/blackjack/tableLifecycle.js`
- Modify: [`utils/blackjackRoomManager.js`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/utils/blackjackRoomManager.js)
- Test: `node tests/blackjackRoomManager.test.js`

- [ ] **Step 1: Extend the failing test to cover join and list behavior**

```js
blackjackRoomManager.joinRoom(roomId, {
  userId: 'plan-user-1',
  username: 'planuser',
  displayName: 'Plan User'
});

const state = blackjackRoomManager.getRoomState(roomId, 'plan-user-1');
assert.strictEqual(state.players.length, 1);
assert.strictEqual(state.players[0].seat, 1);
```

- [ ] **Step 2: Run test to verify the changed assertions fail before extraction is complete**

Run: `node tests/blackjackRoomManager.test.js`
Expected: fails on join/state assertions until the test is updated and cleanup is handled

- [ ] **Step 3: Move blackjack room state serialization into a dedicated module**

```js
function getRoomState(room, viewerUserId = null) {
  const revealHoleCard = room.status === 'dealer_turn' || room.status === 'settlement';
  return {
    roomId: room.roomId,
    game: room.game,
    status: room.status,
    players: getOrderedPlayers(room).map(serializePlayer),
    dealerHand: serializeDealerHand(room.dealerHand, revealHoleCard),
    lastSettlement: serializeSettlement(room.lastSettlement),
    viewerUserId
  };
}
```

- [ ] **Step 4: Move lobby lifecycle operations into `tableLifecycle.js`**

```js
function joinRoom(rooms, roomId, user, helpers) {
  const room = helpers.getRoom(rooms, roomId);
  const existing = helpers.getPlayerByUserId(room, user.userId);
  if (existing) {
    existing.connected = true;
    return room;
  }
  room.players.push(helpers.createPlayerState(user, helpers.getNextFreeSeat(room)));
  room.players = helpers.getOrderedPlayers(room);
  return room;
}
```

- [ ] **Step 5: Keep the facade exports stable**

```js
module.exports = {
  rooms,
  ALLOWED_BET_CHIPS_KC,
  CENTS_PER_KC,
  TURN_TIMEOUT_MS,
  createRoom,
  getRoom,
  getPlayerRoomId,
  listRooms,
  joinRoom,
  leaveRoom,
  getRoomState
};
```

- [ ] **Step 6: Update the smoke test with cleanup so repeated runs remain stable**

```js
const existingPlayerRoom = blackjackRoomManager.getPlayerRoomId('plan-user-1');
if (existingPlayerRoom) blackjackRoomManager.leaveRoom(existingPlayerRoom, 'plan-user-1');
```

- [ ] **Step 7: Run the smoke test**

Run: `node tests/blackjackRoomManager.test.js`
Expected: passes with create, join, and room-state assertions

- [ ] **Step 8: Commit**

```bash
git add utils/casino/blackjack/serialization.js utils/casino/blackjack/tableLifecycle.js utils/blackjackRoomManager.js tests/blackjackRoomManager.test.js
git commit -m "refactor: extract blackjack room lifecycle and serialization"
```

## Task 3: Extract Round Actions and Turn Progression

**Files:**
- Create: `utils/casino/blackjack/roundActions.js`
- Create: `utils/casino/blackjack/turnEngine.js`
- Modify: [`utils/blackjackRoomManager.js`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/utils/blackjackRoomManager.js)
- Test: `tests/blackjackRoomManager.test.js`

- [ ] **Step 1: Add failing assertions for a simple betting and start-round flow**

```js
blackjackRoomManager.placeBet(roomId, 'plan-user-1', 10000, 100000);
const betState = blackjackRoomManager.getRoomState(roomId, 'plan-user-1');
assert.strictEqual(betState.players[0].currentBet, 10000);

blackjackRoomManager.startRound(roomId, 'plan-user-1');
const roundState = blackjackRoomManager.getRoomState(roomId, 'plan-user-1');
assert(['player_turns', 'dealer_turn', 'settlement'].includes(roundState.status));
```

- [ ] **Step 2: Run test to verify the new assertions fail until extraction and test setup stabilize**

Run: `node tests/blackjackRoomManager.test.js`
Expected: fails on state or sequencing assumptions

- [ ] **Step 3: Move betting and player action handlers into `roundActions.js`**

```js
function placeBet(room, player, amount, userBalance, config) {
  config.validateBetAmount(amount);
  if (!player.isBot && userBalance < amount) {
    throw new Error('Not enough KoalaCoins for that bet.');
  }
  player.currentBet = amount;
  return room;
}
```

- [ ] **Step 4: Move hand and player turn progression into `turnEngine.js`**

```js
function advanceTurn(room, helpers) {
  const orderedPlayers = helpers.getOrderedPlayers(room).filter((player) => player.currentBet > 0);
  const nextPlayer = orderedPlayers.find((player) => !player.done);
  room.currentPlayerTurn = nextPlayer ? nextPlayer.userId : null;
  room.turnDeadlineAt = nextPlayer ? Date.now() + helpers.TURN_TIMEOUT_MS : null;
  return room;
}
```

- [ ] **Step 5: Keep split/double/hit/stand rules behavior-preserving**

```js
module.exports = {
  placeBet,
  startRound,
  hit,
  stand,
  doubleDown,
  split
};
```

- [ ] **Step 6: Make the smoke test deterministic enough for repeated runs**

```js
if (blackjackRoomManager.getRoom(roomId)?.status !== 'betting') {
  // create a fresh room id for this phase if needed
}
```

- [ ] **Step 7: Run the smoke test**

Run: `node tests/blackjackRoomManager.test.js`
Expected: passes with betting and round-start assertions

- [ ] **Step 8: Commit**

```bash
git add utils/casino/blackjack/roundActions.js utils/casino/blackjack/turnEngine.js utils/blackjackRoomManager.js tests/blackjackRoomManager.test.js
git commit -m "refactor: extract blackjack round actions and turn engine"
```

## Task 4: Extract Dealer, Settlement, and Tick Engines

**Files:**
- Create: `utils/casino/blackjack/dealerEngine.js`
- Create: `utils/casino/blackjack/settlement.js`
- Create: `utils/casino/blackjack/botEngine.js`
- Create: `utils/casino/blackjack/tickEngine.js`
- Modify: [`utils/blackjackRoomManager.js`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/utils/blackjackRoomManager.js)
- Create: `tests/blackjackSettlement.test.js`

- [ ] **Step 1: Write the failing settlement-focused test**

```js
const assert = require('assert');
const { evaluateSettlementEntry } = require('../utils/casino/blackjack/settlement');

const entry = evaluateSettlementEntry({
  hand: { value: 20, bet: 10000, blackjack: false, busted: false },
  dealerValue: 18,
  dealerBust: false,
  dealerBlackjack: false
});

assert.strictEqual(entry.result, 'win');
assert.strictEqual(entry.payout, 20000);
```

- [ ] **Step 2: Run test to verify it fails before the module exports exist**

Run: `node tests/blackjackSettlement.test.js`
Expected: missing module or missing export failure

- [ ] **Step 3: Extract dealer sequencing**

```js
function resolveDealerTurn(room, now, helpers) {
  const dealerValue = helpers.calculateHandValue(room.dealerHand);
  if (room.dealerPhase === 'reveal') {
    room.dealerPhase = dealerValue < 17 ? 'draw' : dealerValue > 21 ? 'bust' : 'stand';
    room.dealerActionAt = now + helpers.DEALER_ACTION_DELAY_MS;
  }
  return room;
}
```

- [ ] **Step 4: Extract settlement entry evaluation as a pure helper**

```js
function evaluateSettlementEntry({ hand, dealerValue, dealerBust, dealerBlackjack }) {
  let result = 'push';
  if (hand.busted) result = 'bust';
  else if (hand.blackjack && dealerBlackjack) result = 'push';
  else if (hand.blackjack) result = 'blackjack';
  else if (dealerBust || hand.value > dealerValue) result = 'win';
  else if (hand.value < dealerValue) result = 'lose';

  const payout = result === 'blackjack' ? Math.floor(hand.bet * 2.5) : result === 'win' ? hand.bet * 2 : result === 'push' ? hand.bet : 0;
  return { result, payout, netProfit: payout - hand.bet };
}
```

- [ ] **Step 5: Extract bot actions and periodic tick orchestration**

```js
function tickRoom(room, now, helpers) {
  if (room.status === 'dealer_turn' && room.dealerActionAt && now >= room.dealerActionAt) {
    helpers.resolveDealerTurn(room.roomId, now);
    return true;
  }
  return false;
}
```

- [ ] **Step 6: Add the settlement test file**

```js
const assert = require('assert');
const { evaluateSettlementEntry } = require('../utils/casino/blackjack/settlement');

const win = evaluateSettlementEntry({
  hand: { value: 20, bet: 10000, blackjack: false, busted: false },
  dealerValue: 18,
  dealerBust: false,
  dealerBlackjack: false
});

assert.strictEqual(win.result, 'win');
assert.strictEqual(win.payout, 20000);
console.log('blackjack settlement test passed');
```

- [ ] **Step 7: Run the dedicated settlement test and smoke test**

Run: `node tests/blackjackSettlement.test.js`
Expected: prints `blackjack settlement test passed`

Run: `node tests/blackjackRoomManager.test.js`
Expected: still passes after the extraction

- [ ] **Step 8: Commit**

```bash
git add utils/casino/blackjack/dealerEngine.js utils/casino/blackjack/settlement.js utils/casino/blackjack/botEngine.js utils/casino/blackjack/tickEngine.js utils/blackjackRoomManager.js tests/blackjackSettlement.test.js tests/blackjackRoomManager.test.js
git commit -m "refactor: extract blackjack dealer settlement and tick engines"
```

## Task 5: Keep Controller and Socket Boundaries Thin

**Files:**
- Modify: [`controllers/blackjackController.js`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/controllers/blackjackController.js)
- Modify: [`sockets/socketHandler.js`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/sockets/socketHandler.js)
- Test: `npm run build`

- [ ] **Step 1: Identify repeated blackjack sync logic and extract a helper if needed**

```js
function emitBlackjackSync(req, roomId, viewerUserId = null) {
  const io = getIo(req);
  if (!io) return;
  const state = roomId ? blackjackRoomManager.getRoomState(roomId, viewerUserId) : null;
  if (roomId && state) io.to(getBlackjackSocketRoom(roomId)).emit(EVENTS.BLACKJACK_STATE, state);
  io.emit(EVENTS.BLACKJACK_ROOMS, blackjackRoomManager.listRooms());
}
```

- [ ] **Step 2: If socket blackjack code can be isolated cheaply, extract a registration helper instead of growing `socketHandler.js`**

```js
function registerBlackjackHandlers({ socket, io, dbLayer, blackjackRoomManager, EVENTS }) {
  socket.on(EVENTS.BLACKJACK_HIT, async (payload, ack) => {
    // existing logic moved without behavior changes
  });
}
```

- [ ] **Step 3: Keep event names, ack payloads, and manager method usage stable**

```js
sendSocketAck(ack, { success: true, state: blackjackRoomManager.getRoomState(roomId, userId) });
```

- [ ] **Step 4: Run frontend build to catch import or syntax regressions from shared contract changes**

Run: `npm run build`
Expected: Vite build completes with `Exit code: 0`

- [ ] **Step 5: Commit**

```bash
git add controllers/blackjackController.js sockets/socketHandler.js
git commit -m "refactor: keep blackjack controller and socket boundaries thin"
```

## Task 6: Extract Frontend Utilities and Leaf Components

**Files:**
- Create: `src/features/blackjack/utils/formatters.js`
- Create: `src/features/blackjack/utils/layout.js`
- Create: `src/features/blackjack/components/PlayingCard.jsx`
- Create: `src/features/blackjack/components/SettlementToast.jsx`
- Create: `src/features/blackjack/components/BlackjackCelebration.jsx`
- Modify: [`src/pages/Blackjack.jsx`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/src/pages/Blackjack.jsx)
- Test: `npm run build`

- [ ] **Step 1: Write the failing import move by replacing one inline helper at a time**

```js
import { formatKC, buildChipBreakdown, getVisualSeat, getActualSeat } from '../features/blackjack/utils/formatters';
import { getSeatClass } from '../features/blackjack/utils/layout';
```

- [ ] **Step 2: Run the build to verify missing modules fail before they are created**

Run: `npm run build`
Expected: module resolution failure for the new feature files

- [ ] **Step 3: Move pure helpers into feature-local utilities**

```js
export function formatKC(cents) {
  return `${(cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KC`;
}

export function getVisualSeat(seat, mySeat, maxPlayers) {
  if (!mySeat || !maxPlayers) return seat;
  return ((seat - mySeat + maxPlayers) % maxPlayers) + 1;
}
```

- [ ] **Step 4: Move leaf presentation components out of the page file**

```jsx
export default function PlayingCard({ card, index = 0, compact = false }) {
  return (
    <div className={`blackjack-card${compact ? ' compact' : ''}${card?.visible === false ? ' hidden-card' : ''}`}>
      {/* existing card markup */}
    </div>
  );
}
```

- [ ] **Step 5: Replace in-file component declarations with imports**

```jsx
import PlayingCard from '../features/blackjack/components/PlayingCard';
import SettlementToast from '../features/blackjack/components/SettlementToast';
import BlackjackCelebration from '../features/blackjack/components/BlackjackCelebration';
```

- [ ] **Step 6: Run the build**

Run: `npm run build`
Expected: Vite build completes with `Exit code: 0`

- [ ] **Step 7: Commit**

```bash
git add src/pages/Blackjack.jsx src/features/blackjack/utils/formatters.js src/features/blackjack/utils/layout.js src/features/blackjack/components/PlayingCard.jsx src/features/blackjack/components/SettlementToast.jsx src/features/blackjack/components/BlackjackCelebration.jsx
git commit -m "refactor: extract blackjack frontend utilities and leaf components"
```

## Task 7: Extract Frontend Hooks for Room State and Timers

**Files:**
- Create: `src/features/blackjack/hooks/useBlackjackRoom.js`
- Create: `src/features/blackjack/hooks/useBlackjackTimers.js`
- Modify: [`src/pages/Blackjack.jsx`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/src/pages/Blackjack.jsx)
- Test: `npm run build`

- [ ] **Step 1: Move socket, fetch, and action orchestration into `useBlackjackRoom`**

```js
export default function useBlackjackRoom({ socket, selectedTable, currentRoomId, token, onError }) {
  const [roomState, setRoomState] = useState(null);
  const [rooms, setRooms] = useState([]);

  async function loadRooms() {
    const data = await fetchJson('/api/blackjack/rooms', { token: '' });
    setRooms(data.rooms || []);
  }

  return { roomState, rooms, loadRooms };
}
```

- [ ] **Step 2: Use a dedicated timer hook for countdown behavior**

```js
export default function useBlackjackTimers({ turnDeadlineAt, autoStartAt }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return {
    turnCountdownSeconds: turnDeadlineAt ? Math.max(0, Math.ceil((turnDeadlineAt - now) / 1000)) : null,
    autoStartSeconds: autoStartAt ? Math.max(0, Math.ceil((autoStartAt - now) / 1000)) : null
  };
}
```

- [ ] **Step 3: Reduce the route file to page-level composition**

```jsx
const {
  roomState,
  rooms,
  leaderboard,
  actions
} = useBlackjackRoom({ socket, selectedTable, currentRoomId, token, onError: showToast });
```

- [ ] **Step 4: Run the build**

Run: `npm run build`
Expected: Vite build completes with `Exit code: 0`

- [ ] **Step 5: Commit**

```bash
git add src/pages/Blackjack.jsx src/features/blackjack/hooks/useBlackjackRoom.js src/features/blackjack/hooks/useBlackjackTimers.js
git commit -m "refactor: move blackjack data flow into hooks"
```

## Task 8: Split the Main Blackjack UI into Feature Components

**Files:**
- Create: `src/features/blackjack/components/BlackjackPageShell.jsx`
- Create: `src/features/blackjack/components/BlackjackTable.jsx`
- Create: `src/features/blackjack/components/BlackjackDealer.jsx`
- Create: `src/features/blackjack/components/BlackjackSeat.jsx`
- Create: `src/features/blackjack/components/BlackjackControls.jsx`
- Create: `src/features/blackjack/components/BlackjackLobby.jsx`
- Create: `src/features/blackjack/components/BlackjackLeaderboard.jsx`
- Modify: [`src/pages/Blackjack.jsx`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/src/pages/Blackjack.jsx)
- Test: `npm run build`

- [ ] **Step 1: Move the highest-level JSX composition into a page shell**

```jsx
export default function BlackjackPageShell(props) {
  return (
    <>
      <BlackjackLobby {...props} />
      <BlackjackTable {...props} />
      <BlackjackLeaderboard {...props} />
    </>
  );
}
```

- [ ] **Step 2: Extract the dealer region**

```jsx
export default function BlackjackDealer({ roomState }) {
  return (
    <div className="blackjack-dealer-zone">
      {/* existing dealer header and card markup */}
    </div>
  );
}
```

- [ ] **Step 3: Extract seat rendering into a focused component**

```jsx
export default function BlackjackSeat({ player, isCurrentTurn, isLocalPlayer, onSelectSeat, onClearPendingBet }) {
  return (
    <div className={/* existing seat classes */}>
      {/* existing seat header, hands, and bet stack */}
    </div>
  );
}
```

- [ ] **Step 4: Extract controls and lobby panels**

```jsx
export default function BlackjackControls({ pendingBet, onAddChip, onHit, onStand, onDouble, onSplit }) {
  return (
    <div className="blackjack-control-deck">
      {/* existing chip and action controls */}
    </div>
  );
}
```

- [ ] **Step 5: Make the route file a thin entrypoint**

```jsx
import BlackjackPageShell from '../features/blackjack/components/BlackjackPageShell';

export default function Blackjack({ socket }) {
  return <BlackjackPageShell socket={socket} />;
}
```

- [ ] **Step 6: Run the build**

Run: `npm run build`
Expected: Vite build completes with `Exit code: 0`

- [ ] **Step 7: Commit**

```bash
git add src/pages/Blackjack.jsx src/features/blackjack/components/BlackjackPageShell.jsx src/features/blackjack/components/BlackjackTable.jsx src/features/blackjack/components/BlackjackDealer.jsx src/features/blackjack/components/BlackjackSeat.jsx src/features/blackjack/components/BlackjackControls.jsx src/features/blackjack/components/BlackjackLobby.jsx src/features/blackjack/components/BlackjackLeaderboard.jsx
git commit -m "refactor: split blackjack page into feature components"
```

## Task 9: Move Styles to a Dedicated Stylesheet and Add Mobile-First Layout

**Files:**
- Create: `src/features/blackjack/blackjack.css`
- Modify: [`src/pages/Blackjack.jsx`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/src/pages/Blackjack.jsx)
- Modify: `src/features/blackjack/components/BlackjackTable.jsx`
- Modify: `src/features/blackjack/components/BlackjackControls.jsx`
- Modify: `src/features/blackjack/components/BlackjackSeat.jsx`
- Test: `npm run build`

- [ ] **Step 1: Move embedded CSS out of the page component**

```jsx
import '../features/blackjack/blackjack.css';
```

- [ ] **Step 2: Create mobile-first layout rules**

```css
.blackjack-page {
  display: grid;
  gap: 16px;
}

.blackjack-table-layout {
  display: grid;
  gap: 16px;
}

@media (max-width: 767px) {
  .blackjack-seat-region {
    display: grid;
    gap: 12px;
  }

  .blackjack-controls-sticky {
    position: sticky;
    bottom: 0;
    z-index: 20;
  }
}
```

- [ ] **Step 3: Keep desktop absolute positioning only for desktop breakpoints**

```css
@media (min-width: 1024px) {
  .blackjack-seat-5-1 { --seat-transform: translateX(-50%); bottom: 70px; left: 50%; }
  .blackjack-seat-5-2 { bottom: 240px; left: 3.2%; }
}
```

- [ ] **Step 4: Wire components to the new responsive class structure**

```jsx
<div className="blackjack-table-layout">
  <BlackjackDealer roomState={roomState} />
  <div className="blackjack-seat-region">{seatNodes}</div>
  <div className="blackjack-controls-sticky">
    <BlackjackControls {...controlProps} />
  </div>
</div>
```

- [ ] **Step 5: Run the build**

Run: `npm run build`
Expected: Vite build completes with `Exit code: 0`

- [ ] **Step 6: Commit**

```bash
git add src/features/blackjack/blackjack.css src/pages/Blackjack.jsx src/features/blackjack/components/BlackjackTable.jsx src/features/blackjack/components/BlackjackControls.jsx src/features/blackjack/components/BlackjackSeat.jsx
git commit -m "feat: add mobile-first blackjack layout"
```

## Task 10: Final Verification and Cleanup

**Files:**
- Verify: backend and frontend blackjack files changed in previous tasks
- Verify: [`docs/superpowers/specs/2026-04-23-blackjack-refactor-design.md`](/Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/docs/superpowers/specs/2026-04-23-blackjack-refactor-design.md)
- Verify: this plan file

- [ ] **Step 1: Run backend smoke tests**

Run: `node tests/blackjackRoomManager.test.js`
Expected: pass

Run: `node tests/blackjackSettlement.test.js`
Expected: pass

- [ ] **Step 2: Run frontend build verification**

Run: `npm run build`
Expected: Vite build completes with `Exit code: 0`

- [ ] **Step 3: Review the facade and route entrypoints**

```js
// utils/blackjackRoomManager.js should remain the stable public API
module.exports = {
  rooms,
  createRoom,
  getRoom,
  listRooms,
  joinRoom,
  leaveRoom,
  getRoomState,
  placeBet,
  startRound,
  hit,
  stand,
  doubleDown,
  split,
  tick
};
```

```jsx
// src/pages/Blackjack.jsx should remain the stable route export
export default function Blackjack({ socket }) {
  return <BlackjackPageShell socket={socket} />;
}
```

- [ ] **Step 4: Check that future casino games have a clear landing zone**

```txt
utils/casino/
utils/casino/blackjack/
utils/casino/roulette/
utils/casino/poker/
```

- [ ] **Step 5: Commit**

```bash
git add utils/blackjackRoomManager.js controllers/blackjackController.js sockets/socketHandler.js src/pages/Blackjack.jsx src/features/blackjack utils/casino tests
git commit -m "refactor: restructure blackjack for reusable casino architecture"
```
