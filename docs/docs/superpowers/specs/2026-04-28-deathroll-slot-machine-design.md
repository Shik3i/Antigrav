# Deathroll Slot Machine Redesign

**Date:** 2026-04-28  
**Status:** Approved

## Summary

Redesign `DeathrollWidget.jsx` to look and feel like a retro-Vegas slot machine cabinet. The digit display becomes genuine spinning reels with vertical-scroll animation and sequential lock-in. Game logic (socket, button, `isWaitingForOthers`) remains untouched.

## Decisions

| Topic | Decision |
|-------|----------|
| Visual style | Retro Vegas — dark green cabinet, yellow payline, `Black Ops One` font |
| Animation | Vertical reel scroll → sequential lock-in left→right |
| Total spin duration | ~2.2s (1s longer than current 1.2s) |
| Danger tiers | Kept — cabinet color shifts green→yellow→orange→pulsing red as `currentMax` falls |
| Extra tension mechanics | None (longer duration is sufficient) |

## Architecture

### `DeathrollWidget.jsx` (modified)

- Remove scramble JS interval entirely (`scrambleIntervalRef`, `scrambleIntervalRef.current = window.setInterval(...)`)
- Keep `isRolling` state — set `true` on `currentMax` change, set `false` after 2200ms
- Keep `getGlowTier()` — all tier properties stay compatible
- Replace the 4-digit grid with `<SlotReels value={currentMax} tier={glowTier} isRolling={isRolling} />`
- Cabinet frame styling applied to outer wrapper (border, background, glow from `glowTier`)
- Add payline bar element above reel row (absolute positioned, yellow, `rgba(250,204,21,0.65)`)
- Add `☠ DEATHROLL ☠` title row in `Black Ops One`

### `SlotReels.jsx` (new — `src/components/SlotReels.jsx`)

Props: `value` (number), `tier` (glowTier object), `isRolling` (bool)

Renders 4 reel columns. Each column:
- Outer wrapper: `overflow: hidden`, fixed dimensions (~52×74px), styled from `tier`
- Inner strip: `div` with 20 stacked digit divs (0–9 twice), `position: absolute`
- `translateY` calculated so target digit sits on payline when stopped
- `spinning` class triggers `@keyframes reel-spin` (fast continuous upward scroll)
- On `isRolling → false`: remove `spinning`, apply `lock-in` class per reel sequentially via `setTimeout` (+0ms, +160ms, +320ms, +480ms)
- Each lock-in: snap strip to target `translateY`, add `reel-flash` class (short color pulse from `tier.accentColor`)

State inside `SlotReels`:
- `lockedReels: [false, false, false, false]` — tracks which reels have stopped
- `targetPositions: number[]` — computed from `value` digit decomposition

### CSS additions to `index.css`

```css
@keyframes reel-spin {
  from { transform: translateY(0); }
  to   { transform: translateY(-1480px); } /* 20 digits × 74px */
}

@keyframes reel-lock-flash {
  0%   { opacity: 1; }
  40%  { opacity: 0.6; filter: brightness(1.8); }
  100% { opacity: 1; filter: brightness(1); }
}

.reel-spinning .reel-strip {
  animation: reel-spin 0.18s linear infinite;
}

.reel-locking {
  animation: reel-lock-flash 0.32s ease;
}
```

Kabinett-wrapper in `DeathrollWidget.jsx`:
- Title bar: `Black Ops One`, `letter-spacing: 0.2em`, color from `tier.headlineColor`
- Payline: absolute, `height: 2px`, `background: rgba(250,204,21,0.65)`, `box-shadow` glow
- Critical tier (≤ 1): `@keyframes cabinet-pulse` — border opacity oscillates 0.4→0.8

## Animation Timeline (2.2s total)

| Time | Event |
|------|-------|
| 0ms | `isRolling = true`, all 4 strips start `reel-spin` |
| 1400ms | Reel 1 (thousands) locks — strip snaps to target, `reel-locking` flash |
| 1560ms | Reel 2 (hundreds) locks |
| 1720ms | Reel 3 (tens) locks |
| 1880ms | Reel 4 (units) locks |
| 2200ms | `isRolling = false` |

## Danger Tier Mapping (cabinet colors)

| currentMax | Cabinet border | Reel digit color | Special |
|-----------|---------------|-----------------|---------|
| > 100 | `rgba(22,163,74,0.6)` green | `#4ade80` | — |
| ≤ 100 | `rgba(125,211,252,0.3)` blue | `#e0f2fe` | — |
| ≤ 20 | `rgba(250,204,21,0.4)` yellow | `#fde047` | — |
| ≤ 10 | `rgba(251,146,60,0.5)` orange | `#fb923c` | — |
| ≤ 1 | `rgba(239,68,68,0.6)` red | `#f87171` | `cabinet-pulse` animation |

> These map to the existing `getGlowTier()` tiers — no structural change needed, only CSS property usage in the new components.

## Files Changed

| File | Change |
|------|--------|
| `src/components/DeathrollWidget.jsx` | Remove scramble interval, add cabinet styling, use `SlotReels` |
| `src/components/SlotReels.jsx` | New component |
| `src/index.css` | Add `reel-spin`, `reel-lock-flash`, `cabinet-pulse` keyframes |

## Out of Scope

- Sound effects
- Lever graphic
- Mobile-specific layout changes
- Changes to server-side deathroll logic
