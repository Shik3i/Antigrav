const roomManager = require('../roomManager');

describe('Deathroll start flow', () => {
  const roomId = 'deathroll-start-waits-for-click';

  afterEach(() => {
    roomManager.clearDeathroll(roomId);
  });

  test('starts at 1000 and waits for the first roll click', () => {
    roomManager.createRoom(roomId);
    const originalRandom = Math.random;
    Math.random = vi.fn(() => 0.123);


    try {
      const state = roomManager.startDeathroll(roomId, 'Starter');

      expect(state.currentMax).toBe(1000);
      expect(state.lastRoller).toBeNull();
      expect(state.history).toEqual([]);
      expect(state.isComplete).toBe(false);
      expect(Math.random).not.toHaveBeenCalled();
    } finally {
      Math.random = originalRandom;
    }
  });

  test('first roll uses the 1000 max after start', () => {
    roomManager.createRoom(roomId);
    const originalRandom = Math.random;

    try {
      roomManager.startDeathroll(roomId, 'Starter');
      Math.random = vi.fn(() => 0.123);

      const state = roomManager.rollDeathroll(roomId, 'Roller');

      expect(state.currentMax).toBe(124);
      expect(state.lastRoller).toBe('Roller');
      expect(state.history).toEqual([{ roller: 'Roller', max: 1000, roll: 124 }]);
      expect(state.isComplete).toBe(false);
    } finally {
      Math.random = originalRandom;
    }
  });
});
