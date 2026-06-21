# Casino Shared Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract duplicated casino logic (formatters, timers, socket actions, balance sync, settlement UI, celebration) into shared `src/features/casino/` modules used by both blackjack and roulette.

**Architecture:** New files land in `src/features/casino/{hooks,components}/`. Each file has one responsibility. Game-specific hooks/components import from `casino/` rather than reimplementing. No shared state between games — only shared utilities and presentational components.

**Tech Stack:** React 18, Socket.IO client, ES modules

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `src/features/casino/formatters.js` | `formatKC(cents)` shared currency formatter |
| `src/features/casino/hooks/useCountdownTimer.js` | Generic deadline-ms → seconds-left countdown |
| `src/features/casino/hooks/useSocketAction.js` | `socket.emit` + ACK → Promise wrapper with error toast |
| `src/features/casino/hooks/useCasinoBalance.js` | `COIN_BALANCE_UPDATE` socket listener → `setUser` |
| `src/features/casino/components/SettlementToast.jsx` | Generic win/loss/push result overlay |
| `src/features/casino/components/CelebrationOverlay.jsx` | Generic confetti celebration with custom message |

### Modified files
| File | Change |
|------|--------|
| `src/features/blackjack/utils/formatters.js` | Re-export `formatKC` from casino; keep `buildRealisticStack`, etc. |
| `src/features/blackjack/components/SettlementToast.jsx` | Use shared `SettlementToast` |
| `src/features/blackjack/components/BlackjackCelebration.jsx` | Use shared `CelebrationOverlay` |
| `src/features/blackjack/hooks/useBlackjackRoom.js` | Use `useCasinoBalance`; keep `runSocketAction` (blackjack-specific due to `waitForSocketConnection`) |
| `src/features/blackjack/hooks/useBlackjackTimers.js` | Use `useCountdownTimer` |
| `src/features/roulette/hooks/useRouletteGame.js` | Use `useSocketAction`, `useCasinoBalance` |
| `src/features/roulette/components/RouletteSettlement.jsx` | Use shared `SettlementToast` |
| `src/features/roulette/components/RoulettePhaseBar.jsx` | Use `useCountdownTimer` (seconds computed here → pass deadline instead) |

---

## Task 1: Extract `formatKC` to shared formatters

**Files:**
- Create: `src/features/casino/formatters.js`
- Modify: `src/features/blackjack/utils/formatters.js` (lines 1-9 → re-export)
- Modify: `src/features/roulette/components/RouletteSettlement.jsx` (add import)

- [ ] **Step 1: Create `src/features/casino/formatters.js`**

```js
export function formatKC(cents) {
  return `${(cents / 100).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} KC`;
}
```

- [ ] **Step 2: Update `src/features/blackjack/utils/formatters.js` — replace the function with a re-export**

Find and replace only the `formatKC` export (lines 1-9 currently define it):

```js
export { formatKC } from '../casino/formatters';
export { CHIP_VALUES } from '../casino/chipConfig';
// ... rest of file unchanged (buildChipBreakdown, buildRealisticStack, buildRealisticGroups, normalizeRoomSlug)
```

> Note: `CHIP_VALUES` was already made a re-export in the chips refactor. Keep that line.

- [ ] **Step 3: Update `src/features/roulette/components/RouletteSettlement.jsx` — add formatKC import**

`RouletteSettlement` currently renders `{Math.abs(myResult.displayChange)} KC` inline. Replace with `formatKC`:

```jsx
import { formatKC } from '../../casino/formatters';
// ...
<div className="settlement-toast__result">
  {won ? '▲' : '▼'} {formatKC(Math.abs(myResult.displayChange) * 100)}
</div>
```

> Note: `displayChange` is in KC (not cents). Multiply by 100 before passing to `formatKC`, or add a `formatKCFromKC` helper. Check the actual unit by reading `RouletteSettlement.jsx` line 17 before editing — if `displayChange` is already in cents, skip the `* 100`.

- [ ] **Step 4: Verify build passes**

```bash
cd /Users/justus/Documents/KoalaGit/Antigrav && npm run build 2>&1 | tail -20
```

Expected: no errors referencing `formatKC`.

- [ ] **Step 5: Commit**

