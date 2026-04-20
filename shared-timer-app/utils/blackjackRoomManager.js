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
const MAX_BET_KC = 1000000;
const MAX_BET_CENTS = MAX_BET_KC * CENTS_PER_KC;
const TURN_TIMEOUT_MS = 90 * 1000;
const AUTO_START_DELAY_MS = 15 * 1000;
const SETTLEMENT_DISPLAY_MS = 1000;
const DEALER_ACTION_DELAY_MS = 1200;
const BOT_ACTION_DELAY_MS = 1400;
const BOT_DEFAULT_BET_CENTS = 100 * CENTS_PER_KC;

function normalizeMaxPlayers(maxPlayers = 5) {
  return ALLOWED_MAX_PLAYERS.has(Number(maxPlayers)) ? Number(maxPlayers) : 5;
}

function normalizeRoomId(roomId) {
  return String(roomId || '').trim();
}

function createPlayerState(user, seat) {
  return {
    userId: String(user.userId || user.id),
    username: user.username || user.displayName || `User ${seat}`,
    displayName: user.displayName || user.username || `User ${seat}`,
    isBot: Boolean(user.isBot),
    seat,
    currentBet: 0,
    hands: [],
    activeHandIndex: 0,
    done: false,
    connected: true,
    preferences: user.preferences || {}
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
  return player.currentBet <= 0 && (!player.hands || player.hands.length === 0) && !player.done;
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

function serializePlayer(player) {
  return {
    userId: player.userId,
    username: player.username,
    displayName: player.displayName || player.username,
    isBot: Boolean(player.isBot),
    seat: player.seat,
    currentBet: player.currentBet,
    activeHandIndex: player.activeHandIndex,
    hands: (player.hands || []).map((hand) => ({
      cards: (hand.cards || []).map((card) => serializeCard(card, true)),
      value: hand.value,
      bet: hand.bet,
      stood: hand.stood,
      busted: hand.busted,
      blackjack: hand.blackjack,
      done: hand.done,
      isAcesSplit: hand.isAcesSplit
    })),
    done: player.done,
    connected: player.connected,
    preferences: player.preferences || {}
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
  rooms.set(safeRoomId, {
    roomId: safeRoomId,
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

  return rooms.get(safeRoomId);
}

function getRoom(roomId) {
  const safeRoomId = normalizeRoomId(roomId);
  if (!safeRoomId) return null;
  return rooms.get(safeRoomId) || null;
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

function joinRoom(roomId, user) {
  if (!user?.userId) {
    throw new Error('Authenticated user is required.');
  }

  const room = getRoom(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }
  const existing = getPlayerByUserId(room, user.userId);

  if (existing) {
    existing.connected = true;
    existing.username = user.username || user.displayName || existing.username;
    existing.displayName = user.displayName || user.username || existing.displayName || existing.username;
    existing.preferences = user.preferences || existing.preferences || {};
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

function addBot(roomId) {
  const room = getRoom(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

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

function moveSeat(roomId, user, targetSeat) {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  const userId = user.userId || user.id;
  let player = getPlayerByUserId(room, userId);
  
  const nextSeat = Number.parseInt(targetSeat, 10);
  if (!Number.isInteger(nextSeat) || nextSeat < 1 || nextSeat > room.maxPlayers) {
    throw new Error('Invalid blackjack seat.');
  }

  if (room.players.some((entry) => entry.seat === nextSeat && String(entry.userId) !== String(userId))) {
    throw new Error('This blackjack seat is already occupied.');
  }

  if (!player) {
    // If not seated yet, perform a join-seat operation
    player = createPlayerState(user, nextSeat);
    room.players.push(player);
  } else {
    // Already seated, perform a switch
    if (player.seat === nextSeat) {
      return room;
    }
    if (!canSwitchSeat(player) || hasActiveRound(room)) {
      throw new Error('Seat switching is only available without an active hand.');
    }
    player.seat = nextSeat;
  }

  room.players = getOrderedPlayers(room);
  room.status = room.players.length > 0 ? 'betting' : 'waiting';
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
  if (amount > 0) {
    room.status = 'betting';
    maybeScheduleAutoStart(room, userId);
  } else {
    // If resetting to 0, check if we should go back to waiting
    const bettors = room.players.filter(p => p.currentBet > 0);
    if (bettors.length === 0) {
      room.status = 'waiting';
      room.autoStartAt = null;
    }
  }

  return room;
}

function maybeScheduleAutoStart(room, userId = null, now = Date.now()) {
  if (!room) return;
  if (!['waiting', 'betting'].includes(room.status)) {
    room.autoStartAt = null;
    room.autoStartQueuedByUserId = null;
    return;
  }

  const seatedPlayers = getOrderedPlayers(room);
  const activeBettors = seatedPlayers.filter((p) => p.currentBet > 0);

  if (!activeBettors.length) {
    room.autoStartAt = null;
    room.autoStartQueuedByUserId = null;
    return;
  }

  // AUTO-START: If everyone at the table has bet, start the round immediately
  if (activeBettors.length === seatedPlayers.length && seatedPlayers.length > 0) {
    room.autoStartAt = null;
    room.autoStartQueuedByUserId = null;
    startRound(room.roomId);
    return;
  }

  room.status = 'betting';
  if (!room.autoStartAt) {
    room.autoStartAt = now + AUTO_START_DELAY_MS;
    room.autoStartQueuedByUserId = userId || activeBettors[0]?.userId || null;
  }
}

function startRound(roomId, startedByUserId) {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  if (startedByUserId && !getPlayerByUserId(room, startedByUserId)) {
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
    drawIntoHand(room, player.hands[0].cards);
    syncPlayerState(player);
  });

  drawIntoHand(room, room.dealerHand);

  activePlayers.forEach((player) => {
    drawIntoHand(room, player.hands[0].cards);
    syncPlayerState(player);
  });

  drawIntoHand(room, room.dealerHand);

  activePlayers.forEach((player) => {
    syncPlayerState(player);
    if (player.hands[0].blackjack) {
      player.hands[0].stood = true;
      player.hands[0].done = true;
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

  const hand = player.hands[player.activeHandIndex];
  if (!hand || hand.done) {
    throw new Error('This hand is already complete.');
  }

  drawIntoHand(room, hand.cards);
  syncPlayerState(player);

  if (hand.busted || hand.value >= 21) {
    hand.done = true;
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

  const hand = player.hands[player.activeHandIndex];
  if (!hand || hand.done) {
     throw new Error('This hand is already complete.');
  }

  hand.stood = true;
  hand.done = true;

  advanceTurn(roomId);
  return room;
}

function advanceTurn(roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  const currentPlayer = getPlayerByUserId(room, room.currentPlayerTurn);
  if (currentPlayer) {
    // Check if the current player has more hands to play
    if (currentPlayer.hands.length > currentPlayer.activeHandIndex + 1) {
        currentPlayer.activeHandIndex += 1;
        
        // AUTO-SKIP if the next hand is already a Blackjack or 21 (e.g. from a split)
        const nextHand = currentPlayer.hands[currentPlayer.activeHandIndex];
        if (nextHand.blackjack || nextHand.value === 21) {
            nextHand.done = true;
            return advanceTurn(roomId);
        }

        room.turnDeadlineAt = Date.now() + TURN_TIMEOUT_MS;
        room.botActionAt = currentPlayer.isBot ? Date.now() + BOT_ACTION_DELAY_MS : null;
        return room;
    }
    // Player has no more hands to play
    currentPlayer.done = true;
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

function split(roomId, userId, userBalance) {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  if (room.status !== 'player_turns') {
    throw new Error('Split is only available during player turns.');
  }

  if (String(room.currentPlayerTurn) !== String(userId)) {
    throw new Error('It is not your turn.');
  }

  const player = getPlayerByUserId(room, userId);
  if (!player || player.done || player.currentBet <= 0) {
    throw new Error('This player cannot split right now.');
  }

  if (player.hands.length >= 2) {
    throw new Error('You can only split once per seat.');
  }

  const hand = player.hands[0];
  if (hand.cards.length !== 2) {
    throw new Error('Splitting is only allowed on the initial two cards.');
  }

  const rank1 = hand.cards[0].rank;
  const rank2 = hand.cards[1].rank;
  if (rank1 !== rank2) {
    throw new Error('You can only split cards of the same rank.');
  }

  if (!player.isBot && (!Number.isFinite(userBalance) || userBalance < hand.bet)) {
    throw new Error('Not enough KoalaCoins to split.');
  }

  const additionalBet = hand.bet;
  const splitCard = hand.cards.pop();
  
  // Update total bet committed by player
  player.currentBet += additionalBet;
  
  // Update hand 1
  hand.value = calculateHandValue(hand.cards);
  
  // Create hand 2
  const hand2 = createHandState(additionalBet);
  hand2.cards.push(splitCard);
  hand2.value = calculateHandValue(hand2.cards);
  player.hands.push(hand2);

  // Vegas Rule: Splitting Aces
  const isAces = rank1 === 'A';
  if (isAces) {
    hand.isAcesSplit = true;
    hand2.isAcesSplit = true;
    
    // Draw exactly one card for each
    drawIntoHand(room, hand.cards);
    drawIntoHand(room, hand2.cards);
    
    hand.stood = true;
    hand.done = true;
    hand2.stood = true;
    hand2.done = true;
  } else {
    // Normal split: Draw one card for the first hand immediately
    drawIntoHand(room, hand.cards);
  }

  syncPlayerState(player);

  if (player.done) {
    advanceTurn(roomId);
  }

  return { room, additionalBet };
}

function doubleDown(roomId, userId, userBalance) {
  const room = rooms.get(roomId);
  if (!room) {
    throw new Error('Blackjack room not found.');
  }

  if (room.status !== 'player_turns') {
    throw new Error('Double Down is only available during player turns.');
  }

  if (String(room.currentPlayerTurn) !== String(userId)) {
    throw new Error('It is not your turn.');
  }

  const player = getPlayerByUserId(room, userId);
  if (!player || player.done || player.currentBet <= 0) {
    throw new Error('This player cannot double down right now.');
  }

  const hand = player.hands[player.activeHandIndex];
  if (!hand || hand.done) {
    throw new Error('This hand is already complete.');
  }

  // Casino rule: Double Down only on initial 2 cards
  if (hand.cards.length !== 2) {
    throw new Error('Double Down is only allowed on the initial two cards.');
  }

  if (!player.isBot && (!Number.isFinite(userBalance) || userBalance < hand.bet)) {
    throw new Error('Not enough KoalaCoins to double down.');
  }

  const additionalBet = hand.bet;
  hand.bet += additionalBet;
  player.currentBet += additionalBet;

  drawIntoHand(room, hand.cards);
  syncPlayerState(player);

  // After Double Down, player gets exactly one card and is done
  hand.stood = true;
  hand.done = true;

  advanceTurn(roomId);
  return { room, additionalBet };
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

  const entries = [];
  const orderedPlayers = getOrderedPlayers(room).filter((player) => player.currentBet > 0);

  orderedPlayers.forEach((player) => {
    syncPlayerState(player);

    player.hands.forEach((hand, index) => {
      let result = 'push';
      if (hand.busted) {
        result = 'bust';
      } else if (hand.blackjack && dealerBlackjack) {
        result = 'push';
      } else if (hand.blackjack) {
        result = 'blackjack';
      } else if (dealerBust) {
        result = 'win';
      } else if (hand.value > dealerValue) {
        result = 'win';
      } else if (hand.value < dealerValue) {
        result = 'lose';
      } else {
        result = 'push';
      }

      const payout = result === 'blackjack' ? Math.floor(hand.bet * 2.5) : result === 'win' ? hand.bet * 2 : result === 'push' ? hand.bet : 0;
      const netProfit = payout - hand.bet;

      entries.push({
        userId: player.userId,
        username: player.username,
        displayName: player.displayName || player.username,
        isBot: Boolean(player.isBot),
        bet: hand.bet,
        handValue: hand.value,
        blackjack: hand.blackjack,
        busted: hand.busted,
        result,
        payout,
        netProfit,
        handIndex: index,
        totalHands: player.hands.length
      });
    });
  });

  room.lastSettlement = entries;
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
    settlement: entries
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

    if (room.status === 'player_turns' && room.turnDeadlineAt && room.currentPlayerTurn) {
      const currentPlayer = getPlayerByUserId(room, room.currentPlayerTurn);
      const isDisconnected = currentPlayer && currentPlayer.connected === false;
      const effectiveTimeout = isDisconnected ? 10 * 1000 : TURN_TIMEOUT_MS;

      // Anti-Zombie: Cap deadline if user is disconnected
      if (isDisconnected && room.turnDeadlineAt > now + 10000) {
        room.turnDeadlineAt = now + 10000;
        changed = true;
      }

      if (now >= room.turnDeadlineAt) {
        try {
          stand(roomId, room.currentPlayerTurn);
          changed = true;
        } catch (err) {
          room.turnDeadlineAt = now + effectiveTimeout;
        }
      }
    }

    if (room.status === 'player_turns' && room.currentPlayerTurn) {
      const currentPlayer = getPlayerByUserId(room, room.currentPlayerTurn);
      if (currentPlayer?.isBot) {
        if (!room.botActionAt) {
          room.botActionAt = now + BOT_ACTION_DELAY_MS;
        } else if (now >= room.botActionAt) {
          try {
            const activeHand = currentPlayer.hands[currentPlayer.activeHandIndex];
            if (!activeHand) {
              stand(roomId, currentPlayer.userId);
              return;
            }

            // Basic Bot Split Logic
            const canSplit = currentPlayer.hands.length === 1 && activeHand.cards.length === 2 && activeHand.cards[0].rank === activeHand.cards[1].rank;
            if (canSplit) {
              const rank = activeHand.cards[0].rank;
              // Split 8s and Aces (Always) or 10s (if aggressive) - staying conservative here
              if (['A', '8', '9'].includes(rank)) {
                split(roomId, currentPlayer.userId, 999999);
                changed = true;
                return;
              }
            }

            if (activeHand.value < 17 && !activeHand.blackjack && !activeHand.busted) {
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
  createRoom,
  getRoom,
  getPlayerRoomId,
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
  doubleDown,
  split,
  advanceTurn,
  resolveDealerTurn,
  settleRound,
  tick
};
