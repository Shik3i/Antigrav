# Roulette Starting Points

- Reuse `utils/casino/core/tableRegistry.js` for roulette room lookup and lifecycle.
- Reuse the shared `phase` model for `waiting`, `betting_open`, `betting_closed`, `spin`, and `settlement`.
- Keep roulette participants seat-optional; do not require `currentPlayerTurn`.
- Store roulette bets per round and per player instead of per seat hand state.
- Add roulette-specific behavior later under `utils/casino/roulette/`.