```bash
git add src/features/casino/formatters.js src/features/blackjack/utils/formatters.js src/features/roulette/components/RouletteSettlement.jsx
git commit -m "refactor: extract formatKC to casino/formatters, share between blackjack and roulette"
```

---

## Task 2: Create `useCountdownTimer` hook

**Files:**
- Create: `src/features/casino/hooks/useCountdownTimer.js`
- Modify: `src/features/blackjack/hooks/useBlackjackTimers.js`
- Modify: `src/features/roulette/hooks/useRouletteGame.js` (seconds computed in state handler → expose `deadlineAt`)

- [ ] **Step 1: Create `src/features/casino/hooks/useCountdownTimer.js`**

```js
import { useEffect, useState } from 'react';

/**
 * Returns seconds remaining until `deadlineMs` (epoch ms).
 * Returns `null` when deadlineMs is falsy.
 * Ticks every second.
 */
export function useCountdownTimer(deadlineMs) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadlineMs) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [deadlineMs]);

  if (!deadlineMs) return null;
  return Math.max(0, Math.ceil((deadlineMs - now) / 1000));
}
```

- [ ] **Step 2: Update `src/features/blackjack/hooks/useBlackjackTimers.js`**

Replace the internal `now` state + interval with `useCountdownTimer`. The hook must still return `{ autoStartSeconds, now, turnCountdownSeconds }` for backward compat.

```js
import { useEffect, useState } from 'react';
import { useCountdownTimer } from '../../casino/hooks/useCountdownTimer';

export function useBlackjackTimers(roomState) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const defaultTurnSeconds = Math.round((roomState?.timerConfig?.turnTimeoutMs || 90000) / 1000);

  const turnDeadline = roomState?.status === 'player_turns' ? roomState?.turnDeadlineAt : null;
  const turnCountdown = useCountdownTimer(turnDeadline);
  const turnCountdownSeconds = turnCountdown ?? defaultTurnSeconds;

  const autoStartDeadline = ['waiting', 'betting'].includes(roomState?.status) ? roomState?.autoStartAt : null;
  const autoStartSeconds = useCountdownTimer(autoStartDeadline);

  return { autoStartSeconds, now, turnCountdownSeconds };
}
```

- [ ] **Step 3: Verify `useBlackjackTimers` callers unchanged**

```bash
grep -rn "useBlackjackTimers\|turnCountdownSeconds\|autoStartSeconds" /Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/src/features/blackjack/
```

Confirm all call sites still receive `{ autoStartSeconds, now, turnCountdownSeconds }`.

- [ ] **Step 4: Update `src/features/roulette/components/RoulettePhaseBar.jsx`**

Currently `RoulettePhaseBar` receives a `secondsLeft` prop computed by the parent. The `secondsLeft` prop API is fine — no change needed in `RoulettePhaseBar` itself.

Instead update `src/features/roulette/hooks/useRouletteGame.js` to expose `phaseDeadlineAt` from room state, and the caller (`Roulette.jsx`) to use `useCountdownTimer` to compute `secondsLeft`:

In `useRouletteGame.js`, add to return value:
```js
phaseDeadlineAt: roomState?.phaseDeadlineAt ?? null,
```

In `src/pages/Roulette.jsx` (or wherever `RoulettePhaseBar` is rendered), replace whatever manual `secondsLeft` computation exists with:
```jsx
import { useCountdownTimer } from '../features/casino/hooks/useCountdownTimer';
// ...
const secondsLeft = useCountdownTimer(phaseDeadlineAt) ?? 0;
```

> Verify the field name: grep `phaseDeadlineAt` or `deadline` in the roulette room state to confirm the exact server field name before editing.

- [ ] **Step 5: Verify build passes**

```bash
cd /Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app && npm run build 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
git add src/features/casino/hooks/useCountdownTimer.js src/features/blackjack/hooks/useBlackjackTimers.js src/features/roulette/hooks/useRouletteGame.js src/pages/Roulette.jsx
git commit -m "refactor: extract useCountdownTimer to casino/hooks, use in blackjack and roulette"
```

---

## Task 3: Create `useSocketAction` hook (apply to roulette)

