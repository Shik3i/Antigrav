# Deathroll Slot Machine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign DeathrollWidget to look and animate like a retro-Vegas slot machine cabinet with vertical-scroll reels and sequential lock-in.

**Architecture:** Extract digit display into a new `SlotReels` component with genuine DOM-based reel strips (20 stacked digits per column) animated via CSS. `DeathrollWidget` keeps all socket/game logic, drops the scramble interval, and wraps `SlotReels` in a styled cabinet frame. Danger color tiers are preserved via the existing `getGlowTier()`.

**Tech Stack:** React, CSS keyframe animations, `Black Ops One` Google Font (added via `index.html`)

---

## File Map

| File | Change |
|------|--------|
| `index.html` | Add Google Fonts link for `Black Ops One` |
| `src/index.css` | Add `reel-spin`, `reel-lock-flash`, `cabinet-pulse` keyframes + utility classes |
| `src/components/SlotReels.jsx` | New component — 4 reel columns with strip animation logic |
| `src/components/DeathrollWidget.jsx` | Remove scramble interval; add cabinet frame + payline; use `<SlotReels>` |
| `tests/deathrollSlotReels.test.js` | Static source analysis tests |

---

## Task 1: Add Google Font + CSS keyframes

**Files:**
- Modify: `index.html`
- Modify: `src/index.css`

- [ ] **Step 1: Add Black Ops One font to index.html**

In `index.html`, inside `<head>`, after the existing `<link rel="manifest">` line, add:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Black+Ops+One&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Add CSS keyframes and utility classes to index.css**

Append to the end of `src/index.css` (before the closing of the file, after the last rule):

```css
/* ─── Deathroll Slot Machine ─── */

@keyframes reel-spin {
  from { transform: translateY(0); }
  to   { transform: translateY(-740px); } /* 10 digits × 74px */
}

@keyframes reel-lock-flash {
  0%   { opacity: 1; filter: brightness(1); }
  35%  { opacity: 0.55; filter: brightness(2.2); }
  100% { opacity: 1; filter: brightness(1); }
}

@keyframes cabinet-pulse {
  0%, 100% { box-shadow: 0 12px 30px rgba(239, 68, 68, 0.18); }
  50%       { box-shadow: 0 12px 44px rgba(239, 68, 68, 0.46), 0 0 60px rgba(239, 68, 68, 0.18); }
}

.reel-strip--spinning {
  animation: reel-spin 0.35s linear infinite;
}

.reel-column--locking {
  animation: reel-lock-flash 0.32s ease;
}

.deathroll-cabinet--critical {
  animation: cabinet-pulse 1.3s ease-in-out infinite;
}
```

- [ ] **Step 3: Build to verify no CSS errors**

```bash
cd /Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app && npm run build 2>&1 | tail -10
```

Expected: build succeeds, no errors about CSS syntax.

- [ ] **Step 4: Commit**

```bash
git add index.html src/index.css
git commit -m "feat: add Black Ops One font and slot machine CSS keyframes"
```

---

## Task 2: Create SlotReels component

**Files:**
- Create: `src/components/SlotReels.jsx`

**Component contract:**
- Props: `value` (number — the current max, padded to 4 digits), `tier` (glowTier object from `getGlowTier()`), `isRolling` (bool)
- Renders 4 reel columns. Each column has a vertical strip of 20 digits (0–9 twice).
- `targetY(digit)` = `-((digit + 10) * 74)` — uses second occurrence so strip always scrolls through first set before landing.
- Reel states per column: `'idle'` → `'spinning'` → `'locking'` → `'locked'`
- When `isRolling` becomes `true`: all 4 reels go to `'spinning'`.
- After 1400ms: reels lock sequentially at +0ms, +160ms, +320ms, +480ms offsets. Each locking reel: state → `'locking'` (plays flash), after 320ms → `'locked'`.
- When `isRolling` becomes `false` (at 2200ms from parent): snap all to `'locked'`.

- [ ] **Step 1: Write the failing test**

Create `tests/deathrollSlotReels.test.js`:

