# European Roulette MVP Design

**Date:** 2026-04-25  
**Scope:** Single-table multiplayer European roulette with full bet types and settlement  
**Status:** Design approved, ready for implementation planning

---

## Overview

Implement European Roulette (single-0) as a new casino game in the existing framework. Single global table, seat-optional participants, full betting range (outside, inside, dozens, columns), and automated settlement with balance deduction upfront and payout calculation after spin.

---

## Requirements Summary

### Game Rules
- **Variant:** European Roulette (0-36, single zero)
- **Bet Types:**
  - Outside: Red/Black, Even/Odd, 1–18, 19–36, Dozens (1–12, 13–24, 25–36), Columns
  - Inside: Straight Up (single number), Split, Street, Corner, Six Line
- **Optional (future):** French Roulette (La Partage / En Prison)

### Bet Limits (per bet type)
- Minimum: 1 KC
- Outside/Dozens/Columns: max 1,000 KC
- Inside bets: max 500 KC
- Total per round per player: max 5,000 KC

### Multiplayer
- Single public roulette table
- Humans only (no bots for MVP)
- Concurrent players, no seat-based turns
- Join/leave between rounds only
- Existing WebSocket for real-time sync

### Phase Timing
- **Betting Open:** 30 seconds
- **Spin Animation:** 10 seconds
- **Settlement Display:** 5 seconds
- **Waiting (buffer):** 5 seconds

---

## Architecture

### 1. Room & Participant Model

**Single Global Roulette Room**

Lazily created on first player action. Stored in `tableRegistry` (reuse core).

```js
room = {
  roomId: 'roulette_main',
  participants: [
    { userId, username, balance, isBot: false, left: false }
  ],
  currentPhase: 'waiting' | 'betting_open' | 'betting_closed' | 'spin' | 'settlement',
  phaseStartedAt: timestamp,
  deadlineAt: timestamp (phase transition),
  
  roundId: uuid,
  rounds: {
    [roundId]: {
      bets: {
        [playerId]: [
          { betId, type, amount, status, payout }
        ]
      },
      spinResult: { number, color, timestamp }
    }
  },
  lastSettlement: [
    { playerId, displayChange, bets: [betId, betId] }
  ]
}
```

**Participants:** Seat-optional. No `currentPlayerTurn`. Players join via `participants.push()`, marked `left: true` on disconnect (not removed).

### 2. Phase Cycle (Automated)

```
waiting (5s)
  ↓
betting_open (30s, accepts placeBet calls)
  ↓ [auto-transition on deadline]
betting_closed (0s, instant transition)
  ↓
spin (10s, wheel spins, result determined)
  ↓ [auto-transition on deadline]
settlement (5s, display payouts)
  ↓ [auto-transition on deadline]
waiting (loop)
```

Transitions driven by `phaseTimers.js` (reuse from core). No manual step() calls needed.

### 3. Betting System

**Bet Placement Flow**

```
placeBet(roomId, userId, betType, amount)
  1. Validate phase = 'betting_open'
  2. Validate betType exists, amount > 0
  3. Validate amount ≤ limit[betType]
  4. Validate player balance ≥ amount
  5. Validate (total bets this round + amount) ≤ 5000
  6. Deduct balance: userController.updateBalance(userId, -amount, 'roulette_bet', roundId)
  7. Create bet object, append to room.rounds[roundId].bets[playerId][]
  8. Return confirmation to client
```

**Bet Object**

```js
{
  betId: uuid,
  playerId,
  type: 'red' | 'black' | 'odd' | 'even' | 
        'range_1to18' | 'range_19to36' | 
        'dozen_1' | 'dozen_2' | 'dozen_3' | 
        'column_1' | 'column_2' | 'column_3' |
        'straight_N' | 'split_N' | 'street_N' | 'corner_N' | 'sixline_N',
  amount: integer (KC, ≥ 1),
  status: 'active' | 'won' | 'lost',
  payout: integer (calculated at settlement)
}
```

**Validation Rules**
- Reject if phase ≠ 'betting_open'
- Reject if amount < 1 or > limit[betType]
- Reject if player balance < amount
- Reject if total bets this round > 5000 KC
- Reject if insufficient balance → show "Nicht genug Guthaben"
- No bets/modifications allowed after 'betting_closed' phase

### 4. Wheel & Spin Mechanics

**Spin Outcome**

When `spin` phase starts:
```js
spinResult = {
  roundId,
  number: Math.floor(Math.random() * 37), // 0–36
  color: number === 0 ? 'green' : (number % 2 === 0 ? 'red' : 'black'),
  timestamp: Date.now()
}
```

Client-side animation is separate (wheel visual, timing, easing). Server only tracks outcome number + color.

**Safeguards**
- `startSpin()` only allowed if `currentPhase === 'betting_closed'`
- Idempotent per `roundId` (duplicate calls return existing result)
- No manual spin triggers during spin/settlement phases

### 5. Settlement & Payouts

**Payout Odds (Standard European Roulette)**

```js
odds = {
  'red': 1,           // 1:1
  'black': 1,         // 1:1
  'odd': 1,           // 1:1
  'even': 1,          // 1:1
  'range_1to18': 1,   // 1:1
  'range_19to36': 1,  // 1:1
  'dozen_*': 2,       // 2:1
  'column_*': 2,      // 2:1
  'straight_N': 35,   // 35:1
  'split_N': 17,      // 17:1
  'street_N': 11,     // 11:1
  'corner_N': 8,      // 8:1
  'sixline_N': 5      // 5:1
}
```

