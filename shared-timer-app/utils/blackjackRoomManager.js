const {
  createShoe,
  drawCardFromShoe,
  discardCards,
  shouldReshuffle,
  reshuffleShoe,
  serializeCard,
  serializeDealerHand
} = require('./blackjackCards');
const { calculateHandValue, isBust, isBlackjack } = require('./blackjackRules');

const rooms = new Map();
const ALLOWED_MAX_PLAYERS = new Set([3, 5]);
const ALLOWED_BET_CHIPS_KC = [1, 5, 10, 50, 100, 500, 1000];
const CENTS_PER_KC = 100;
const TURN_TIMEOUT_MS = 90 * 1000;
const AUTO_START_DELAY_MS = 6 * 1000;
const SETTLEMENT_DISPLAY_MS = 5 * 1000;
const DEALER_ACTION_DELAY_MS = 1200;
const BOT_ACTION_DELAY_MS = 1400;
const BOT_DEFAULT_BET_CENTS = 100 * CENTS_PER_KC;

function normalizeMaxPlayers(maxPlayers = 5) {
  return ALLOWED_MAX_PLAYERS.has(Number(maxPlayers)) ? Number(maxPlayers) : 5;
}

function createPlayerState(user, seat) {
  return {
    userId: user.userId,
    username: user.username || user.displayName || `User ${seat}`,
    displayName: user.displayName || user.username || `User ${seat}`,
    isBot: Boolean(user.isBot),
    seat,
    currentBet: 0,
    hand: [],
    handValue: 0,
    stood: false,
    busted: false,
    blackjack: false,
    done: false,
    connected: true
  };
}

function resetPlayerRoundState(player) {
  player.hand = [];
  player.handValue = 0;
  player.stood = false;
  player.busted = false;
  player.blackjack = false;
  player.done = false;
}

function getOrderedPlayers(room) {
  return [...room.players].sort((a, b) => a.seat - b.seat);
}

function getNextFreeSeat(room) {
  const taken = new Set(room.players.map((player) => player.seat));
  for (let seat = 1; seat <= room.maxPlayers; seat += 1) {
    if (!taken.has(seat)) return seat;
  }

  return null;
}

function canSwitchSeat(player) {
  if (!player) return false;
  return player.currentBet <= 0 && (!player.hand || player.hand.length === 0) && !player.done;
}

function hasActiveRound(room) {
  return ['dealing', 'player_turns', 'dealer_turn', 'settlement'].includes(room.status);
}

function getPlayerByUserId(room, userId) {
  return room.players.find((player) => String(player.userId) === String(userId)) || null;
}

function getDealerPhase(room) {
  return room?.dealerPhase || null;
}