```js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'SlotReels.jsx'),
  'utf8'
);

// Structural checks
assert(src.includes('STRIP_DIGITS'), 'Must define STRIP_DIGITS array');
assert(src.includes('reel-strip--spinning'), 'Must apply reel-strip--spinning CSS class during spin');
assert(src.includes('reel-column--locking'), 'Must apply reel-column--locking CSS class on lock');
assert(src.includes('targetY'), 'Must define targetY function for translateY calculation');
assert(src.includes('+ 10) * 74'), 'targetY must use second digit occurrence (index + 10) × 74px');
assert(src.includes('1400'), 'Must schedule lock-in start at 1400ms');
assert(src.includes('160'), 'Must stagger lock-in by 160ms per reel');
assert(src.includes("export default SlotReels"), 'Must export SlotReels as default');

// Props
assert(src.includes('value'), 'Must accept value prop');
assert(src.includes('tier'), 'Must accept tier prop');
assert(src.includes('isRolling'), 'Must accept isRolling prop');

// Cleanup
assert(src.includes('clearTimers') || src.includes('clearTimeout'), 'Must clean up timers on unmount/re-run');

console.log('All SlotReels tests passed.');
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app && npx jest tests/deathrollSlotReels.test.js 2>&1 | tail -15
```

Expected: FAIL — "Cannot find module" or assertion error because `SlotReels.jsx` doesn't exist yet.

- [ ] **Step 3: Create SlotReels.jsx**

Create `src/components/SlotReels.jsx`:

```jsx
import React, { useEffect, useRef, useState } from 'react';

const REEL_HEIGHT = 74;
const STRIP_DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const LOCK_START = 1400;
const LOCK_INTERVAL = 160;
const FLASH_DURATION = 320;

const targetY = (digit) => -((digit + 10) * REEL_HEIGHT);

const clearTimers = (ref) => {
    ref.current.forEach(clearTimeout);
    ref.current = [];
};

const SlotReels = ({ value, tier, isRolling }) => {
    const paddedValue = String(value).padStart(4, '0');
    const digits = paddedValue.split('').map(Number);
    const [reelStates, setReelStates] = useState(['idle', 'idle', 'idle', 'idle']);
    const timersRef = useRef([]);

    useEffect(() => {
        if (isRolling) {
            clearTimers(timersRef);
            setReelStates(['spinning', 'spinning', 'spinning', 'spinning']);

            digits.forEach((_, i) => {
                const t1 = setTimeout(() => {
                    setReelStates(prev => {
                        const next = [...prev];
                        next[i] = 'locking';
                        return next;
                    });
                    const t2 = setTimeout(() => {
                        setReelStates(prev => {
                            const next = [...prev];
                            next[i] = 'locked';
                            return next;
                        });
                    }, FLASH_DURATION);
                    timersRef.current.push(t2);
                }, LOCK_START + i * LOCK_INTERVAL);
                timersRef.current.push(t1);
            });
        } else {
            clearTimers(timersRef);
            setReelStates(['locked', 'locked', 'locked', 'locked']);
        }

        return () => clearTimers(timersRef);
    }, [isRolling]); // eslint-disable-line react-hooks/exhaustive-deps

    const isActive = (digit, index) => {
        const firstActiveIndex = paddedValue.search(/[1-9]/);
        return firstActiveIndex === -1 ? false : index >= firstActiveIndex;
    };

    return (
        <div style={{ display: 'flex', gap: '4px', position: 'relative' }}>
            {digits.map((digit, i) => {
                const state = reelStates[i];
                const active = isActive(digit, i);
                const isSpinning = state === 'spinning';
                const isLocking = state === 'locking';

                return (
                    <div
                        key={i}
                        className={isLocking ? 'reel-column--locking' : undefined}
                        style={{
                            width: 52,
                            height: REEL_HEIGHT,
                            overflow: 'hidden',
                            borderRadius: 4,
                            border: `1px solid ${active ? tier.border : 'rgba(255,255,255,0.06)'}`,
                            background: active
                                ? tier.surface
                                : 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.015) 100%)',
                            boxShadow: active ? tier.slotGlow : 'inset 0 1px 0 rgba(255,255,255,0.03)',
                            position: 'relative',
                        }}
                    >
                        <div
                            className={isSpinning ? 'reel-strip--spinning' : undefined}
                            style={{
                                position: 'absolute',
                                top: 0,
                                width: '100%',
                                transform: !isSpinning ? `translateY(${targetY(digit)}px)` : undefined,
                                transition: isLocking ? 'none' : undefined,
                            }}
                        >
                            {STRIP_DIGITS.map((d, j) => (
                                <div
                                    key={j}
                                    style={{
                                        height: REEL_HEIGHT,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontFamily: "'Black Ops One', serif",
                                        fontSize: '2.8rem',
                                        color: active ? tier.digitColor : 'rgba(255,255,255,0.22)',
                                        textShadow: active ? tier.textShadow : 'none',
                                        WebkitFontSmoothing: 'antialiased',
                                    }}
                                >
                                    {d}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default SlotReels;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app && npx jest tests/deathrollSlotReels.test.js 2>&1 | tail -10
```

