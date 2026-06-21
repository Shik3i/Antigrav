# Blackjack Responsive Casino Feel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the blackjack table responsive across large and medium screens without overlapping seats, then add casino-like card/chip motion that stays stable across those layouts.

**Architecture:** Keep the current route and room-state contracts intact. Add container-query-driven layout modes inside the blackjack feature, then layer motion on top via a dedicated `BlackjackMotionLayer` that computes flight paths from DOM anchors rather than tying animation logic to individual cards or chips.

**Tech Stack:** React 19, Vite, CSS container queries, Socket.IO room state, Node.js regression scripts

---

## File Structure

**Frontend layout and motion**
- Modify: `src/features/blackjack/blackjack.css`
- Modify: `src/features/blackjack/components/BlackjackTable.jsx`
- Modify: `src/features/blackjack/components/BlackjackSeat.jsx`
- Modify: `src/features/blackjack/components/BlackjackDealer.jsx`
- Modify: `src/features/blackjack/components/PlayingCard.jsx`
- Modify: `src/pages/Blackjack.jsx`
- Create: `src/features/blackjack/components/BlackjackMotionLayer.jsx`
- Create: `src/features/blackjack/hooks/useBlackjackMotion.js`
- Create: `src/features/blackjack/utils/motionDiff.js`

**Verification**
- Modify: `tests/blackjackSpectatorUi.test.js`
- Create: `tests/blackjackResponsiveLayout.test.js`
- Create: `tests/blackjackMotionDiff.test.js`

---

### Task 1: Add Container Query Layout Modes

**Files:**
- Modify: `src/features/blackjack/blackjack.css`
- Modify: `src/features/blackjack/components/BlackjackTable.jsx`
- Test: `tests/blackjackResponsiveLayout.test.js`

- [ ] **Step 1: Write the failing regression script**

```js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '../src/features/blackjack/blackjack.css');
const css = fs.readFileSync(cssPath, 'utf8');

assert(css.includes('container-type: inline-size;'), 'blackjack table shell should opt into container queries');
assert(css.includes('container-name: blackjack-table;'), 'blackjack table shell should name its container');
assert(css.includes('@container blackjack-table'), 'blackjack css should use container queries for layout modes');

console.log('blackjack responsive layout regression passed');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/blackjackResponsiveLayout.test.js`  
Expected: FAIL because the test file does not exist yet, then FAIL because container query rules are not yet present.

- [ ] **Step 3: Add the regression file**

Create `tests/blackjackResponsiveLayout.test.js` with the code from Step 1.

- [ ] **Step 4: Add container-query infrastructure to the blackjack shell**

Update `src/features/blackjack/blackjack.css`:

```css
.blackjack-table-shell {
  position: relative;
  overflow: hidden;
  border-radius: 36px;
  margin-top: 14px;
  padding: clamp(18px, 2vw, 28px);
  background: radial-gradient(circle at top, rgba(20,83,45,0.95), rgba(9,37,24,0.98) 50%, rgba(7,18,12,0.98) 100%);
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 30px 80px rgba(0,0,0,0.28);
  container-type: inline-size;
  container-name: blackjack-table;
}
```

- [ ] **Step 5: Define layout mode variables on the table stage**

Update `src/features/blackjack/blackjack.css`:

```css
.blackjack-stage {
  --stage-side-padding: clamp(20px, 2.2vw, 34px);
  --seat-width: clamp(180px, 15vw, 250px);
  --seat-3-side-bottom: 190px;
  --seat-3-center-bottom: 90px;
  --seat-3-side-offset: 10%;
  --seat-5-center-bottom: 70px;
  --seat-5-inner-bottom: 130px;
  --seat-5-outer-bottom: 240px;
  --seat-5-inner-offset: 16%;
  --seat-5-outer-offset: 3.2%;
  position: relative;
  height: 72vh;
  min-height: 600px;
  max-height: 850px;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: clamp(28px, 2.6vw, 38px);
  overflow: hidden;
}
```

- [ ] **Step 6: Rewrite seat placement to use variables instead of fixed breakpoints**

Update `src/features/blackjack/blackjack.css`:

