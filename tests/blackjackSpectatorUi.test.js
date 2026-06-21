const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const events = require('../socketEvents.json');
const lobbySource = fs.readFileSync(path.join(root, 'src/features/blackjack/components/BlackjackLobby.jsx'), 'utf8');
const hookSource = fs.readFileSync(path.join(root, 'src/features/blackjack/hooks/useBlackjackRoom.js'), 'utf8');
const seatSource = fs.readFileSync(path.join(root, 'src/features/blackjack/components/BlackjackSeat.jsx'), 'utf8');
const tableSource = fs.readFileSync(path.join(root, 'src/features/blackjack/components/BlackjackTable.jsx'), 'utf8');
const blackjackCss = fs.readFileSync(path.join(root, 'src/features/blackjack/blackjack.css'), 'utf8');

assert.strictEqual(events.BLACKJACK_WATCH, 'blackjack:watch', 'socket events should expose blackjack:watch');
assert.strictEqual(events.BLACKJACK_SIDE_BET, 'blackjack:side_bet', 'socket events should expose blackjack side bets');
assert(lobbySource.includes('handleWatchRoom'), 'lobby should receive a watch-room handler');
assert(lobbySource.includes('handleWatchRoom(room.roomId, room.maxPlayers)'), 'lobby room action should open the table as spectator');
assert(hookSource.includes('const handleWatchRoom'), 'blackjack hook should implement spectator room loading');
assert(hookSource.includes('EVENTS.BLACKJACK_WATCH'), 'spectator room loading should subscribe to live room state');
assert(hookSource.includes('const handleSideBetSubmit'), 'blackjack hook should implement side bet actions');
assert(hookSource.includes('EVENTS.BLACKJACK_SIDE_BET'), 'side bet actions should use the side bet socket event');
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
assert(seatSource.includes('blackjack-side-bet-zone'), 'side bet zones should render at the local seat');
assert(seatSource.includes("'twins', 'bust'"), 'phase 1 should expose twins and bust side bet zones');
assert(seatSource.includes('player.activeSideBets'), 'active side bets should stay visible after the round starts');
assert(seatSource.includes('blackjack-side-bet-dot'), 'active side bets should have a visible active marker');
assert(seatSource.includes('blackjack-side-bet-chip'), 'active side bets should render a chip stack on the side bet field');
assert(seatSource.includes('getCommittedBetMotionClass'), 'committed bet stack should derive settlement motion from settlement results');
assert(blackjackCss.includes('@keyframes blackjackBetToPlayer'), 'winning committed chips should animate calmly back to the player');
assert(blackjackCss.includes('@keyframes blackjackBetToDealer'), 'losing committed chips should animate calmly toward the dealer');
assert(
  blackjackCss.includes('.blackjack-seat-layout-horizontal.compact-controls'),
  'compact seat controls should stay inside the seat bounds'
);
assert(tableSource.includes('function getTableUiMode(width)'), 'blackjack table should derive a tableUiMode from shell width');
assert(tableSource.includes('if (width <= 980) return \'stacked\';'), 'tableUiMode should switch to stacked at 980px and below');
assert(tableSource.includes('if (width <= 1180) return \'compact\';'), 'tableUiMode should switch to compact at 1180px and below');
assert(tableSource.includes('if (width <= 1500) return \'compressed\';'), 'tableUiMode should switch to compressed at 1500px and below');
assert(tableSource.includes('tableUiMode'), 'blackjack table should pass tableUiMode down into seat rendering');

console.log('blackjack spectator UI regression passed');