Expected: `All SlotReels tests passed.`

- [ ] **Step 5: Build check**

```bash
npm run build 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/SlotReels.jsx tests/deathrollSlotReels.test.js
git commit -m "feat: add SlotReels component with vertical-scroll reel animation"
```

---

## Task 3: Rewrite DeathrollWidget with cabinet frame

**Files:**
- Modify: `src/components/DeathrollWidget.jsx`

**What changes:**
- Remove: `scrambleIntervalRef`, `rollTimeoutRef`, `settleTimeoutRef`, `lastScramble`, scramble `setInterval`, `displayValue` state (no longer needed — `SlotReels` handles display internally).
- Keep: `isRolling` state (now drives `SlotReels`), `getGlowTier()`, `isWaitingForOthers`, socket `onClick`, `deathroll.isComplete` logic.
- `isRolling` timer: set `true` when `currentMax` changes (skip first render), set `false` after 2200ms.
- New cabinet wrapper: dark background, border from `glowTier.widgetBorder`, `cabinet-pulse` class when `currentMax <= 1`.
- Title row: `☠ DEATHROLL ☠` in `Black Ops One`.
- Payline bar: absolute-positioned, sits over the reel row.
- Replace digit grid with `<SlotReels value={currentMax} tier={glowTier} isRolling={isRolling} />`.

- [ ] **Step 1: Write the failing test**

Create `tests/deathrollWidget.test.js`:

```js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'DeathrollWidget.jsx'),
  'utf8'
);

assert(!src.includes('scrambleIntervalRef'), 'Scramble interval must be removed');
assert(!src.includes('window.setInterval'), 'setInterval must be removed');
assert(src.includes('SlotReels'), 'Must render SlotReels component');
assert(src.includes("import SlotReels"), 'Must import SlotReels');
assert(src.includes('2200'), 'isRolling timer must be 2200ms');
assert(src.includes('Black Ops One'), 'Cabinet title must use Black Ops One font');
assert(src.includes('DEATHROLL'), 'Cabinet must show DEATHROLL title');
assert(src.includes('cabinet-pulse'), 'Must apply cabinet-pulse class for critical tier');
assert(src.includes('isRolling'), 'Must maintain isRolling state for SlotReels');

console.log('All DeathrollWidget tests passed.');
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app && npx jest tests/deathrollWidget.test.js 2>&1 | tail -15
```

Expected: FAIL — assertions about `scrambleIntervalRef` still present, `SlotReels` not imported.

- [ ] **Step 3: Rewrite DeathrollWidget.jsx**

Replace the entire content of `src/components/DeathrollWidget.jsx` with:

