const { initializeRoom, createNewRound, transitionPhase, addParticipant, removeParticipant, PHASE_SEQUENCE, PHASE_DURATIONS } = require('../../../utils/casino/roulette/tableLifecycle');

describe('tableLifecycle', () => {
  describe('initializeRoom', () => {
    it('creates room with correct initial state', () => {
      const room = initializeRoom();
      expect(room.roomId).toBe('roulette_main');
      expect(room.participants).toEqual([]);
      expect(room.currentPhase).toBe('waiting');
      expect(typeof room.roundId).toBe('string');
      expect(room.rounds[room.roundId]).toBeTruthy();
      expect(room.rounds[room.roundId].bets).toEqual({});
      expect(room.rounds[room.roundId].spinResult).toBeNull();
    });

    it('sets deadlineAt', () => {
      const room = initializeRoom();
      expect(typeof room.deadlineAt).toBe('number');
      expect(room.deadlineAt).toBeGreaterThan(Date.now() - 100);
    });
  });

  describe('createNewRound', () => {
    it('creates new roundId and preserves old round', () => {
      let room = initializeRoom();
      const oldRoundId = room.roundId;
      room = createNewRound(room);
      expect(room.roundId).not.toBe(oldRoundId);
      expect(room.rounds[room.roundId].bets).toEqual({});
      expect(room.rounds[oldRoundId]).toBeTruthy();
    });
  });

  describe('transitionPhase', () => {
    it('follows correct phase sequence', () => {
      let room = initializeRoom(); // starts at waiting
      const phases = [];
      for (let i = 0; i < 5; i++) {
        room = transitionPhase(room);
        phases.push(room.currentPhase);
      }
      expect(phases).toEqual(['betting_open', 'betting_closed', 'spin', 'settlement', 'waiting']);
    });

    it('creates new round on transition to betting_open', () => {
      let room = initializeRoom();
      const oldRoundId = room.roundId;
      room = transitionPhase(room); // waiting → betting_open
      expect(room.roundId).not.toBe(oldRoundId);
    });

    it('generates spinResult on transition to spin', () => {
      let room = initializeRoom();
      room = transitionPhase(room); // → betting_open
      room = transitionPhase(room); // → betting_closed
      room = transitionPhase(room); // → spin
      expect(room.rounds[room.roundId].spinResult).not.toBeNull();
      expect(typeof room.rounds[room.roundId].spinResult.number).toBe('number');
    });

    it('resets participant left flag on new round', () => {
      let room = initializeRoom();
      room.participants = [{ userId: 'user1', left: true }];
      room = transitionPhase(room); // → betting_open (new round)
      expect(room.participants[0].left).toBe(false);
    });

    it('updates deadlineAt on each transition', () => {
      let room = initializeRoom();
      const oldDeadline = room.deadlineAt;
      room = transitionPhase(room);
      expect(room.deadlineAt).not.toBe(oldDeadline);
    });
  });

  describe('addParticipant', () => {
    it('adds new participant', () => {
      let room = initializeRoom();
      room = addParticipant(room, 'user1', 'Alice', 1000);
      expect(room.participants.length).toBe(1);
      expect(room.participants[0].userId).toBe('user1');
      expect(room.participants[0].balance).toBe(1000);
      expect(room.participants[0].left).toBe(false);
    });

    it('does not duplicate existing participant', () => {
      let room = initializeRoom();
      room = addParticipant(room, 'user1', 'Alice', 1000);
      room = addParticipant(room, 'user1', 'Alice', 1000);
      expect(room.participants.length).toBe(1);
    });
  });

  describe('removeParticipant', () => {
    it('marks participant as left, does not remove', () => {
      let room = initializeRoom();
      room = addParticipant(room, 'user1', 'Alice', 1000);
      room = removeParticipant(room, 'user1');
      expect(room.participants.length).toBe(1);
      expect(room.participants[0].left).toBe(true);
    });
  });

  describe('PHASE_DURATIONS', () => {
    it('has correct timing values', () => {
      expect(PHASE_DURATIONS.waiting).toBe(5000);
      expect(PHASE_DURATIONS.betting_open).toBe(30000);
      expect(PHASE_DURATIONS.betting_closed).toBe(0);
      expect(PHASE_DURATIONS.spin).toBe(10000);
      expect(PHASE_DURATIONS.settlement).toBe(5000);
    });
  });
});
