const {
  createShoe,
  drawCardFromShoe,
  discardCards,
  shouldReshuffle,
  reshuffleShoe,
  serializeCard,
  serializeDealerHand
} = require('./blackjackCards');
const { calculateHandValue, isSoft17, isBust, isBlackjack } = require('./blackjackRules');
const { createBaseTableState, createParticipantState } = require('./casino/core/stateFactories');
const {
  normalizeRoomId,
  getRoom: getRegisteredRoom,
  setRoom
} = require('./casino/core/tableRegistry');
const {
  getOrderedPlayers,
  getNextFreeSeat,
  getPlayerByUserId
} = require('./casino/core/participants');
const { setPhase, advanceRound } = require('./casino/core/roundLifecycle');
const { setDeadline, clearDeadline } = require('./casino/core/phaseTimers');
const { serializeTableSummary } = require('./casino/core/serialization');
const lifecycle = require('./casino/blackjack/tableLifecycle');
const bets = require('./casino/blackjack/bets');
const roundFlow = require('./casino/blackjack/roundFlow');
const turns = require('./casino/blackjack/turns');
const actions = require('./casino/blackjack/actions');
const dealer = require('./casino/blackjack/dealer');
const settlement = require('./casino/blackjack/settlement');
const sideBets = require('./casino/blackjack/sideBets');
const botStrategy = require('./casino/blackjack/botStrategy');
const blackjackSerialization = require('./casino/blackjack/serialization');

const rooms = new Map();
const ALLOWED_MAX_PLAYERS = new Set([3, 5]);
const ALLOWED_BET_CHIPS_KC = [1, 5, 10, 50, 100, 500, 1000];
const CENTS_PER_KC = 100;
const MAX_BET_KC = 1000000;
const MAX_BET_CENTS = MAX_BET_KC * CENTS_PER_KC;
const TURN_TIMEOUT_MS = 90 * 1000;
const AUTO_START_DELAY_MS = 30 * 1000;
const ALL_BETS_READY_AUTO_START_DELAY_MS = 2 * 1000;
const SETTLEMENT_DISPLAY_MS = 5 * 1000;
const DEALER_ACTION_DELAY_MS = 1200;
const BOT_ACTION_DELAY_MS = 1400;
const BOT_DEFAULT_BET_CENTS = 100 * CENTS_PER_KC;
const DEFAULT_TIMER_CONFIG = {
  betWindowMs: AUTO_START_DELAY_MS,
  allAutoBetReadyMs: ALL_BETS_READY_AUTO_START_DELAY_MS,
  turnTimeoutMs: TURN_TIMEOUT_MS
};
const TIMER_CONFIG_LIMITS = {
  betWindowSeconds: { min: 5, max: 120 },
  turnTimeoutSeconds: { min: 10, max: 180 }
};

function normalizeMaxPlayers(maxPlayers = 5) {
  return ALLOWED_MAX_PLAYERS.has(Number(maxPlayers)) ? Number(maxPlayers) : 5;
}

function createPlayerState(user, seat) {
  return {
    ...createParticipantState(user, {
      username: user.username || user.displayName || `User ${seat}`,
      displayName: user.displayName || user.username || `User ${seat}`,
      seat
    }),
    seat,
    currentBet: 0,
    hands: [],
    activeHandIndex: 0,
    done: false,
    waitingForNextRound: false,
    autoBetEnabled: false,
    pendingSideBets: {},
    activeSideBets: {},
    sideBetResults: []
  };
}

function createHandState(betCents = 0) {
  return {
    cards: [],
    value: 0,
    bet: betCents,
    stood: false,
    busted: false,
    blackjack: false,
    done: false,
    isAcesSplit: false
  };
}

function resetPlayerRoundState(player) {
  player.hands = [createHandState(player.currentBet)];
  player.activeHandIndex = 0;
  player.done = false;
  player.sideBetResults = [];
}