```jsx
import React, { useEffect, useRef, useState } from 'react';
import { Dices, Swords } from 'lucide-react';
import SlotReels from './SlotReels';

const getGlowTier = (currentMax) => {
    if (currentMax <= 1) {
        return {
            digitColor: '#f87171',
            textShadow: '0 0 8px rgba(248,113,113,0.6)',
            border: 'rgba(239, 68, 68, 0.55)',
            surface: 'linear-gradient(180deg, rgba(60, 18, 18, 0.78) 0%, rgba(28, 12, 14, 0.92) 100%)',
            halo: 'radial-gradient(circle at center, rgba(239, 68, 68, 0.28) 0%, rgba(239, 68, 68, 0.08) 45%, transparent 75%)',
            slotGlow: '0 0 0 1px rgba(239, 68, 68, 0.18), 0 8px 22px rgba(239, 68, 68, 0.22), inset 0 1px 0 rgba(255,255,255,0.06)',
            widgetBorder: 'rgba(239, 68, 68, 0.55)',
            widgetShadow: '0 12px 30px rgba(239, 68, 68, 0.18)',
            accentColor: '#f87171',
            headlineColor: '#fecaca',
            isCritical: true,
        };
    }

    if (currentMax <= 10) {
        return {
            digitColor: '#fb923c',
            textShadow: '0 0 6px rgba(251,146,60,0.5)',
            border: 'rgba(251, 146, 60, 0.4)',
            surface: 'linear-gradient(180deg, rgba(42, 28, 18, 0.74) 0%, rgba(21, 17, 16, 0.92) 100%)',
            halo: 'radial-gradient(circle at center, rgba(251, 146, 60, 0.18) 0%, rgba(251, 146, 60, 0.05) 45%, transparent 75%)',
            slotGlow: '0 0 0 1px rgba(251, 146, 60, 0.1), 0 8px 22px rgba(251, 146, 60, 0.14), inset 0 1px 0 rgba(255,255,255,0.06)',
            widgetBorder: 'rgba(251, 146, 60, 0.45)',
            widgetShadow: '0 10px 30px rgba(239, 68, 68, 0.16)',
            accentColor: '#fb923c',
            headlineColor: '#fed7aa',
        };
    }

    if (currentMax <= 20) {
        return {
            digitColor: '#fde047',
            textShadow: '0 0 6px rgba(253,224,71,0.4)',
            border: 'rgba(250, 204, 21, 0.35)',
            surface: 'linear-gradient(180deg, rgba(39, 34, 18, 0.74) 0%, rgba(18, 18, 16, 0.92) 100%)',
            halo: 'radial-gradient(circle at center, rgba(250, 204, 21, 0.14) 0%, rgba(250, 204, 21, 0.04) 45%, transparent 75%)',
            slotGlow: '0 0 0 1px rgba(250, 204, 21, 0.08), 0 8px 20px rgba(250, 204, 21, 0.1), inset 0 1px 0 rgba(255,255,255,0.06)',
            widgetBorder: 'rgba(250, 204, 21, 0.4)',
            widgetShadow: '0 10px 28px rgba(239, 68, 68, 0.15)',
            accentColor: '#fde047',
            headlineColor: '#fef08a',
        };
    }

    if (currentMax <= 100) {
        return {
            digitColor: '#e0f2fe',
            textShadow: '0 0 6px rgba(125,211,252,0.4)',
            border: 'rgba(125, 211, 252, 0.25)',
            surface: 'linear-gradient(180deg, rgba(18, 28, 40, 0.72) 0%, rgba(15, 17, 22, 0.92) 100%)',
            halo: 'radial-gradient(circle at center, rgba(125, 211, 252, 0.12) 0%, rgba(125, 211, 252, 0.04) 45%, transparent 75%)',
            slotGlow: '0 0 0 1px rgba(125, 211, 252, 0.07), 0 8px 20px rgba(125, 211, 252, 0.1), inset 0 1px 0 rgba(255,255,255,0.06)',
            widgetBorder: 'rgba(125, 211, 252, 0.3)',
            widgetShadow: '0 10px 28px rgba(239, 68, 68, 0.14)',
            accentColor: '#7dd3fc',
            headlineColor: 'var(--text-main)',
        };
    }

    return {
        digitColor: '#4ade80',
        textShadow: '0 0 6px rgba(74,222,128,0.4)',
        border: 'rgba(22, 163, 74, 0.35)',
        surface: 'linear-gradient(180deg, rgba(12, 26, 12, 0.72) 0%, rgba(8, 16, 8, 0.92) 100%)',
        halo: 'radial-gradient(circle at center, rgba(74, 222, 128, 0.1) 0%, rgba(74, 222, 128, 0.03) 45%, transparent 75%)',
        slotGlow: '0 0 0 1px rgba(74, 222, 128, 0.08), 0 8px 18px rgba(74, 222, 128, 0.1), inset 0 1px 0 rgba(255,255,255,0.06)',
        widgetBorder: 'rgba(22, 163, 74, 0.4)',
        widgetShadow: '0 10px 26px rgba(22, 163, 74, 0.13)',
        accentColor: '#4ade80',
        headlineColor: 'var(--text-main)',
    };
};

const DeathrollWidget = ({ deathroll, user, roomId, socket, rollEvent }) => {
    const currentMax = Number(deathroll?.currentMax) || 0;
    const [isRolling, setIsRolling] = useState(false);
    const isFirstRenderRef = useRef(true);
    const rollTimerRef = useRef(null);
    const glowTier = getGlowTier(currentMax);
    const isWaitingForOthers = deathroll?.lastRoller === user?.displayName || deathroll?.lastRoller === user?.username;

    useEffect(() => {
        if (isFirstRenderRef.current) {
            isFirstRenderRef.current = false;
            return undefined;
        }

        if (rollTimerRef.current) {
            window.clearTimeout(rollTimerRef.current);
        }

        setIsRolling(true);
        rollTimerRef.current = window.setTimeout(() => {
            setIsRolling(false);
        }, 2200);

        return () => {
            if (rollTimerRef.current) {
                window.clearTimeout(rollTimerRef.current);
            }
        };
    }, [currentMax]);

    useEffect(() => () => {
        if (rollTimerRef.current) {
            window.clearTimeout(rollTimerRef.current);
        }
    }, []);

    return (
        <div
            className={`glass-card animate-fade-in${glowTier.isCritical ? ' deathroll-cabinet--critical' : ''}`}
            style={{
                marginTop: '24px',
                padding: '18px 16px 16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                border: `1px solid ${glowTier.widgetBorder}`,
                background: 'rgba(20, 24, 30, 0.8)',
                boxShadow: glowTier.widgetShadow,
                maxWidth: '400px',
                width: '100%',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            <div style={{
                position: 'absolute',
                inset: 0,
                background: deathroll?.isComplete
                    ? 'radial-gradient(circle at center, rgba(239, 68, 68, 0.14) 0%, rgba(239, 68, 68, 0.04) 42%, transparent 72%)'
                    : 'radial-gradient(circle at center, rgba(239, 68, 68, 0.1) 0%, transparent 70%)',
                zIndex: 0,
            }} />

            {/* Cabinet title */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                zIndex: 1,
            }}>
                <Swords size={22} color={glowTier.accentColor} />
                <span style={{
                    fontFamily: "'Black Ops One', serif",
                    fontSize: '1.1rem',
                    letterSpacing: '0.18em',
                    color: glowTier.headlineColor,
                    textShadow: glowTier.isCritical ? `0 0 12px ${glowTier.accentColor}` : 'none',
                }}>
                    ☠ DEATHROLL ☠
                </span>
                <Swords size={22} color={glowTier.accentColor} />
            </div>

            {/* Last roller label */}
            <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)', zIndex: 1 }}>
                <strong style={{ color: glowTier.accentColor }}>{deathroll?.lastRoller}</strong> hat gewürfelt:
            </div>

            {/* Reel window with payline */}
            <div style={{ position: 'relative', zIndex: 1 }}>
                <SlotReels value={currentMax} tier={glowTier} isRolling={isRolling} />
                {/* Payline */}
                <div style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: '50%',
                    height: '2px',
                    background: 'rgba(250, 204, 21, 0.55)',
                    boxShadow: '0 0 6px rgba(250, 204, 21, 0.45)',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    zIndex: 2,
                }} />
            </div>

            {/* Result / button */}
            {deathroll?.isComplete ? (
                <div style={{
                    fontSize: '1.2rem',
                    fontWeight: 800,
                    color: '#fecaca',
                    textAlign: 'center',
                    marginTop: '4px',
                    zIndex: 1,
                    padding: '10px 16px',
                    background: 'rgba(239,68,68,0.14)',
                    border: '1px solid rgba(239,68,68,0.22)',
                    borderRadius: '10px',
                    width: '100%',
                }}>
                    {deathroll?.lastRoller} hat verloren!
                </div>
            ) : (
                <button
                    type="button"
                    className="btn-primary"
                    style={{
                        width: '100%',
                        justifyContent: 'center',
                        fontSize: '1.1rem',
                        padding: '16px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-main)',
                        zIndex: 1,
                    }}
                    disabled={isWaitingForOthers}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        socket.emit(rollEvent, { roomId: String(roomId) });
                    }}
                >
                    <Dices size={20} /> {isWaitingForOthers ? 'Warten auf andere...' : `Antworten (1 - ${currentMax})`}
                </button>
            )}
        </div>
    );
};

export default DeathrollWidget;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app && npx jest tests/deathrollWidget.test.js 2>&1 | tail -10
```