**Files:**
- Create: `src/features/casino/hooks/useSocketAction.js`
- Modify: `src/features/roulette/hooks/useRouletteGame.js`

> Blackjack keeps its own `runSocketAction` — it wraps `waitForSocketConnection` which is too blackjack-specific to share right now. Roulette benefits directly.

- [ ] **Step 1: Create `src/features/casino/hooks/useSocketAction.js`**

```js
import { useCallback } from 'react';

/**
 * Returns an `emit(event, payload, fallbackError)` function.
 * Resolves with the ACK response on success.
 * On failure: calls showToast with ack.error or fallbackError, rejects.
 */
export function useSocketAction(socket, showToast) {
  return useCallback((event, payload = {}, fallbackError = 'Action failed') => {
    return new Promise((resolve, reject) => {
      if (!socket) {
        showToast('Keine Verbindung', 'error');
        return reject(new Error('No socket'));
      }
      socket.emit(event, payload, (ack) => {
        if (!ack?.success) {
          showToast(ack?.error || fallbackError, 'error');
          return reject(new Error(ack?.error || fallbackError));
        }
        resolve(ack);
      });
    });
  }, [socket, showToast]);
}
```

- [ ] **Step 2: Refactor `src/features/roulette/hooks/useRouletteGame.js` — add import and emit helper**

At the top of `useRouletteGame`, after existing imports:
```js
import { useSocketAction } from '../../casino/hooks/useSocketAction';
```

Inside `useRouletteGame({ socket, user, showToast })`, add near the top of the function body:
```js
const emit = useSocketAction(socket, showToast);
```

- [ ] **Step 3: Replace inline socket.emit calls in `useRouletteGame.js`**

Replace each `socket.emit(EVENT, payload, (ack) => { if (!ack?.success) showToast(...) })` pattern:

**`handleJoin` (line ~120):**
```js
// Before:
socket.emit(EVENTS.ROULETTE_JOIN, {}, (ack) => {
  setBusy(false);
  if (!ack?.success) showToast(ack?.error || 'Failed to join', 'error');
});

// After:
emit(EVENTS.ROULETTE_JOIN, {}, 'Failed to join')
  .finally(() => setBusy(false))
  .catch(() => {});
```

**`handleLeave` (line ~129):**
```js
// Before:
socket.emit(EVENTS.ROULETTE_LEAVE, {}, (ack) => {
  setBusy(false);
  if (!ack?.success) showToast(ack?.error || 'Failed to leave', 'error');
});

// After:
emit(EVENTS.ROULETTE_LEAVE, {}, 'Failed to leave')
  .finally(() => setBusy(false))
  .catch(() => {});
```

**`handlePlaceBet` (line ~141):**
```js
// Before:
socket.emit(EVENTS.ROULETTE_PLACE_BET, { betType, amount: selectedChip }, (ack) => {
  if (!ack?.success) showToast(ack?.error || 'Bet failed', 'error');
});

// After:
emit(EVENTS.ROULETTE_PLACE_BET, { betType, amount: selectedChip }, 'Bet failed').catch(() => {});
```

**`handleRebet` (each forEach emit, line ~153):**
```js
// Before:
lastBets.forEach(({ betType, amount }) => {
  socket.emit(EVENTS.ROULETTE_PLACE_BET, { betType, amount }, (ack) => {
    if (!ack?.success) showToast(ack?.error || `Rebet failed: ${betType}`, 'error');
  });
});

// After:
lastBets.forEach(({ betType, amount }) => {
  emit(EVENTS.ROULETTE_PLACE_BET, { betType, amount }, `Rebet failed: ${betType}`).catch(() => {});
});
```

**`handleRemoveBet` (line ~162):**
```js
// Before:
socket.emit(EVENTS.ROULETTE_REMOVE_BET, { betType }, (ack) => {
  if (!ack?.success) showToast(ack?.error || 'Remove failed', 'error');
});

// After:
emit(EVENTS.ROULETTE_REMOVE_BET, { betType }, 'Remove failed').catch(() => {});
```

**`handleReady` (line ~186):**
```js
// Before:
socket.emit(EVENTS.ROULETTE_READY, {}, (ack) => {
  if (!ack?.success) showToast(ack?.error || 'Ready failed', 'error');
});

// After:
emit(EVENTS.ROULETTE_READY, {}, 'Ready failed').catch(() => {});
```