function canSwitchSeat(player) {
  if (!player) return false;
  return player.currentBet <= 0 && (!player.hands || player.hands.length === 0) && !player.done;
}

function hasActiveRound(room) {
  return ['dealing', 'player_turns', 'dealer_turn', 'settlement'].includes(room.status);
}

function getDealerPhase(room) {
  return room?.dealerPhase || null;
}

function setRoomPhase(room, phase) {
  return setPhase(room, phase);
}

function syncPlayerState(player) {
  if (!player.hands || player.hands.length === 0) return;

  player.hands.forEach((hand) => {
    hand.value = calculateHandValue(hand.cards);
    hand.busted = isBust(hand.cards);
    hand.blackjack = isBlackjack(hand.cards);
    hand.done = hand.busted || hand.stood || hand.blackjack;
  });

  player.done = player.hands.every((hand) => hand.done);
}

function updateShuffleFlag(room) {
  room.needsShuffle = shouldReshuffle(room);
}

function drawIntoHand(room, hand) {
  const card = drawCardFromShoe(room);
  hand.push(card);
  updateShuffleFlag(room);
  return card;
}

function createRoom(roomId, maxPlayers = 5) {
  const safeRoomId = normalizeRoomId(roomId);
  if (!safeRoomId) {
    throw new Error('roomId is required.');
  }

  const safeMaxPlayers = normalizeMaxPlayers(maxPlayers);
  if (!ALLOWED_MAX_PLAYERS.has(safeMaxPlayers)) {
    throw new Error('Invalid blackjack table size.');
  }

  if (rooms.has(safeRoomId)) {
    throw new Error('Blackjack room already exists.');
  }

  const shoeState = createShoe(6);
  const tableState = createBaseTableState({
    roomId: safeRoomId,
    game: 'blackjack',
    maxPlayers: safeMaxPlayers
  });

  setRoom(rooms, {
    ...tableState,
    players: [],
    dealerHand: [],
    currentPlayerTurn: null,
    turnDeadlineAt: null,
    autoStartAt: null,
    autoStartQueuedByUserId: null,
    settlementCompleteAt: null,
    pendingRoundStartByUserId: null,
    lastAppliedBuyInRoundId: null,
    timerConfig: { ...DEFAULT_TIMER_CONFIG },
    pendingTimerConfig: null,
    activeTimerConfig: null,
    dealerPhase: null,
    dealerActionAt: null,
    botActionAt: null,
    lastSettlement: [],
    lastSettlementRoundId: null,
    lastAppliedSettlementRoundId: null,
    playerSkins: {},
    ...shoeState
  });

  return rooms.get(safeRoomId);
}

function getRoom(roomId) {
  return getRegisteredRoom(rooms, roomId);
}

function getPlayerRoomId(userId) {
  if (!userId) return null;
  for (const [roomId, room] of rooms.entries()) {
    if (getPlayerByUserId(room, userId)) return roomId;
  }
  return null;
}

function listRooms() {
  return [...rooms.values()]
    .map((room) => ({
      ...serializeTableSummary(room, getOrderedPlayers(room)),
      roundId: room.roundId,
      turnDeadlineAt: room.turnDeadlineAt,
      autoStartAt: room.autoStartAt,
      shoeRemaining: room.shoe.length,
      needsShuffle: room.needsShuffle
    }))
    .sort((a, b) => {
      if (a.playerCount !== b.playerCount) return b.playerCount - a.playerCount;
      return a.roomId.localeCompare(b.roomId);
    });
}

const lifecycleHelpers = {
  canSwitchSeat,
  createPlayerState,
  getNextFreeSeat,
  getOrderedPlayers,
  getPlayerByUserId,
  hasActiveRound,
  maybeScheduleAutoStart,
  setRoomPhase
};

const bettingHelpers = {
  getTotalSideBetAmount: sideBets.getTotalSideBetAmount,
  getPlayerByUserId,
  maybeScheduleAutoStart,
  setPhase,
  validateBetAmount
};