Expected: `All DeathrollWidget tests passed.`

- [ ] **Step 5: Run all tests**

```bash
npx jest 2>&1 | tail -20
```

Expected: all existing tests pass, no regressions.

- [ ] **Step 6: Build check**

```bash
npm run build 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/components/DeathrollWidget.jsx tests/deathrollWidget.test.js
git commit -m "feat: rewrite DeathrollWidget as retro-Vegas slot machine cabinet"
```

---

## Task 4: Visual verification

**Files:** None — read-only verification step.

- [ ] **Step 1: Start dev server**

```bash
cd /Users/justus/Documents/KoalaGit/Antigrav/shared-timer-app && npm run dev 2>&1 &
```

- [ ] **Step 2: Open app and navigate to a room with Deathroll active**

Open the app in browser. Navigate to a room where Deathroll is running.

Verify:
1. Cabinet shows `☠ DEATHROLL ☠` title in `Black Ops One` font
2. 4 reel columns visible with yellow payline across center
3. When a roll happens: all 4 reels spin (vertical scroll), then lock left→right with flash
4. Total animation ~2.2 seconds
5. At low `currentMax` (≤ 10): cabinet border and reel digits shift to orange
6. At `currentMax = 1`: cabinet border pulses red continuously
7. Roll button and `Warten auf andere...` state still functional

- [ ] **Step 3: Final commit if any visual tweaks were made**

```bash
git add -p  # stage only intentional tweaks
git commit -m "fix: visual tweaks to Deathroll slot machine"
```

If no tweaks needed, skip this step.
