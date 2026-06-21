# Blackjack Responsive Casino Feel Design

**Date:** 2026-04-25

**Goal:** Improve the blackjack table so it feels like a modern casino table on large and smaller screens, without breaking multiplayer state, betting flow, side bets, or the existing backend refactor structure.

## Problem Summary

The current blackjack table works well on large monitors, but medium and smaller screens expose structural layout problems:

- Seats are positioned with absolute `left`, `right`, and `bottom` values.
- Player controls, side bets, chip trays, action buttons, and committed bet stacks can extend outside their seat boxes.
- Seat 1, 2, and 3 can overlap when the available content width shrinks.
- The page has a sidebar, so viewport-width media queries do not always match the real space available to the blackjack table.
- Current card animations are local component animations, not real table movement from shoe to hand or hand to discard.

## Design Principles

1. Use the blackjack table container as the responsive source of truth, not the browser viewport.
2. Keep the full casino-style table on large screens.
3. Introduce a compact table mode before elements start overlapping.
4. Keep controls inside or tightly anchored to their owning seat on smaller screens.
5. Use a motion layer for casino-like movement instead of ad hoc animations inside each component.
6. Respect `prefers-reduced-motion`.
7. Preserve socket contracts and current game rules.

## Responsive Layout Strategy

Use CSS container queries on the blackjack table shell/stage.

The table should define a container context so the layout reacts to the actual width available after the app sidebar:

```css
.blackjack-table-shell {
  container-type: inline-size;
  container-name: blackjack-table;
}
```

### Layout Modes

**Full Table Mode**

Applies when the table container is wide enough, roughly above `1500px`.

- Keep the current casino-felt composition.
- Preserve decorative arc and absolute seat placement.
- Keep action buttons and chip trays outside the local seat where there is enough room.

**Compressed Table Mode**

Applies roughly between `1180px` and `1500px`.

- Reduce seat width through CSS variables.
- Pull chip trays and action buttons closer to seats.
- Reduce side-bet width and typography.
- Move side seats further apart or slightly higher to avoid Seat 1 overlap.

**Compact Table Mode**

Applies roughly below `1180px`.

- Keep the table as a felt surface, but stop relying on wide absolute offsets.
- Keep each player's interactive controls inside or directly attached to the seat.
- Side bets become a compact row above or inside the local player panel.
- Action buttons move into a compact local action strip.
- Committed bet stacks stay above the player panel but must not cross into another seat.

**Stacked Mode**

Applies roughly below `980px`.

- Existing stacked/mobile structure remains, but should be cleaned up so every seat is a normal flow item.
- Decorative table rings may be hidden or simplified.
- Dealer, piles, and seats stack predictably.

## Seat and Control Rules

- A seat owns its cards, identity, auto-bet control, pending bet stack, side bets, and local action buttons.
- Controls may be visually adjacent to the seat, but they must not overlap neighboring seats.
- The local player's controls can be more prominent than remote seats.
- Remote seats should stay visually compact and mostly informational.
- Empty seats stay clickable where allowed.

## Side Bet UX

Side bets need to remain understandable and visible in compact layouts.

Phase 1 side bets:

- `Twins`: first two player cards have the same rank, pays `10:1` profit.
- `Bust`: dealer busts, pays `5:2` profit.

Large mode:

- Show side-bet zones near the table-center betting arc.
- Use visible labels and payout text.

Compact mode:

- Move side-bet controls into the local player panel or directly above it.
- Keep labels concise: `Twins 10:1`, `Bust 5:2`.
- Use tooltip/title text for the full explanation.

## Motion Strategy

Introduce a dedicated `BlackjackMotionLayer` instead of relying only on CSS animation inside `PlayingCard` or `ChipStack`.

### Responsibilities

- Observe previous and current `roomState`.
- Detect newly dealt cards.
- Detect cards leaving hands/dealer during discard.
- Detect side-bet chip placement and settlement movement.
- Render temporary animated clones above the table.
- Remove clones after the animation completes.

### Card Dealing

Cards should visually travel from the shoe pile to the target hand.

Casino feel:

- Duration: `650ms` to `850ms`.
- Slight curved motion.
- Small rotation while travelling.
- Gentle snap into final hand position.
- Cards should be staggered, not all fired at once.

Initial deal should feel like table dealing:

- Player 1 card.
- Dealer up card.
- Player 1 second card.
- Dealer hole card.
- Multi-player hands should be sequenced across active players.

### Dealer Draw

Dealer draw animations also come from the shoe pile to the dealer zone.

- Slightly slower than initial deal.
- Dealer status should match the motion: `Dealer draws`, `Dealer stands`, `Dealer busts`.

### Discard

At the end of settlement, visible cards should move toward the discard pile.

Casino feel:

- Duration: `800ms` to `1000ms`.
- Cards gather toward discard in a calm sweep.
- Cards can slightly stack/rotate as they land.
- Avoid abrupt disappearance.

### Chip Motion

Main bet chips already have partial table/player/dealer motion. Side-bet chips should follow the same mental model:

- On side-bet placement: chip stack moves from player/pending-bet area to the side-bet zone.
- On side-bet win: chips return toward the player.
- On side-bet loss: chips move toward dealer/bank.
- On push/neutral outcomes, use a subtle settle/pulse instead of a big movement.

## Dealer and Casino Atmosphere

Add lightweight dealer choreography before adding more rules.

Useful dealer callouts:

- `Waiting for bets`
- `Dealing`
- `Dealer peeks`
- `Player turn`
- `Dealer reveals`
- `Dealer draws`
- `Dealer stands`
- `Dealer busts`
- `Settling bets`

Optional later enhancements:

- Table min/max badge.
- Last five hands history strip.
- Optional sound effects for chip click, card swoosh, win, lose, push.
- Insurance zone when dealer shows ace.

## Accessibility and Performance

- Use `prefers-reduced-motion` to disable or simplify card/chip flight animations.
- Animated clones should not receive pointer events.
- Do not block gameplay input while decorative animations run.
- Keep DOM measurements batched to avoid layout thrashing.
- Use stable `data-*` anchors for shoe, discard, dealer hand, player hands, and side-bet zones.

## Suggested Implementation Order

1. Add container-query responsive infrastructure to the blackjack table shell.
2. Implement compressed and compact seat layouts.
3. Move overflowing controls into owned seat areas in compact mode.
4. Add stable DOM anchors for shoe, discard, dealer, player hands, committed bets, and side bets.
5. Build `BlackjackMotionLayer` for card deal animations.
6. Add discard animations.
7. Add side-bet chip motion.
8. Add dealer callouts and optional table min/max badge.
9. Run visual browser checks across large, medium, tablet, and mobile widths.

## Testing Strategy

Backend behavior should not change for this phase. Existing blackjack backend tests should continue to pass.

Frontend verification should include:

- Build succeeds with `npm run build`.
- No overlap at representative container widths: `1600px`, `1366px`, `1180px`, `1024px`, `900px`, and mobile.
- Seat 1/2/3 do not overlap in 3-seat mode.
- Seat 1/2/3/4/5 do not overlap in 5-seat mode.
- Side-bet controls remain readable and clickable.
- Hit/Stand/Double/Split remain reachable.
- Reduced-motion mode does not show long flight animations.

## Out of Scope

- New blackjack rules beyond already planned side bets.
- Persistent table configuration storage.
- Roulette implementation.
- Audio implementation in the first responsive/motion pass.
- Major redesign of the global app shell/sidebar.