**Autobet inline emits (inside state effect, lines ~71, ~174):** Leave these using `socket?.emit` directly — they fire inside a `setTimeout` / `setAutobet` callback where `emit` from the hook closure may not be accessible. Add a comment:
```js
// Direct emit here: autobet fires inside setState callback where `emit` closure is stale.
socket?.emit(EVENTS.ROULETTE_PLACE_BET, { betType, amount }, (ack) => {
  if (!ack?.success) showToast(ack?.error || `Autobet failed: ${betType}`, 'error');
});
```

- [ ] **Step 4: Verify build passes**

```bash
cd /Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app && npm run build 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add src/features/casino/hooks/useSocketAction.js src/features/roulette/hooks/useRouletteGame.js
git commit -m "refactor: extract useSocketAction to casino/hooks, apply to roulette"
```

---

## Task 4: Create `useCasinoBalance` hook

**Files:**
- Create: `src/features/casino/hooks/useCasinoBalance.js`
- Modify: `src/features/blackjack/hooks/useBlackjackRoom.js`
- Modify: `src/features/roulette/hooks/useRouletteGame.js`

- [ ] **Step 1: Create `src/features/casino/hooks/useCasinoBalance.js`**

```js
import { useCallback, useEffect } from 'react';
import EVENTS from '../../../../socketEvents.json';

export function useCasinoBalance(socket, setUser) {
  const syncBalance = useCallback((balance) => {
    if (!Number.isFinite(balance)) return;
    setUser((prev) => (prev ? { ...prev, koala_balance: balance } : prev));
  }, [setUser]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = ({ balance }) => syncBalance(balance);
    socket.on(EVENTS.COIN_BALANCE_UPDATE, handleUpdate);
    return () => socket.off(EVENTS.COIN_BALANCE_UPDATE, handleUpdate);
  }, [socket, syncBalance]);
}
```

- [ ] **Step 2: Update `src/features/blackjack/hooks/useBlackjackRoom.js`**

Add import at top:
```js
import { useCasinoBalance } from '../../casino/hooks/useCasinoBalance';
```

Find and remove the `syncBalance` callback definition (line ~78-81):
```js
// REMOVE THIS:
const syncBalance = useCallback((balance) => {
  if (!Number.isFinite(balance)) return;
  setUser((prev) => (prev ? { ...prev, koala_balance: balance } : prev));
}, [setUser]);
```

Find and remove the `COIN_BALANCE_UPDATE` effect (lines ~299-303):
```js
// REMOVE THIS:
useEffect(() => {
  const handleCoinUpdate = ({ balance }) => syncBalance(balance);
  socket?.on(EVENTS.COIN_BALANCE_UPDATE, handleCoinUpdate);
  return () => socket?.off(EVENTS.COIN_BALANCE_UPDATE, handleCoinUpdate);
}, [socket, syncBalance]);
```

Replace both with one hook call inside `useBlackjackRoom` function body:
```js
useCasinoBalance(socket, setUser);
```

Remove `syncBalance` from any `useCallback` dependency arrays if it appears.

- [ ] **Step 3: Update `src/features/roulette/hooks/useRouletteGame.js`**

Add import:
```js
import { useCasinoBalance } from '../../casino/hooks/useCasinoBalance';
```

Roulette currently doesn't listen to `COIN_BALANCE_UPDATE`. Add one line inside `useRouletteGame`:
```js
useCasinoBalance(socket, setUser);
```

> Note: `useRouletteGame` receives `{ socket, user, showToast }` — confirm it also receives `setUser` or add it to the destructured params. Check the call site in `Roulette.jsx` to confirm `setUser` is available.

- [ ] **Step 4: Verify build passes**

```bash
cd /Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app && npm run build 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add src/features/casino/hooks/useCasinoBalance.js src/features/blackjack/hooks/useBlackjackRoom.js src/features/roulette/hooks/useRouletteGame.js
git commit -m "refactor: extract useCasinoBalance to casino/hooks, use in both games"
```

---

## Task 5: Create shared `SettlementToast` component

