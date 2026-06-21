// tests/integration/roulette.integration.test.js
const roulette = require('../../utils/casino/roulette');

describe('roulette integration', () => {
  it('completes a full round cycle', () => {
    let room = roulette.initializeRoom();
    expect(room.currentPhase).toBe('waiting');

    room = roulette.addParticipant(room, 'user1', 'Alice', 1000);
    expect(room.participants.length).toBe(1);

    // waiting → betting_open
    room = roulette.transitionPhase(room);
    expect(room.currentPhase).toBe('betting_open');
    const bettingRoundId = room.roundId;

    // Place bets
    const v1 = roulette.validateBet(room, 'user1', 'red', 100);
    expect(v1.valid).toBe(true);
    roulette.addBet(room, 'user1', 'red', 100);

    const v2 = roulette.validateBet(room, 'user1', 'straight_5', 50);
    expect(v2.valid).toBe(true);
    roulette.addBet(room, 'user1', 'straight_5', 50);

    expect(room.rounds[room.roundId].bets['user1'].length).toBe(2);

    // betting_open → betting_closed
    room = roulette.transitionPhase(room);
    expect(room.currentPhase).toBe('betting_closed');

    // betting_closed → spin
    room = roulette.transitionPhase(room);
    expect(room.currentPhase).toBe('spin');
    const spinResult = room.rounds[room.roundId].spinResult;
    expect(spinResult).not.toBeNull();
    expect(spinResult.number).toBeGreaterThanOrEqual(0);
    expect(spinResult.number).toBeLessThanOrEqual(36);

    // spin → settlement
    room = roulette.transitionPhase(room);
    expect(room.currentPhase).toBe('settlement');

    // Calculate and verify payouts
    const payouts = roulette.calculatePayouts(room);
    const updates = roulette.prepareSettlementUpdates(payouts);
    expect(updates.length).toBe(1);
    expect(updates[0].playerId).toBe('user1');

    // Verify settlement math
    const redWins = roulette.doesBetWin('red', spinResult.number);
    const straightWins = roulette.doesBetWin('straight_5', spinResult.number);
    let expectedChange = 0;
    if (redWins) expectedChange += 100 * 1;   // 1:1 odds
    else expectedChange -= 100;
    if (straightWins) expectedChange += 50 * 35; // 35:1 odds
    else expectedChange -= 50;

    expect(updates[0].displayChange).toBe(expectedChange);

    // settlement → waiting
    room = roulette.transitionPhase(room);
    expect(room.currentPhase).toBe('waiting');

    // waiting → betting_open creates the new round
    room = roulette.transitionPhase(room);
    expect(room.currentPhase).toBe('betting_open');
    expect(room.roundId).not.toBe(bettingRoundId);
  });

  it('rejects bet exceeding inside limit', () => {
    let room = roulette.initializeRoom();
    room = roulette.addParticipant(room, 'user1', 'Alice', 2000);
    room = roulette.transitionPhase(room); // → betting_open

    const result = roulette.validateBet(room, 'user1', 'straight_5', 501);
    expect(result.valid).toBe(false);
  });

  it('rejects bet after betting_closed', () => {
    let room = roulette.initializeRoom();
    room = roulette.addParticipant(room, 'user1', 'Alice', 1000);
    room = roulette.transitionPhase(room); // → betting_open
    room = roulette.transitionPhase(room); // → betting_closed

    const result = roulette.validateBet(room, 'user1', 'red', 100);
    expect(result.valid).toBe(false);
  });

  it('rejects bet when insufficient balance', () => {
    let room = roulette.initializeRoom();
    room = roulette.addParticipant(room, 'user1', 'Alice', 30);
    room = roulette.transitionPhase(room); // → betting_open

    const result = roulette.validateBet(room, 'user1', 'red', 100);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Nicht genug Guthaben');
  });

  it('processes settlement for disconnected player', () => {
    let room = roulette.initializeRoom();
    room = roulette.addParticipant(room, 'user1', 'Alice', 1000);
    room = roulette.transitionPhase(room); // → betting_open
    roulette.addBet(room, 'user1', 'red', 100);

    // Disconnect player
    room = roulette.removeParticipant(room, 'user1');
    expect(room.participants[0].left).toBe(true);

    // Complete round
    room = roulette.transitionPhase(room); // → betting_closed
    room = roulette.transitionPhase(room); // → spin
    room = roulette.transitionPhase(room); // → settlement

    // Settlement still processes
    const payouts = roulette.calculatePayouts(room);
    expect(payouts['user1']).toBeTruthy();
    expect(payouts['user1'].length).toBe(1);
  });

  it('serializes room state correctly for client', () => {
    let room = roulette.initializeRoom();
    room = roulette.addParticipant(room, 'user1', 'Alice', 500);
    room = roulette.transitionPhase(room); // → betting_open
    roulette.addBet(room, 'user1', 'red', 50);

    const serialized = roulette.serializeRoom(room);
    expect(serialized.roomId).toBe('roulette_main');
    expect(serialized.currentPhase).toBe('betting_open');
    expect(serialized.participants[0].userId).toBe('user1');
    expect(serialized.participants[0].isBot).toBeUndefined();
    expect(serialized.currentRoundBets['user1'][0].type).toBe('red');
    expect(typeof serialized.secondsUntilPhaseEnd).toBe('number');
  });
});