const sideBetHelpers = {
  getPlayerByUserId,
  maybeScheduleAutoStart,
  setPhase,
  validateBetAmount
};

const roundFlowHelpers = {
  botActionDelayMs: BOT_ACTION_DELAY_MS,
  clearDeadline,
  drawIntoHand,
  getOrderedPlayers,
  getPlayerByUserId,
  resetPlayerRoundState,
  reshuffleShoe,
  setDeadline,
  lockSideBets: sideBets.lockSideBets,
  setPhase,
  shouldReshuffle,
  syncPlayerState,
  getTurnTimeoutMs
};

const dealerHelpers = {
  calculateHandValue,
  dealerActionDelayMs: DEALER_ACTION_DELAY_MS,
  drawIntoHand,
  isSoft17,
  setDeadline,
  setPhase,
  settleRound: (room, now) => settlement.settleRound(room, now, settlementHelpers)
};

const turnsHelpers = {
  advanceTurn: (room) => turns.advanceTurn(room, turnsHelpers),
  beginDealerTurn: (room) => dealer.beginDealerTurn(room, Date.now(), dealerHelpers),
  botActionDelayMs: BOT_ACTION_DELAY_MS,
  clearDeadline,
  drawIntoHand,
  getOrderedPlayers,
  getPlayerByUserId,
  setDeadline,
  setPhase,
  syncPlayerState,
  getTurnTimeoutMs
};

const settlementHelpers = {
  advanceRound,
  calculateHandValue,
  clearDeadline,
  discardCards,
  getOrderedPlayers,
  isBlackjack,
  maybeScheduleAutoStart,
  resetPlayerRoundState,
  setDeadline,
  clearRoundSideBets: sideBets.clearRoundSideBets,
  setPhase,
  settleSideBets: sideBets.settleSideBets,
  settlementDisplayMs: SETTLEMENT_DISPLAY_MS,
  syncPlayerState,
  updateShuffleFlag
};

const tickHelpers = {
  botActionDelayMs: BOT_ACTION_DELAY_MS,
  botDefaultBetCents: BOT_DEFAULT_BET_CENTS,
  finishSettlementPhase: (room, now) => settlement.finishSettlementPhase(room, now, settlementHelpers),
  getOrderedPlayers,
  getPlayerByUserId,
  hit: (room, userId) => turns.hit(room, userId, turnsHelpers),
  maybeScheduleAutoStart,
  resolveDealerTurn: (room, now) => dealer.resolveDealerTurn(room, now, dealerHelpers),
  split,
  stand: (room, userId) => turns.stand(room, userId, turnsHelpers),
  startRound,
  getTurnTimeoutMs
};

const actionHelpers = {
  advanceTurn: (room) => turns.advanceTurn(room, turnsHelpers),
  calculateHandValue,
  createHandState,
  drawIntoHand,
  getPlayerByUserId,
  syncPlayerState
};

const stateSerializationHelpers = {
  allowedBets: ALLOWED_BET_CHIPS_KC,
  calculateHandValue,
  getDealerPhase,
  getOrderedPlayers,
  serializeCard,
  serializeDealerHand,
  sideBetDefinitions: sideBets.getSideBetDefinitions()
};