**Files:**
- Create: `src/features/casino/components/SettlementToast.jsx`
- Modify: `src/features/blackjack/components/SettlementToast.jsx`
- Modify: `src/features/roulette/components/RouletteSettlement.jsx`

- [ ] **Step 1: Create `src/features/casino/components/SettlementToast.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { formatKC } from '../formatters';

/**
 * Generic casino settlement result overlay.
 *
 * Props:
 *   netChangeCents  number   Net win/loss in cents. Positive=win, negative=loss, 0=push.
 *   isPush          boolean  Force "PUSH" label when netChangeCents is 0.
 *   badge           ReactNode  Optional extra content (e.g. spin number badge).
 *   autoHideMs      number   If set, auto-hides after this many ms when netChangeCents changes.
 *   className       string   Extra CSS class on root element.
 */
export default function SettlementToast({ netChangeCents, isPush = false, badge, autoHideMs, className = '' }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!autoHideMs || netChangeCents === undefined) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), autoHideMs);
    return () => clearTimeout(t);
  }, [netChangeCents, autoHideMs]);

  if (!visible) return null;

  let label = '';
  let color = '#fbbf24';

  if (netChangeCents > 0) {
    label = `+${formatKC(netChangeCents)}`;
    color = '#4ade80';
  } else if (netChangeCents < 0) {
    label = formatKC(netChangeCents);
    color = '#f87171';
  } else if (isPush) {
    label = 'PUSH';
    color = '#fbbf24';
  } else {
    return null;
  }

  return (
    <div className={`casino-settlement-toast ${className}`.trim()}>
      {badge && <div className="casino-settlement-toast__badge">{badge}</div>}
      <div className="casino-settlement-toast__glow" style={{ '--toast-color': color }} />
      <div className="casino-settlement-toast__text" style={{ color }}>{label}</div>
    </div>
  );
}
```

- [ ] **Step 2: Update `src/features/blackjack/components/SettlementToast.jsx`**

Replace the entire file with a thin wrapper:

```jsx
import CasinoSettlementToast from '../../casino/components/SettlementToast';

export default function SettlementToast({ settlements }) {
  if (!settlements || settlements.length === 0) return null;

  const totalNet = settlements.reduce((sum, s) => sum + (Number(s.netProfit) || 0), 0);
  const isPush = settlements.every((s) => s.result === 'push');

  return (
    <CasinoSettlementToast
      netChangeCents={totalNet}
      isPush={isPush}
      className="blackjack-settlement-toast"
    />
  );
}
```

- [ ] **Step 3: Update `src/features/roulette/components/RouletteSettlement.jsx`**

```jsx
import React from 'react';
import CasinoSettlementToast from '../../casino/components/SettlementToast';

export default function RouletteSettlement({ settlement, userId, spinResult }) {
  const myResult = settlement?.find(s => String(s.playerId) === String(userId));
  if (!myResult) return null;

  const badge = spinResult && (
    <span className={`settlement-number-badge settlement-number-badge--${spinResult.color}`}>
      {spinResult.number}
    </span>
  );

  return (
    <CasinoSettlementToast
      netChangeCents={myResult.displayChange * 100}
      badge={badge}
      autoHideMs={4000}
      className="settlement-toast"
    />
  );
}
```

> **Unit check:** Confirm whether `myResult.displayChange` is in cents or KC before applying `* 100`. If already in cents, drop the multiplier.

- [ ] **Step 4: Add CSS for shared component**

The shared component uses class names `casino-settlement-toast`, `casino-settlement-toast__badge`, `casino-settlement-toast__glow`, `casino-settlement-toast__text`.

Find where blackjack's `.blackjack-settlement-toast` styles live:
```bash
grep -rn "blackjack-settlement-toast" /Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/src/ --include="*.css"
```

Copy the core glow + text styles to a shared CSS file (or add to existing casino CSS if one exists). The `.blackjack-settlement-toast` wrapper class keeps blackjack's positioning styles intact via the `className` prop.

- [ ] **Step 5: Verify build passes**

```bash
cd /Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app && npm run build 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
git add src/features/casino/components/SettlementToast.jsx src/features/blackjack/components/SettlementToast.jsx src/features/roulette/components/RouletteSettlement.jsx
git commit -m "refactor: extract SettlementToast to casino/components, use in blackjack and roulette"
```