**Settlement Process**

When `settlement` phase starts:

1. For each bet in `room.rounds[roundId].bets[playerId]`:
   - Check if `spinResult.number` matches bet coverage (use `coverage.js`)
   - If win: `bet.status = 'won'`, `bet.payout = amount * (oddsFactor + 1)`
   - If loss: `bet.status = 'lost'`, `bet.payout = 0`

2. Calculate balance change:
   ```js
   // Winner: return principal + winnings
   payoutReturn = amount * (oddsFactor + 1)
   balance += payoutReturn
   displayChange = +(amount * oddsFactor)  // show only winnings
   
   // Loser: no return (already deducted)
   balance += 0
   displayChange = -amount
   ```

3. Write balance update via balance service:
   ```js
   userController.updateBalance(userId, displayChange, 'roulette_settlement', roundId)
   ```

4. Write settlement record:
   ```js
   room.lastSettlement = [
     { playerId, displayChange, bets: [betIds] }
   ]
   ```

5. Auto-transition to `waiting` phase

**Balance Integrity**
- Balance deducted on `placeBet` success only
- Settlement calls existing balance service (no direct writes)
- Bets held in `room.rounds[roundId].bets` until settlement
- Audit trail via balance service transaction

### 6. File Structure

New module: `utils/casino/roulette/`

```
roulette/
  ├── wheel.js              // Spin mechanics, random generation
  ├── bets.js               // Validation, limit checks, bet storage
  ├── settlement.js         // Payout calculation (no direct balance writes)
  ├── odds.js               // Payout odds lookup (straight: 35, split: 17, etc)
  ├── coverage.js           // Bet type → number coverage tables
  ├── tableLifecycle.js     // Room init, phase management, round lifecycle
  ├── serialization.js      // Serialize room state for client (remove internals)
  └── index.js              // Public API exports
```

### 7. Controller Integration

Add to `roomController.js`:

```js
// Bet placement
placeBet(roomId, userId, betType, amount)

// Game flow
startSpin(roomId)                          // idempotent per roundId

// State retrieval
getCurrentRound(roomId)                    // room state snapshot
getParticipants(roomId)                    // active + disconnected players
getLastSettlement(roomId)                  // previous round results

// Participant management
leaveTable(roomId, userId)                 // mark disconnected, preserve bets/settlement rights
```

WebSocket messages sync room state after each action (placeBet, spin, settlement).

### 8. Balance & Audit

- **Bet deduction:** `userController.updateBalance(userId, -amount, 'roulette_bet', roundId)`
- **Payout credit:** `userController.updateBalance(userId, displayChange, 'roulette_settlement', roundId)`
- **No direct balance writes** in settlement.js — all writes via balance service
- **Player disconnection:** Mark `{userId, left: true}`, keep bets + settlement eligibility
- **Audit trail:** Balance service logs all transactions by roundId

### 9. Error Handling

| Scenario | Response |
|----------|----------|
| Insufficient balance | Reject bet, return "Nicht genug Guthaben" |
| Bet after betting_closed | Reject silently (client shouldn't allow) |
| Duplicate spin call | Return existing result (idempotent) |
| Player disconnects during betting | Bets remain, marked `left: true` |
| Player tries to leave mid-settlement | Allowed, settlement processes normally |

---

## Data Flow

### Placing a Bet

```
Client: { action: 'placeBet', betType: 'red', amount: 50 }
  ↓
roomController.placeBet()
  ↓
bets.validateBet() + balance check
  ↓
userController.updateBalance(-50, 'roulette_bet', roundId)
  ↓
room.rounds[roundId].bets[playerId].push(betObj)
  ↓
Server: { action: 'betPlaced', betId, balance: newBalance }
  → broadcast to all participants via WebSocket
```

### Spin & Settlement

```
Client/Server scheduled deadline triggers startSpin()
  ↓
wheel.spinWheel() → { number, color }
  ↓
Phase: spin → settlement (auto-transition)
  ↓
settlement.calculatePayouts() for all bets
  ↓
For each winner/loser:
  userController.updateBalance(displayChange, 'roulette_settlement', roundId)
  ↓
room.lastSettlement written
  ↓
Server: { action: 'settlement', results: [...] }
  → broadcast to all participants
  ↓
Auto-transition to waiting (phase loop continues)
```

---

## Testing Strategy

- **Unit:** odds lookup, coverage tables, payout calculation
- **Integration:** placeBet + balance deduction, settlement + balance credit
- **End-to-end:** full round cycle (betting → spin → settlement), concurrent bets, edge cases (insufficient balance, left player, duplicate spin)

---

## Scope Exclusions (Future)

- French Roulette rules (La Partage / En Prison)
- Multiple tables
- Bot players
- Custom timing per round
- Betting analytics/history UI
- Admin controls

---

## Success Criteria

1. ✓ Single table, seat-optional participants
2. ✓ All bet types accepted (outside + inside)
3. ✓ Bets rejected if insufficient balance or limits exceeded
4. ✓ Spin result determined, settlement payouts calculated
5. ✓ Balance deducted upfront, credited after settlement
6. ✓ Phase cycle automated (no manual steps)
7. ✓ Real-time WebSocket sync to all players
8. ✓ Player disconnect preserves bets + settlement rights
9. ✓ Audit trail via balance service
