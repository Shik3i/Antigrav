const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const events = require('../socketEvents.json');
const lobbySource = fs.readFileSync(path.join(root, 'src/features/blackjack/components/BlackjackLobby.jsx'), 'utf8');
const hookSource = fs.readFileSync(path.join(root, 'src/features/blackjack/hooks/useBlackjackRoom.js'), 'utf8');
const seatSource = fs.readFileSync(path.join(root, 'src/features/blackjack/components/BlackjackSeat.jsx'), 'utf8');
const blackjackCss = fs.readFileSync(path.join(root, 'src/features/blackjack/blackjack.css'), 'utf8');

assert.strictEqual(events.BLACKJACK_WATCH, 'blackjack:watch', 'socket events should expose blackjack:watch');
assert(lobbySource.includes('handleWatchRoom'), 'lobby should receive a watch-room handler');
assert(lobbySource.includes('handleWatchRoom(room.roomId, room.maxPlayers)'), 'lobby room action should open the table as spectator');
assert(hookSource.includes('const handleWatchRoom'), 'blackjack hook should implement spectator room loading');
assert(hookSource.includes('EVENTS.BLACKJACK_WATCH'), 'spectator room loading should subscribe to live room state');
assert(hookSource.includes('roomExistsInLobby'), 'seat join from watcher mode should not create rooms that already exist');
assert(hookSource.indexOf('EVENTS.BLACKJACK_JOIN') < hookSource.indexOf('EVENTS.BLACKJACK_SWITCH_SEAT'), 'seat join should subscribe the player before switching seats');
assert(seatSource.includes('blackjack-seat-footer-main'), 'seat footer should keep identity and auto-bet on one row');
assert(seatSource.includes("blackjack-chip-tray vertical-side"), 'chip tray should remain rendered for next-round auto-bet planning');
assert(seatSource.includes("!isBetting ? ' is-planning' : ''"), 'chip tray should visually mark next-round planning outside betting phases');
assert(!seatSource.includes('disabled={!isBetting}'), 'chip tray buttons should remain clickable outside betting phases');
assert(seatSource.includes('isLocalPlayer && pendingBet > 0 &&'), 'pending bet stack should stay visible so the planned bet can be reduced outside betting phases');
assert(
  !/isBettingPhase\s*&&\s*isLocalPlayer\s*&&\s*pendingBet\s*>\s*0\s*&&\s*\(\s*<ChipStack/.test(seatSource),
  'pending bet stack visibility should not be limited to betting phases'
);
assert(seatSource.includes('blackjack-committed-bet-zone'), 'committed bet stack should render in its own table-facing zone');
assert(seatSource.includes('getCommittedBetMotionClass'), 'committed bet stack should derive settlement motion from settlement results');
assert(blackjackCss.includes('@keyframes blackjackBetToPlayer'), 'winning committed chips should animate calmly back to the player');
assert(blackjackCss.includes('@keyframes blackjackBetToDealer'), 'losing committed chips should animate calmly toward the dealer');

console.log('blackjack spectator UI regression passed');