```css
.blackjack-seat-3-1 { --seat-transform: translateX(-50%); bottom: var(--seat-3-center-bottom); left: 50%; }
.blackjack-seat-3-2 { bottom: var(--seat-3-side-bottom); left: var(--seat-3-side-offset); }
.blackjack-seat-3-3 { bottom: var(--seat-3-side-bottom); right: var(--seat-3-side-offset); }

.blackjack-seat-5-1 { --seat-transform: translateX(-50%); bottom: var(--seat-5-center-bottom); left: 50%; }
.blackjack-seat-5-2 { bottom: var(--seat-5-outer-bottom); left: var(--seat-5-outer-offset); }
.blackjack-seat-5-3 { bottom: var(--seat-5-inner-bottom); left: var(--seat-5-inner-offset); }
.blackjack-seat-5-4 { bottom: var(--seat-5-inner-bottom); right: var(--seat-5-inner-offset); }
.blackjack-seat-5-5 { bottom: calc(var(--seat-5-outer-bottom) - 20px); right: calc(var(--seat-5-outer-offset) - 1%); }
```

- [ ] **Step 7: Add compressed and compact container-query modes**

Append to `src/features/blackjack/blackjack.css`:

```css
@container blackjack-table (max-width: 1500px) {
  .blackjack-stage {
    --seat-width: clamp(170px, 14vw, 218px);
    --seat-5-inner-offset: 14%;
    --seat-5-outer-offset: 2%;
    --seat-5-outer-bottom: 266px;
  }
}

@container blackjack-table (max-width: 1180px) {
  .blackjack-stage {
    --seat-width: clamp(150px, 20vw, 186px);
    --seat-3-side-offset: 5%;
    --seat-3-side-bottom: 236px;
    --seat-3-center-bottom: 120px;
    --seat-5-center-bottom: 132px;
    --seat-5-inner-bottom: 220px;
    --seat-5-outer-bottom: 300px;
    --seat-5-inner-offset: 8%;
    --seat-5-outer-offset: 1%;
    min-height: 920px;
  }
}

@container blackjack-table (max-width: 980px) {
  .blackjack-stage {
    min-height: auto;
    padding: 22px;
    display: grid;
    gap: 18px;
  }

  .blackjack-stage::before,
  .blackjack-stage::after,
  .blackjack-table-center {
    display: none;
  }

  .blackjack-dealer-zone,
  .blackjack-felt-pile,
  .blackjack-seat {
    position: relative;
    width: 100%;
    left: auto;
    right: auto;
    top: auto;
    bottom: auto;
    transform: none !important;
  }
}
```

- [ ] **Step 8: Run the responsive layout regression**

Run: `node tests/blackjackResponsiveLayout.test.js`  
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add tests/blackjackResponsiveLayout.test.js src/features/blackjack/blackjack.css
git commit -m "feat: add container-query blackjack layout modes"
```

### Task 2: Keep Controls Inside Seat Ownership Bounds

**Files:**
- Modify: `src/features/blackjack/blackjack.css`
- Modify: `src/features/blackjack/components/BlackjackSeat.jsx`
- Test: `tests/blackjackSpectatorUi.test.js`

- [ ] **Step 1: Write the failing regression script**

Add this assertion to `tests/blackjackSpectatorUi.test.js`:

```js
const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '../src/features/blackjack/blackjack.css'), 'utf8');
assert(css.includes('.blackjack-seat-layout-horizontal.compact-controls'), 'compact control mode class should exist');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/blackjackSpectatorUi.test.js`  
Expected: FAIL because compact control mode is not defined.

- [ ] **Step 3: Add a compact-controls class in `BlackjackSeat.jsx`**

Update the seat layout wrapper:

```jsx
const compactControls = roomState?.tableUiMode === 'compact';