function syncPlayerState(player) {
  player.handValue = calculateHandValue(player.hand);
  player.busted = isBust(player.hand);
  player.blackjack = isBlackjack(player.hand);
  player.done = player.busted || player.stood || player.blackjack;
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

function serializePlayer(player) {
  return {
    userId: player.userId,
    username: player.username,
    displayName: player.displayName || player.username,
    isBot: Boolean(player.isBot),
    seat: player.seat,
    currentBet: player.currentBet,
    hand: (player.hand || []).map((card) => serializeCard(card, true)),
    handValue: player.handValue,
    stood: player.stood,
    busted: player.busted,
    blackjack: player.blackjack,
    done: player.done,
    connected: player.connected
  };
}

function serializeSettlement(results) {
  return (results || []).map((entry) => ({
    userId: entry.userId,
    username: entry.username,
    isBot: Boolean(entry.isBot),
    bet: entry.bet,
    handValue: entry.handValue,
    blackjack: entry.blackjack,
    busted: entry.busted,
    result: entry.result,
    payout: entry.payout,
    netProfit: entry.netProfit
  }));
}

function getOrCreateRoom(roomId, maxPlayers = 5) {
  const safeMaxPlayers = normalizeMaxPlayers(maxPlayers);

  if (!rooms.has(roomId)) {
    const shoeState = createShoe(6);
    rooms.set(roomId, {
      roomId,
      game: 'blackjack',
      status: 'waiting',
      maxPlayers: safeMaxPlayers,
      roundId: 1,
      players: [],
      dealerHand: [],
      currentPlayerTurn: null,
      turnDeadlineAt: null,
      autoStartAt: null,
      autoStartQueuedByUserId: null,
      settlementCompleteAt: null,
      dealerPhase: null,
      dealerActionAt: null,
      botActionAt: null,
      lastSettlement: [],
      lastSettlementRoundId: null,
      lastAppliedSettlementRoundId: null,
      ...shoeState
    });
  }

  return rooms.get(roomId);
}

function listRooms() {
  return [...rooms.values()]
    .map((room) => ({
      roomId: room.roomId,
      game: room.game,
      maxPlayers: room.maxPlayers,
      status: room.status,
      playerCount: room.players.length,
      connectedCount: room.players.filter((player) => player.connected).length,
      occupiedSeats: getOrderedPlayers(room).map((player) => ({
        userId: player.userId,
        username: player.username,
        displayName: player.displayName || player.username,
        isBot: Boolean(player.isBot),
        seat: player.seat,
        connected: player.connected
      })),
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

function joinRoom(roomId, user, maxPlayers = 5) {
  if (!user?.userId) {
    throw new Error('Authenticated user is required.');
  }

  const room = getOrCreateRoom(roomId, maxPlayers);
  const existing = getPlayerByUserId(room, user.userId);

  if (existing) {
    existing.connected = true;
    existing.username = user.username || user.displayName || existing.username;
    existing.displayName = user.displayName || user.username || existing.displayName || existing.username;
    return room;
  }

  if (room.players.length >= room.maxPlayers) {
    throw new Error('This blackjack table is full.');
  }

  const seat = getNextFreeSeat(room);
  if (!seat) {
    throw new Error('No free blackjack seat is available.');
  }

  room.players.push(createPlayerState(user, seat));
  room.players = getOrderedPlayers(room);
  room.status = room.players.length > 0 ? 'betting' : 'waiting';
  maybeScheduleAutoStart(room);

  return room;
}

function addBot(roomId, maxPlayers = 5) {
  const room = getOrCreateRoom(roomId, maxPlayers);

  if (room.players.length >= room.maxPlayers) {
    throw new Error('This blackjack table is full.');
  }

  const botNumber = room.players.filter((player) => player.isBot).length + 1;
  const seat = getNextFreeSeat(room);
  if (!seat) {
    throw new Error('No free blackjack seat is available.');
  }

  const botId = `blackjack-bot-${room.roomId}-${botNumber}`;
  room.players.push(createPlayerState({
    userId: botId,
    username: `blackjackbot${botNumber}`,
    displayName: `Blackjack Bot ${botNumber}`,
    isBot: true
  }, seat));
  room.players = getOrderedPlayers(room);
  room.status = room.players.length > 0 ? 'betting' : 'waiting';
  maybeScheduleAutoStart(room);

  return room;
}

function moveSeat(roomId, userId, targetSeat) {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  const player = getPlayerByUserId(room, userId);
  if (!player) {
    throw new Error('Player is not seated at this blackjack table.');
  }

  const nextSeat = Number.parseInt(targetSeat, 10);
  if (!Number.isInteger(nextSeat) || nextSeat < 1 || nextSeat > room.maxPlayers) {
    throw new Error('Invalid blackjack seat.');
  }

  if (player.seat === nextSeat) {
    return room;
  }

  if (room.players.some((entry) => entry.seat === nextSeat)) {
    throw new Error('This blackjack seat is already occupied.');
  }

  if (!canSwitchSeat(player) || hasActiveRound(room)) {
    throw new Error('Seat switching is only available without an active hand.');
  }

  player.seat = nextSeat;
  room.players = getOrderedPlayers(room);
  return room;
}

function leaveRoom(roomId, userId) {
  const room = rooms.get(roomId);
  if (!room) return null;

  const player = getPlayerByUserId(room, userId);
  if (!player) return room;

  if (hasActiveRound(room) && player.currentBet > 0) {
    player.connected = false;
  } else {
    room.players = room.players.filter((entry) => String(entry.userId) !== String(userId));
  }

  if (room.players.length === 0) {
    rooms.delete(roomId);
    return null;
  }

  if (!hasActiveRound(room)) {
    room.status = 'betting';
    maybeScheduleAutoStart(room);
  }

  return room;
}

function getRoomState(roomId, viewerUserId = null) {
  const room = rooms.get(roomId);
  if (!room) return null;

  const revealHoleCard = room.status === 'dealer_turn' || room.status === 'settlement';

  return {
    roomId: room.roomId,
    game: room.game,
    status: room.status,
    maxPlayers: room.maxPlayers,
    roundId: room.roundId,
    players: getOrderedPlayers(room).map(serializePlayer),
    dealerHand: serializeDealerHand(room.dealerHand, revealHoleCard),
    dealerHandValue: revealHoleCard ? calculateHandValue(room.dealerHand) : calculateHandValue(room.dealerHand.slice(0, 1)),
    currentPlayerTurn: room.currentPlayerTurn,
    turnDeadlineAt: room.turnDeadlineAt,
    autoStartAt: room.autoStartAt,
    dealerPhase: getDealerPhase(room),
    dealerActionAt: room.dealerActionAt,
    shoeRemaining: room.shoe.length,
    discardCount: room.discardPile.length,
    needsShuffle: room.needsShuffle,
    reshuffleRemainingPercent: room.reshuffleRemainingPercent,
    deckCount: room.deckCount,
    burnCard: Boolean(room.burnCard),
    allowedBets: ALLOWED_BET_CHIPS_KC,
    viewerUserId,
    lastSettlement: serializeSettlement(room.lastSettlement),
    lastSettlementRoundId: room.lastSettlementRoundId
  };
}

function validateBetAmount(amount) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('Bet must be a positive whole-KC amount.');
  }

  const asCents = amount;
  if (asCents % CENTS_PER_KC !== 0) {
    throw new Error('Bet must align with whole KC chip values.');
  }

  const inKC = asCents / CENTS_PER_KC;
  if (!Number.isInteger(inKC) || inKC <= 0) {
    throw new Error('Bet must align with whole KC chip values.');
  }

  if (!ALLOWED_BET_CHIPS_KC.includes(inKC)) {
    throw new Error('Unsupported chip denomination total.');
  }
}

function placeBet(roomId, userId, amount, userBalance) {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  if (!['waiting', 'betting'].includes(room.status)) {
    throw new Error('Bets can only be placed before the round starts.');
  }

  const player = getPlayerByUserId(room, userId);
  if (!player) {
    throw new Error('Player is not seated at this blackjack table.');
  }

  validateBetAmount(amount);

  if (!player.isBot && (!Number.isFinite(userBalance) || userBalance < amount)) {
    throw new Error('Not enough KoalaCoins for that bet.');
  }

  player.currentBet = amount;
  room.status = 'betting';
  maybeScheduleAutoStart(room, userId);

  return room;
}

function maybeScheduleAutoStart(room, userId = null, now = Date.now()) {
  if (!room) return;
  if (!['waiting', 'betting'].includes(room.status)) {
    room.autoStartAt = null;
    room.autoStartQueuedByUserId = null;
    return;
  }

  const activePlayers = getOrderedPlayers(room).filter((player) => player.currentBet > 0);
  if (!activePlayers.length) {
    room.autoStartAt = null;
    room.autoStartQueuedByUserId = null;
    return;
  }

  room.status = 'betting';
  room.autoStartAt = now + AUTO_START_DELAY_MS;
  room.autoStartQueuedByUserId = userId || activePlayers[0]?.userId || null;
}

function startRound(roomId, startedByUserId) {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  if (!getPlayerByUserId(room, startedByUserId)) {
    throw new Error('Only seated players can start a blackjack round.');
  }

  const activePlayers = getOrderedPlayers(room).filter((player) => player.currentBet > 0);
  if (activePlayers.length === 0) {
    throw new Error('At least one player needs a bet before the round can start.');
  }

  if (room.needsShuffle || shouldReshuffle(room)) {
    reshuffleShoe(room);
  }

  room.status = 'dealing';
  room.currentPlayerTurn = null;
  room.turnDeadlineAt = null;
  room.autoStartAt = null;
  room.autoStartQueuedByUserId = null;
  room.settlementCompleteAt = null;
  room.dealerPhase = null;
  room.dealerActionAt = null;
  room.botActionAt = null;
  room.lastSettlement = [];
  room.lastSettlementRoundId = null;
  room.dealerHand = [];

  room.players.forEach((player) => resetPlayerRoundState(player));

  activePlayers.forEach((player) => {
    drawIntoHand(room, player.hand);
    syncPlayerState(player);
  });

  drawIntoHand(room, room.dealerHand);

  activePlayers.forEach((player) => {
    drawIntoHand(room, player.hand);
    syncPlayerState(player);
  });

  drawIntoHand(room, room.dealerHand);

  activePlayers.forEach((player) => {
    syncPlayerState(player);
    if (player.blackjack) {
      player.stood = true;
      player.done = true;
    }
  });

  room.status = 'player_turns';
  room.currentPlayerTurn = activePlayers.find((player) => !player.done)?.userId || null;
  room.turnDeadlineAt = room.currentPlayerTurn ? Date.now() + TURN_TIMEOUT_MS : null;
  room.botActionAt = room.currentPlayerTurn && getPlayerByUserId(room, room.currentPlayerTurn)?.isBot ? Date.now() + BOT_ACTION_DELAY_MS : null;

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

  if (room.status !== 'player_turns') {
    throw new Error('Hit is only available during player turns.');
  }

  if (String(room.currentPlayerTurn) !== String(userId)) {
    throw new Error('It is not your turn.');
  }

  const player = getPlayerByUserId(room, userId);
  if (!player || player.done || player.currentBet <= 0) {
    throw new Error('This player cannot hit right now.');
  }

  drawIntoHand(room, player.hand);
  syncPlayerState(player);

  if (player.busted) {
    player.done = true;
    advanceTurn(roomId);
  }

  return room;
}

function stand(roomId, userId) {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  if (room.status !== 'player_turns') {
    throw new Error('Stand is only available during player turns.');
  }

  if (String(room.currentPlayerTurn) !== String(userId)) {
    throw new Error('It is not your turn.');
  }

  const player = getPlayerByUserId(room, userId);
  if (!player || player.done || player.currentBet <= 0) {
    throw new Error('This player cannot stand right now.');
  }

  player.stood = true;
  player.done = true;

  advanceTurn(roomId);
  return room;
}

function advanceTurn(roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  const orderedPlayers = getOrderedPlayers(room).filter((player) => player.currentBet > 0);
  if (orderedPlayers.length === 0) {
    room.currentPlayerTurn = null;
    room.turnDeadlineAt = null;
    room.status = 'waiting';
    return room;
  }

  const currentIndex = orderedPlayers.findIndex((player) => String(player.userId) === String(room.currentPlayerTurn));
  const nextPlayer = orderedPlayers.slice(currentIndex + 1).find((player) => !player.done)
    || orderedPlayers.find((player) => !player.done);

  if (!nextPlayer) {
    room.currentPlayerTurn = null;
    room.turnDeadlineAt = null;
    beginDealerTurn(roomId);
    return room;
  }

  room.currentPlayerTurn = nextPlayer.userId;
  room.turnDeadlineAt = Date.now() + TURN_TIMEOUT_MS;
  room.botActionAt = nextPlayer.isBot ? Date.now() + BOT_ACTION_DELAY_MS : null;
  room.status = 'player_turns';
  return room;
}

function beginDealerTurn(roomId, now = Date.now()) {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  room.status = 'dealer_turn';
  room.dealerPhase = 'reveal';
  room.dealerActionAt = now + DEALER_ACTION_DELAY_MS;

  return room;
}

function resolveDealerTurn(roomId, now = Date.now()) {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  if (room.status !== 'dealer_turn') {
    return room;
  }

  const dealerValue = calculateHandValue(room.dealerHand);

  if (room.dealerPhase === 'reveal') {
    if (dealerValue > 21) {
      room.dealerPhase = 'bust';
    } else if (dealerValue < 17) {
      room.dealerPhase = 'draw';
    } else {
      room.dealerPhase = 'stand';
    }

    room.dealerActionAt = now + DEALER_ACTION_DELAY_MS;
    return room;
  }

  if (room.dealerPhase === 'draw') {
    drawIntoHand(room, room.dealerHand);
    const nextValue = calculateHandValue(room.dealerHand);

    if (nextValue > 21) {
      room.dealerPhase = 'bust';
    } else if (nextValue < 17) {
      room.dealerPhase = 'draw';
    } else {
      room.dealerPhase = 'stand';
    }

    room.dealerActionAt = now + DEALER_ACTION_DELAY_MS;
    return room;
  }

  if (room.dealerPhase === 'stand' || room.dealerPhase === 'bust') {
    return settleRound(roomId);
  }

  room.dealerPhase = dealerValue >= 17 ? 'stand' : 'draw';
  room.dealerActionAt = now + DEALER_ACTION_DELAY_MS;
  return room;
}

function finishSettlementPhase(room, now = Date.now()) {
  discardCards(room, room.dealerHand);
  room.players.forEach((player) => {
    discardCards(room, player.hand);
  });

  room.dealerHand = [];
  room.currentPlayerTurn = null;
  room.turnDeadlineAt = null;
  room.autoStartAt = null;
  room.autoStartQueuedByUserId = null;
  room.settlementCompleteAt = null;
  room.botActionAt = null;

  room.players.forEach((player) => {
    player.currentBet = 0;
    resetPlayerRoundState(player);
  });

  room.roundId += 1;
  room.status = room.players.length > 0 ? 'betting' : 'waiting';
  updateShuffleFlag(room);
  maybeScheduleAutoStart(room, null, now);
}

function settleRound(roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  room.status = 'settlement';
  const dealerValue = calculateHandValue(room.dealerHand);
  const dealerBust = dealerValue > 21;
  const dealerBlackjack = isBlackjack(room.dealerHand);

  const results = getOrderedPlayers(room)
    .filter((player) => player.currentBet > 0)
    .map((player) => {
      syncPlayerState(player);

      let result = 'push';
      if (player.busted) {
        result = 'bust';
      } else if (player.blackjack && dealerBlackjack) {
        result = 'push';
      } else if (player.blackjack) {
        result = 'blackjack';
      } else if (dealerBust) {
        result = 'win';
      } else if (player.handValue > dealerValue) {
        result = 'win';
      } else if (player.handValue < dealerValue) {
        result = 'lose';
      }

      const payout = ['win', 'blackjack'].includes(result) ? player.currentBet * 2 : result === 'push' ? player.currentBet : 0;
      const netProfit = payout - player.currentBet;

      return {
        userId: player.userId,
        username: player.username,
        displayName: player.displayName || player.username,
        isBot: Boolean(player.isBot),
        bet: player.currentBet,
        handValue: player.handValue,
        blackjack: player.blackjack,
        busted: player.busted,
        result,
        payout,
        netProfit
      };
    });

  discardCards(room, room.dealerHand);
  room.players.forEach((player) => {
    discardCards(room, player.hand);
  });

  room.lastSettlement = results;
  room.lastSettlementRoundId = room.roundId;
  room.currentPlayerTurn = null;
  room.turnDeadlineAt = null;
  room.autoStartAt = null;
  room.autoStartQueuedByUserId = null;
  room.settlementCompleteAt = Date.now() + SETTLEMENT_DISPLAY_MS;
  room.botActionAt = null;
  room.dealerPhase = null;
  room.dealerActionAt = null;

  room.status = room.players.length > 0 ? 'settlement' : 'waiting';
  updateShuffleFlag(room);

  return {
    room,
    settlement: results
  };
}

function tick(now = Date.now()) {
  const changedRoomIds = [];

  rooms.forEach((room, roomId) => {
    let changed = false;

    if (['waiting', 'betting'].includes(room.status)) {
      const idleBots = getOrderedPlayers(room).filter((player) => player.isBot && player.currentBet <= 0);
      if (idleBots.length > 0) {
        idleBots.forEach((bot) => {
          bot.currentBet = BOT_DEFAULT_BET_CENTS;
        });
        maybeScheduleAutoStart(room, idleBots[0]?.userId || null, now);
        changed = true;
      }
    }

    if (room.status === 'settlement' && room.settlementCompleteAt && now >= room.settlementCompleteAt) {
      finishSettlementPhase(room, now);
      changed = true;
    }

    if (room.status === 'dealer_turn' && room.dealerActionAt && now >= room.dealerActionAt) {
      resolveDealerTurn(roomId, now);
      changed = true;
    }

    if (room.status === 'player_turns' && room.turnDeadlineAt && now >= room.turnDeadlineAt && room.currentPlayerTurn) {
      try {
        stand(roomId, room.currentPlayerTurn);
        changed = true;
      } catch (err) {
        room.turnDeadlineAt = now + TURN_TIMEOUT_MS;
      }
    }

    if (room.status === 'player_turns' && room.currentPlayerTurn) {
      const currentPlayer = getPlayerByUserId(room, room.currentPlayerTurn);
      if (currentPlayer?.isBot) {
        if (!room.botActionAt) {
          room.botActionAt = now + BOT_ACTION_DELAY_MS;
        } else if (now >= room.botActionAt) {
          try {
            if (currentPlayer.handValue < 17 && !currentPlayer.blackjack && !currentPlayer.busted) {
              hit(roomId, currentPlayer.userId);
            } else {
              stand(roomId, currentPlayer.userId);
            }
            changed = true;
          } catch (err) {
            room.botActionAt = now + BOT_ACTION_DELAY_MS;
          }
        }
      }
    }

    if (['waiting', 'betting'].includes(room.status) && room.autoStartAt && now >= room.autoStartAt) {
      const starterId = room.autoStartQueuedByUserId || getOrderedPlayers(room).find((player) => player.currentBet > 0)?.userId;
      if (starterId) {
        try {
          startRound(roomId, starterId);
          changed = true;
        } catch (err) {
          maybeScheduleAutoStart(room, starterId, now);
        }
      } else {
        room.autoStartAt = null;
        room.autoStartQueuedByUserId = null;
        changed = true;
      }
    }

    if (changed) {
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
  getOrCreateRoom,
  listRooms,
  joinRoom,
  leaveRoom,
  getRoomState,
  placeBet,
  addBot,
  moveSeat,
  startRound,
  hit,
  stand,
  advanceTurn,
  resolveDealerTurn,
  settleRound,
  tick
};