---

## Task 6: Create `CelebrationOverlay` shared component

**Files:**
- Create: `src/features/casino/components/CelebrationOverlay.jsx`
- Modify: `src/features/blackjack/components/BlackjackCelebration.jsx`

- [ ] **Step 1: Create `src/features/casino/components/CelebrationOverlay.jsx`**

```jsx
/**
 * Generic confetti celebration overlay.
 *
 * Props:
 *   active    boolean  Show overlay when true.
 *   message   string   Text to display (e.g. "BLACKJACK!", "WINNER!").
 *   colors    string[] Optional confetti color array. Defaults to gold palette.
 *   count     number   Particle count. Default 16.
 */
export default function CelebrationOverlay({
  active,
  message,
  colors = ['#fbbf24', '#f59e0b', '#fcd34d', '#fff'],
  count = 16,
}) {
  if (!active) return null;

  return (
    <div className="casino-celebration-overlay">
      <div className="casino-confetti-container">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="casino-confetti-particle"
            style={{
              '--angle': `${i * (360 / count)}deg`,
              '--delay': `${i * 20}ms`,
              '--color': colors[i % colors.length],
            }}
          />
        ))}
      </div>
      {message && <div className="casino-celebration-text">{message}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Update `src/features/blackjack/components/BlackjackCelebration.jsx`**

```jsx
import CelebrationOverlay from '../../casino/components/CelebrationOverlay';

export default function BlackjackCelebration({ active }) {
  return (
    <CelebrationOverlay
      active={active}
      message="BLACKJACK!"
    />
  );
}
```

- [ ] **Step 3: Update CSS class names**

Find where `.blackjack-celebration-overlay`, `.confetti-container`, `.confetti-particle`, `.blackjack-pop-text` are defined:
```bash
grep -rn "blackjack-celebration\|confetti-container\|confetti-particle\|blackjack-pop-text" /Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app/src/ --include="*.css"
```

Add aliases for the new shared class names in the same CSS file (or copy to a casino CSS):
```css
.casino-celebration-overlay { /* same as .blackjack-celebration-overlay */ }
.casino-confetti-container { /* same as .confetti-container */ }
.casino-confetti-particle { /* same as .confetti-particle */ }
.casino-celebration-text { /* same as .blackjack-pop-text */ }
```

Keep old class names in place — other CSS selectors or animations may still reference them.

- [ ] **Step 4: Verify build passes**

```bash
cd /Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app && npm run build 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add src/features/casino/components/CelebrationOverlay.jsx src/features/blackjack/components/BlackjackCelebration.jsx
git commit -m "refactor: extract CelebrationOverlay to casino/components, use in blackjack"
```

---

## Self-Review

### Spec Coverage

| Candidate | Task |
|-----------|------|
| formatKC | Task 1 ✓ |
| useCountdownTimer | Task 2 ✓ |
| useSocketAction (roulette) | Task 3 ✓ |
| useCasinoBalance | Task 4 ✓ |
| SettlementToast | Task 5 ✓ |
| CelebrationOverlay | Task 6 ✓ |
| Phase label/color maps | Not extracted — phases are game-specific (player_turns vs betting_open). The shared RoulettePhaseBar receives config as props already. Low value. |
| Auto-bet/rebet hook | Not extracted — blackjack uses server-side autobet; roulette uses client-side. Different patterns, not truly shared. |

### Placeholder Scan

- Task 2 Step 4: has a "verify the field name" note — intentional, needs runtime check before editing.
- Task 4 Step 3: has "confirm setUser is available" note — intentional, needs call-site check before editing.
- Task 5 Step 3: has "unit check" note — intentional, needs verification before applying multiplier.

### Type Consistency

- `netChangeCents` is used consistently as the prop name in `CasinoSettlementToast` and all call sites.
- `useCountdownTimer` returns `number | null` — callers use `?? 0` or `?? defaultSeconds` consistently.
- `useSocketAction` returns `(event, payload, fallbackError) => Promise<ack>` — all call sites `.catch(() => {})` to suppress unhandled rejections.