return (
  <div className={`${getSeatClass(roomState?.maxPlayers || selectedTable, player.visualSeat)}${isCurrentTurn ? ' current-turn' : ''}${isLocalPlayer ? ' local-seat' : ''}`}>
    <div className={`blackjack-seat-layout-horizontal${compactControls ? ' compact-controls' : ''}`}>
```

- [ ] **Step 4: Compute `tableUiMode` in `BlackjackTable.jsx` from container width**

Add local state and resize observer:

```jsx
import { useEffect, useRef, useState } from 'react';

const shellRef = useRef(null);
const [tableUiMode, setTableUiMode] = useState('full');

useEffect(() => {
  if (!shellRef.current || typeof ResizeObserver === 'undefined') return undefined;
  const observer = new ResizeObserver(([entry]) => {
    const width = entry.contentRect.width;
    setTableUiMode(width <= 980 ? 'stacked' : width <= 1180 ? 'compact' : width <= 1500 ? 'compressed' : 'full');
  });
  observer.observe(shellRef.current);
  return () => observer.disconnect();
}, []);
```

Then pass it into seats:

```jsx
<section className="blackjack-table-shell" ref={shellRef}>
...
<BlackjackSeat
  ...
  roomState={{ ...roomState, tableUiMode }}
```

- [ ] **Step 5: Move local controls inside the seat in compact mode**

Update `src/features/blackjack/blackjack.css`:

```css
.blackjack-seat-layout-horizontal.compact-controls .blackjack-seat-controls-wrapper {
  position: static;
  inset: auto;
  display: grid;
  gap: 10px;
  margin-bottom: 10px;
}

.blackjack-seat-layout-horizontal.compact-controls .blackjack-chip-tray.vertical-side,
.blackjack-seat-layout-horizontal.compact-controls .blackjack-action-column {
  position: static;
  transform: none;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
}

.blackjack-seat-layout-horizontal.compact-controls .blackjack-action-column {
  gap: 6px;
}
```

- [ ] **Step 6: Move side bets and committed bet stacks into safe compact positions**

Update `src/features/blackjack/blackjack.css`:

```css
.blackjack-seat-layout-horizontal.compact-controls .blackjack-committed-bet-zone {
  top: -118px;
}

.blackjack-seat-layout-horizontal.compact-controls .blackjack-side-bet-row {
  position: static;
  transform: none;
  justify-content: center;
  margin: 0 0 8px;
}
```

- [ ] **Step 7: Run the spectator/layout regression**

Run: `node tests/blackjackSpectatorUi.test.js`  
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/features/blackjack/components/BlackjackSeat.jsx src/features/blackjack/components/BlackjackTable.jsx src/features/blackjack/blackjack.css tests/blackjackSpectatorUi.test.js
git commit -m "feat: keep blackjack controls inside seat bounds"
```

### Task 3: Add Stable Motion Anchors

**Files:**
- Modify: `src/features/blackjack/components/BlackjackTable.jsx`
- Modify: `src/features/blackjack/components/BlackjackDealer.jsx`
- Modify: `src/features/blackjack/components/BlackjackSeat.jsx`
- Modify: `src/features/blackjack/components/PlayingCard.jsx`

- [ ] **Step 1: Add DOM anchor attributes to shoe and discard**

Update `BlackjackTable.jsx`:

```jsx
function FeltPile({ label, count, side = 'left', accent = '#f8fafc', anchorId }) {
  return (
    <div className={`blackjack-felt-pile ${side}`} data-bj-anchor={anchorId}>
```

```jsx
<FeltPile label="Shoe" count={roomState?.shoeRemaining ?? 0} side="right" accent="#fbbf24" anchorId="shoe" />
<FeltPile label="Discard" count={roomState?.discardCount ?? 0} side="left" accent="#93c5fd" anchorId="discard" />
```

- [ ] **Step 2: Add dealer hand anchor**

Update `BlackjackDealer.jsx`:

```jsx
<div className="blackjack-dealer-cards" data-bj-anchor="dealer-hand">
```

- [ ] **Step 3: Add player hand and side-bet anchors**

Update `BlackjackSeat.jsx`:

```jsx
<div
  key={`hand-${handIndex}`}
  className={`blackjack-hand-card-slot ${isActive ? 'active' : ''}`}
  data-bj-anchor={`player-${player.userId}-hand-${handIndex}`}
>
```

```jsx
<button
  ...
  data-bj-anchor={`player-${player.userId}-sidebet-${sideBetKey}`}
>
```

- [ ] **Step 4: Add card-specific metadata for motion diffing**

Update `PlayingCard.jsx`:

```jsx
export default function PlayingCard({ card, index = 0, compact = false, motionId = null }) {
  return (
    <div
      data-bj-card-id={motionId || card?.code || `card-${index}`}
```

- [ ] **Step 5: Thread motion ids into dealer and player card rendering**

Update `BlackjackDealer.jsx`:

```jsx
{(roomState?.dealerHand || []).map((card, index) => (
  <PlayingCard key={`${card.code}-${index}`} card={card} index={index} motionId={`dealer-${card.code}-${index}`} />
))}
```

Update `BlackjackSeat.jsx`:

```jsx
{(hand.cards || []).map((card, index) => (
  <PlayingCard
    key={`${handIndex}-${card.code}-${index}`}
    card={card}
    index={index}
    compact
    motionId={`player-${player.userId}-hand-${handIndex}-${card.code}-${index}`}
  />
))}
```

- [ ] **Step 6: Commit**

```bash
git add src/features/blackjack/components/BlackjackTable.jsx src/features/blackjack/components/BlackjackDealer.jsx src/features/blackjack/components/BlackjackSeat.jsx src/features/blackjack/components/PlayingCard.jsx
git commit -m "feat: add blackjack motion anchors"
```

### Task 4: Build Motion Diffing for Deal and Discard

**Files:**
- Create: `src/features/blackjack/utils/motionDiff.js`
- Create: `tests/blackjackMotionDiff.test.js`

- [ ] **Step 1: Write the failing regression script**

```js
const assert = require('assert');
const { diffBlackjackMotion } = require('../src/features/blackjack/utils/motionDiff.js');

const prevState = {
  dealerHand: [{ code: '7D', visible: true }],
  players: [{ userId: 'u1', hands: [{ cards: [{ code: '10C' }] }] }]
};

const nextState = {
  dealerHand: [{ code: '7D', visible: true }, { code: 'AS', visible: false }],
  players: [{ userId: 'u1', hands: [{ cards: [{ code: '10C' }, { code: '3H' }] }] }]
};

const result = diffBlackjackMotion(prevState, nextState);
assert.strictEqual(result.deals.length, 2, 'new dealer and player cards should produce two deal animations');
assert.strictEqual(result.discards.length, 0, 'no cards should discard during a deal transition');

console.log('blackjack motion diff regression passed');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/blackjackMotionDiff.test.js`  
Expected: FAIL because the test file and motion diff utility do not exist yet.

- [ ] **Step 3: Add the regression file**

Create `tests/blackjackMotionDiff.test.js` with the code from Step 1.

- [ ] **Step 4: Implement `diffBlackjackMotion` minimally**

Create `src/features/blackjack/utils/motionDiff.js`:

```js
function collectCards(state = {}) {
  const cards = [];

  (state.dealerHand || []).forEach((card, index) => {
    cards.push({
      id: `dealer-${card.code}-${index}`,
      code: card.code,
      target: 'dealer-hand'
    });
  });

  (state.players || []).forEach((player) => {
    (player.hands || []).forEach((hand, handIndex) => {
      (hand.cards || []).forEach((card, cardIndex) => {
        cards.push({
          id: `player-${player.userId}-hand-${handIndex}-${card.code}-${cardIndex}`,
          code: card.code,
          target: `player-${player.userId}-hand-${handIndex}`
        });
      });
    });
  });

  return cards;
}

function diffBlackjackMotion(prevState = {}, nextState = {}) {
  const previous = collectCards(prevState);
  const next = collectCards(nextState);
  const previousIds = new Set(previous.map((entry) => entry.id));
  const nextIds = new Set(next.map((entry) => entry.id));

  return {
    deals: next.filter((entry) => !previousIds.has(entry.id)).map((entry) => ({ ...entry, source: 'shoe' })),
    discards: previous.filter((entry) => !nextIds.has(entry.id)).map((entry) => ({ ...entry, target: 'discard' }))
  };
}

module.exports = {
  diffBlackjackMotion
};
```

- [ ] **Step 5: Run the regression**

Run: `node tests/blackjackMotionDiff.test.js`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add tests/blackjackMotionDiff.test.js src/features/blackjack/utils/motionDiff.js
git commit -m "feat: add blackjack motion diff utility"
```

### Task 5: Add `BlackjackMotionLayer` for Card Flights

**Files:**
- Create: `src/features/blackjack/hooks/useBlackjackMotion.js`
- Create: `src/features/blackjack/components/BlackjackMotionLayer.jsx`
- Modify: `src/features/blackjack/components/BlackjackTable.jsx`
- Modify: `src/features/blackjack/blackjack.css`

- [ ] **Step 1: Create a hook that compares previous and current room state**

Create `src/features/blackjack/hooks/useBlackjackMotion.js`:

```jsx
import { useEffect, useRef, useState } from 'react';
import { diffBlackjackMotion } from '../utils/motionDiff';

export function useBlackjackMotion(roomState) {
  const prevRef = useRef(roomState);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const prev = prevRef.current;
    const next = roomState;
    if (!next) return;

    const diff = diffBlackjackMotion(prev, next);
    const nextEvents = [
      ...diff.deals.map((entry) => ({ ...entry, type: 'deal', id: `deal-${entry.id}-${Date.now()}` })),
      ...diff.discards.map((entry) => ({ ...entry, type: 'discard', id: `discard-${entry.id}-${Date.now()}` }))
    ];

    if (nextEvents.length) {
      setEvents((current) => [...current, ...nextEvents]);
    }

    prevRef.current = next;
  }, [roomState]);

  const clearEvent = (id) => {
    setEvents((current) => current.filter((entry) => entry.id !== id));
  };

  return { events, clearEvent };
}
```

- [ ] **Step 2: Create a motion layer component**

Create `src/features/blackjack/components/BlackjackMotionLayer.jsx`:

```jsx
import { useEffect, useMemo, useState } from 'react';