function joinRoom(roomId, user) {
  if (!user?.userId) {
    throw new Error('Authenticated user is required.');
  }

  const room = getRoom(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  return lifecycle.joinRoom(room, user, lifecycleHelpers);
}

function addBot(roomId) {
  const room = getRoom(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  return lifecycle.addBot(room, lifecycleHelpers);
}

function removeBot(roomId, botUserId = null) {
  const room = getRoom(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  return lifecycle.removeBot(room, lifecycleHelpers, botUserId);
}

function moveSeat(roomId, user, targetSeat) {
  const room = getRoom(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  return lifecycle.moveSeat(room, user, targetSeat, lifecycleHelpers);
}

function leaveRoom(roomId, userId) {
  return lifecycle.leaveRoom(rooms, roomId, userId, lifecycleHelpers);
}

function getRoomState(roomId, viewerUserId = null) {
  const room = rooms.get(roomId);
  if (!room) return null;
  return blackjackSerialization.getRoomState(room, viewerUserId, stateSerializationHelpers);
}

function getActiveTimerConfig(room) {
  return room?.activeTimerConfig || room?.timerConfig || DEFAULT_TIMER_CONFIG;
}

function getTurnTimeoutMs(room) {
  return getActiveTimerConfig(room).turnTimeoutMs;
}

function normalizeTimerConfigPatch(patch = {}) {
  const normalized = {};
  const betWindowSeconds = Number(patch.betWindowSeconds);
  const turnTimeoutSeconds = Number(patch.turnTimeoutSeconds);

  if (Number.isFinite(betWindowSeconds)) {
    const { min, max } = TIMER_CONFIG_LIMITS.betWindowSeconds;
    if (!Number.isInteger(betWindowSeconds) || betWindowSeconds < min || betWindowSeconds > max) {
      throw new Error(`Bet window must be between ${min} and ${max} seconds.`);
    }
    normalized.betWindowMs = betWindowSeconds * 1000;
  }

  if (Number.isFinite(turnTimeoutSeconds)) {
    const { min, max } = TIMER_CONFIG_LIMITS.turnTimeoutSeconds;
    if (!Number.isInteger(turnTimeoutSeconds) || turnTimeoutSeconds < min || turnTimeoutSeconds > max) {
      throw new Error(`Turn timeout must be between ${min} and ${max} seconds.`);
    }
    normalized.turnTimeoutMs = turnTimeoutSeconds * 1000;
  }

  if (Object.keys(normalized).length === 0) {
    throw new Error('No blackjack timer changes provided.');
  }

  return normalized;
}

function updateAutoBet(roomId, userId, enabled) {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  const player = getPlayerByUserId(room, userId);
  if (!player) {
    throw new Error('Only seated players can update auto-bet.');
  }

  player.autoBetEnabled = Boolean(enabled);
  maybeScheduleAutoStart(room, userId);
  return room;
}

function updateTimerConfig(roomId, userId, patch = {}) {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  const player = getPlayerByUserId(room, userId);
  if (!player) {
    throw new Error('Only seated players can update blackjack timers.');
  }

  room.pendingTimerConfig = {
    ...(room.pendingTimerConfig || room.timerConfig || DEFAULT_TIMER_CONFIG),
    ...normalizeTimerConfigPatch(patch)
  };

  return room;
}

function validateBetAmount(amount) {
  if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
    throw new Error('Bet must be a valid whole-KC amount.');
  }

  if (amount < 0) {
    throw new Error('Bet cannot be negative.');
  }

  const asCents = amount;
  if (asCents % CENTS_PER_KC !== 0) {
    throw new Error('Bet must align with whole KC chip values.');
  }

  const inKC = asCents / CENTS_PER_KC;
  if (!Number.isInteger(inKC)) {
    throw new Error('Bet must align with whole KC chip values.');
  }

  if (asCents > MAX_BET_CENTS) {
    throw new Error(`Bet exceeds max ${MAX_BET_KC.toLocaleString('en-US')} KC.`);
  }
}

function placeBet(roomId, userId, amount, userBalance) {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  return bets.placeBet(room, userId, amount, userBalance, bettingHelpers);
}

function placeSideBet(roomId, userId, sideBetKey, amount, userBalance) {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  return sideBets.placeSideBet(room, userId, sideBetKey, amount, userBalance, sideBetHelpers);
}

function maybeScheduleAutoStart(room, userId = null, now = Date.now()) {
  if (!room) return;
  if (!['waiting', 'betting'].includes(room.status)) {
    room.autoStartAt = null;
    room.autoStartQueuedByUserId = null;
    room.pendingRoundStartByUserId = null;
    return;
  }

  const seatedPlayers = getOrderedPlayers(room).filter((player) => player.connected !== false);
  const activeBettors = seatedPlayers.filter((p) => p.currentBet > 0);

  if (!activeBettors.length) {
    room.autoStartAt = null;
    room.autoStartQueuedByUserId = null;
    room.pendingRoundStartByUserId = null;
    return;
  }

  setRoomPhase(room, 'betting');
  const timerConfig = room.timerConfig || DEFAULT_TIMER_CONFIG;
  const allAutoBetPlayersReady = seatedPlayers.length > 0
    && seatedPlayers.every((player) => player.autoBetEnabled && player.currentBet > 0);
  room.autoStartAt = now + (allAutoBetPlayersReady ? timerConfig.allAutoBetReadyMs : timerConfig.betWindowMs);
  room.autoStartQueuedByUserId = userId || activeBettors[0]?.userId || null;
}

function startRound(roomId, startedByUserId) {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  room.pendingRoundStartByUserId = null;
  if (room.pendingTimerConfig) {
    room.timerConfig = room.pendingTimerConfig;
    room.pendingTimerConfig = null;
  }
  room.activeTimerConfig = { ...(room.timerConfig || DEFAULT_TIMER_CONFIG) };
  roundFlow.startRound(room, startedByUserId, roundFlowHelpers);

  if (!room.currentPlayerTurn) {
    beginDealerTurn(roomId);
  }

  return room;
}

function hit(roomId, userId) {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  return turns.hit(room, userId, turnsHelpers);
}

function stand(roomId, userId) {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  return turns.stand(room, userId, turnsHelpers);
}

function advanceTurn(roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  return turns.advanceTurn(room, turnsHelpers);
}

function split(roomId, userId, userBalance) {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  return actions.split(room, userId, userBalance, actionHelpers);
}

function doubleDown(roomId, userId, userBalance) {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  return actions.doubleDown(room, userId, userBalance, actionHelpers);
}

function beginDealerTurn(roomId, now = Date.now()) {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  return dealer.beginDealerTurn(room, now, dealerHelpers);
}

function resolveDealerTurn(roomId, now = Date.now()) {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  return dealer.resolveDealerTurn(room, now, dealerHelpers);
}

function finishSettlementPhase(room, now = Date.now()) {
  return settlement.finishSettlementPhase(room, now, settlementHelpers);
}

function settleRound(roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  return settlement.settleRound(room, Date.now(), settlementHelpers);
}

function setPlayerSkin(roomId, userId, skin) {
  const room = rooms.get(roomId);
  if (!room) return;
  if (!room.playerSkins) room.playerSkins = {};
  room.playerSkins[String(userId)] = skin;
}

function tick(now = Date.now()) {
  const changedRoomIds = [];

  rooms.forEach((room, roomId) => {
    if (botStrategy.processTick(room, roomId, now, tickHelpers)) {
      changedRoomIds.push(roomId);
    }
  });

  return changedRoomIds;
}

module.exports = {
  rooms,
  ALLOWED_BET_CHIPS_KC,
  CENTS_PER_KC,
  TURN_TIMEOUT_MS,
  DEFAULT_TIMER_CONFIG,
  createRoom,
  getRoom,
  getPlayerRoomId,
  listRooms,
  joinRoom,
  leaveRoom,
  getRoomState,
  placeBet,
  placeSideBet,
  updateAutoBet,
  updateTimerConfig,
  finishSettlementPhase,
  addBot,
  removeBot,
  moveSeat,
  startRound,
  hit,
  stand,
  doubleDown,
  split,
  advanceTurn,
  resolveDealerTurn,
  settleRound,
  setPlayerSkin,
  tick
};