function getAnchorRect(anchorId) {
  const node = document.querySelector(`[data-bj-anchor="${anchorId}"]`);
  return node ? node.getBoundingClientRect() : null;
}

export default function BlackjackMotionLayer({ events, onDone }) {
  const [rendered, setRendered] = useState([]);

  useEffect(() => {
    const next = events
      .map((event) => {
        const from = getAnchorRect(event.source);
        const to = getAnchorRect(event.target);
        if (!from || !to) return null;
        return { ...event, from, to };
      })
      .filter(Boolean);

    setRendered(next);
  }, [events]);

  useEffect(() => {
    if (!rendered.length) return undefined;
    const timers = rendered.map((event) => window.setTimeout(() => onDone(event.id), event.type === 'deal' ? 850 : 1000));
    return () => timers.forEach(window.clearTimeout);
  }, [onDone, rendered]);

  return (
    <div className="blackjack-motion-layer" aria-hidden="true">
      {rendered.map((event) => (
        <div
          key={event.id}
          className={`blackjack-flight-card is-${event.type}`}
          style={{
            '--from-x': `${event.from.left + event.from.width / 2}px`,
            '--from-y': `${event.from.top + event.from.height / 2}px`,
            '--to-x': `${event.to.left + event.to.width / 2}px`,
            '--to-y': `${event.to.top + event.to.height / 2}px`
          }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Mount the motion layer from `BlackjackTable.jsx`**

Update `BlackjackTable.jsx`:

```jsx
import BlackjackMotionLayer from './BlackjackMotionLayer';
import { useBlackjackMotion } from '../hooks/useBlackjackMotion';

const { events: motionEvents, clearEvent } = useBlackjackMotion(roomState);
```

Then render it inside the stage:

```jsx
<div className="blackjack-stage">
  <BlackjackMotionLayer events={motionEvents} onDone={clearEvent} />
```

- [ ] **Step 4: Add card flight styling**

Append to `src/features/blackjack/blackjack.css`:

```css
.blackjack-motion-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 80;
}

.blackjack-flight-card {
  position: fixed;
  width: 58px;
  height: 84px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(250,250,250,0.98), rgba(235,241,248,0.94));
  box-shadow: 0 12px 24px rgba(0,0,0,0.24);
  left: 0;
  top: 0;
}

.blackjack-flight-card.is-deal {
  animation: blackjackFlightDeal 820ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.blackjack-flight-card.is-discard {
  animation: blackjackFlightDiscard 980ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes blackjackFlightDeal {
  0% { transform: translate(var(--from-x), var(--from-y)) rotate(-12deg) scale(0.92); opacity: 0.9; }
  65% { transform: translate(calc((var(--from-x) + var(--to-x)) / 2), calc((var(--from-y) + var(--to-y)) / 2 - 24px)) rotate(-4deg) scale(1); opacity: 1; }
  100% { transform: translate(var(--to-x), var(--to-y)) rotate(0deg) scale(1); opacity: 1; }
}

@keyframes blackjackFlightDiscard {
  0% { transform: translate(var(--from-x), var(--from-y)) rotate(0deg) scale(1); opacity: 1; }
  100% { transform: translate(var(--to-x), var(--to-y)) rotate(14deg) scale(0.86); opacity: 0.82; }
}
```

- [ ] **Step 5: Respect reduced motion**

Append to `src/features/blackjack/blackjack.css`:

```css
@media (prefers-reduced-motion: reduce) {
  .blackjack-flight-card.is-deal,
  .blackjack-flight-card.is-discard {
    animation-duration: 120ms;
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/features/blackjack/hooks/useBlackjackMotion.js src/features/blackjack/components/BlackjackMotionLayer.jsx src/features/blackjack/components/BlackjackTable.jsx src/features/blackjack/blackjack.css
git commit -m "feat: add blackjack card motion layer"
```

### Task 6: Animate Side-Bet Chips

**Files:**
- Modify: `src/features/blackjack/hooks/useBlackjackMotion.js`
- Modify: `src/features/blackjack/utils/motionDiff.js`
- Modify: `src/features/blackjack/components/BlackjackMotionLayer.jsx`
- Modify: `src/features/blackjack/blackjack.css`

- [ ] **Step 1: Extend motion diffing for side bets**

Update `src/features/blackjack/utils/motionDiff.js`:

```js
function collectSideBets(state = {}) {
  const sideBets = [];
  (state.players || []).forEach((player) => {
    ['twins', 'bust'].forEach((key) => {
      const amount = Number(player.activeSideBets?.[key] || player.pendingSideBets?.[key] || 0);
      if (amount > 0) {
        sideBets.push({
          id: `player-${player.userId}-sidebet-${key}`,
          amount,
          target: `player-${player.userId}-sidebet-${key}`
        });
      }
    });
  });
  return sideBets;
}
```

Then extend `diffBlackjackMotion`:

```js
const previousSideBets = collectSideBets(prevState);
const nextSideBets = collectSideBets(nextState);
const previousSideBetIds = new Set(previousSideBets.map((entry) => entry.id));
const nextSideBetIds = new Set(nextSideBets.map((entry) => entry.id));

return {
  deals: ...,
  discards: ...,
  sideBetDeals: nextSideBets.filter((entry) => !previousSideBetIds.has(entry.id)).map((entry) => ({ ...entry, source: 'pending-bet' })),
  sideBetResolves: previousSideBets.filter((entry) => !nextSideBetIds.has(entry.id)).map((entry) => ({ ...entry, target: 'dealer-hand' }))
};
```

- [ ] **Step 2: Thread side-bet events through `useBlackjackMotion`**

Update the event builder:

```jsx
const nextEvents = [
  ...diff.deals.map((entry) => ({ ...entry, type: 'deal', id: `deal-${entry.id}-${Date.now()}` })),
  ...diff.discards.map((entry) => ({ ...entry, type: 'discard', id: `discard-${entry.id}-${Date.now()}` })),
  ...diff.sideBetDeals.map((entry) => ({ ...entry, type: 'sidebet-deal', id: `sidebet-deal-${entry.id}-${Date.now()}` })),
  ...diff.sideBetResolves.map((entry) => ({ ...entry, type: 'sidebet-resolve', id: `sidebet-resolve-${entry.id}-${Date.now()}` }))
];
```

- [ ] **Step 3: Render chip flights**

Update `BlackjackMotionLayer.jsx`:

```jsx
{rendered.map((event) => (
  event.type.startsWith('sidebet')
    ? <div key={event.id} className={`blackjack-flight-chip is-${event.type}`} style={{ ... }} />
    : <div key={event.id} className={`blackjack-flight-card is-${event.type}`} style={{ ... }} />
))}
```

- [ ] **Step 4: Add chip flight styling**

Append to `src/features/blackjack/blackjack.css`:

```css
.blackjack-flight-chip {
  position: fixed;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #fdf2f8, #ec4899 60%, #9d174d 100%);
  box-shadow: 0 10px 20px rgba(0,0,0,0.28);
}

.blackjack-flight-chip.is-sidebet-deal {
  animation: blackjackFlightChipToBet 620ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.blackjack-flight-chip.is-sidebet-resolve {
  animation: blackjackFlightChipResolve 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes blackjackFlightChipToBet {
  0% { transform: translate(var(--from-x), var(--from-y)) scale(0.82); opacity: 0.92; }
  100% { transform: translate(var(--to-x), var(--to-y)) scale(1); opacity: 1; }
}

@keyframes blackjackFlightChipResolve {
  0% { transform: translate(var(--from-x), var(--from-y)) scale(1); opacity: 1; }
  100% { transform: translate(var(--to-x), var(--to-y)) scale(0.9); opacity: 0.88; }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/features/blackjack/utils/motionDiff.js src/features/blackjack/hooks/useBlackjackMotion.js src/features/blackjack/components/BlackjackMotionLayer.jsx src/features/blackjack/blackjack.css
git commit -m "feat: add blackjack side-bet chip motion"
```

### Task 7: Add Dealer Callouts and Table Limits

**Files:**
- Modify: `src/features/blackjack/components/BlackjackDealer.jsx`
- Modify: `src/features/blackjack/components/BlackjackTable.jsx`
- Modify: `src/features/blackjack/blackjack.css`

- [ ] **Step 1: Replace generic dealer copy with phase callouts already supported by room state**

Update `BlackjackDealer.jsx`:

```jsx
function getDealerStatusText(roomState) {
  if (roomState?.status === 'betting' || roomState?.status === 'waiting') return 'Waiting for bets';
  if (roomState?.status === 'dealing') return 'Dealing';
  if (roomState?.status === 'dealer_turn') {
    if (roomState?.dealerPhase === 'reveal') return 'Dealer reveals hole card';
    if (roomState?.dealerPhase === 'draw') return 'Dealer draws';
    if (roomState?.dealerPhase === 'stand') return 'Dealer stands';
    if (roomState?.dealerPhase === 'bust') return 'Dealer busts';
  }
  if (roomState?.status === 'settlement') return 'Settling bets';
  return 'Waiting for bets';
}
```

- [ ] **Step 2: Add visible table minimum/maximum metadata**

Update `BlackjackTable.jsx`:

```jsx
<div className="blackjack-status-pills">
  <div className="blackjack-status-pill">Status: {STATUS_LABELS[roomState?.status] || 'Unbekannt'}</div>
  <div className="blackjack-status-pill">Tisch: Min 1 KC / Max 1.000.000 KC</div>
  <div className="blackjack-status-pill">Shoe: {roomState?.shoeRemaining ?? 0} Karten</div>
  <div className={`blackjack-status-pill${roomState?.needsShuffle ? ' is-alert' : ''}`}>
```

- [ ] **Step 3: Give dealer/status panels a stronger casino finish**

Update `src/features/blackjack/blackjack.css`:

```css
.blackjack-dealer-status {
  font-weight: 900;
  color: #facc15;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.74rem;
  text-shadow: 0 0 18px rgba(250,204,21,0.14);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/features/blackjack/components/BlackjackDealer.jsx src/features/blackjack/components/BlackjackTable.jsx src/features/blackjack/blackjack.css
git commit -m "feat: polish blackjack dealer callouts"
```

### Task 8: Final Verification

**Files:**
- Verify only

- [ ] **Step 1: Run blackjack regression scripts**

Run:

```bash
node tests/blackjackTimingFlow.test.js
node tests/blackjackGameplayRules.test.js
node tests/blackjackJoinLeavePhases.test.js
node tests/blackjackActions.test.js
node tests/blackjackSideBets.test.js
node tests/blackjackSettlement.test.js
node tests/blackjackRoundFlow.test.js
node tests/blackjackSpectatorUi.test.js
node tests/blackjackResponsiveLayout.test.js
node tests/blackjackMotionDiff.test.js
```

Expected: all PASS

- [ ] **Step 2: Run production build**

Run: `npm run build`  
Expected: Vite build succeeds with no JSX/CSS errors.

- [ ] **Step 3: Restart local server**

Run: `./restart_server.sh`  
Expected: server starts on port `3001`.

- [ ] **Step 4: Verify HTTP health**

Run: `curl -I http://127.0.0.1:3001/`  
Expected: `HTTP/1.1 200 OK`

- [ ] **Step 5: Browser verification checklist**

Open `/games/blackjack` and verify:

- At wide layout, the full table arc remains intact.
- Around laptop widths, Seat 1/2/3 do not overlap.
- In compact mode, chip tray/action buttons stay within the local seat footprint.
- Side bets remain readable and clickable.
- Cards visibly travel from shoe to hand.
- Cards visibly travel from hands to discard at the end of a round.
- Side-bet chips visibly move when set and resolve.
- Dealer callouts match room phases.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: complete blackjack responsive casino polish"
```

