const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUIT_CODES = {
  hearts: 'H',
  diamonds: 'D',
  clubs: 'C',
  spades: 'S'
};

function createDeck() {
  const cards = [];

  SUITS.forEach((suit) => {
    RANKS.forEach((rank) => {
      cards.push({
        suit,
        rank,
        code: `${rank}${SUIT_CODES[suit]}`
      });
    });
  });

  return cards;
}

function shuffleCards(cards) {
  const shuffled = Array.isArray(cards) ? [...cards] : [];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

function createShoe(deckCount = 6) {
  const shoe = [];

  for (let i = 0; i < deckCount; i += 1) {
    shoe.push(...createDeck());
  }

  const shuffled = shuffleCards(shoe);
  const burnCard = shuffled.shift() || null;

  return {
    shoe: shuffled,
    discardPile: [],
    burnCard,
    deckCount,
    reshuffleRemainingPercent: 25,
    needsShuffle: false
  };
}

function drawCardFromShoe(roomState) {
  if (!roomState?.shoe?.length) {
    throw new Error('The blackjack shoe is empty.');
  }

  return roomState.shoe.shift();
}

function discardCards(roomState, cards) {
  if (!roomState) return;
  if (!Array.isArray(roomState.discardPile)) {
    roomState.discardPile = [];
  }

  (cards || []).filter(Boolean).forEach((card) => {
    roomState.discardPile.push(card);
  });
}

function shouldReshuffle(roomState) {
  if (!roomState) return false;

  const deckCount = Number(roomState.deckCount) || 6;
  const fullShoeSize = 52 * deckCount;
  const reshufflePercent = Number(roomState.reshuffleRemainingPercent) || 25;
  const threshold = Math.floor(fullShoeSize * (reshufflePercent / 100));

  return (roomState.shoe?.length || 0) <= threshold;
}

function reshuffleShoe(roomState) {
  const combinedCards = [
    ...(Array.isArray(roomState?.shoe) ? roomState.shoe : []),
    ...(Array.isArray(roomState?.discardPile) ? roomState.discardPile : []),
    ...(roomState?.burnCard ? [roomState.burnCard] : [])
  ];

  const shuffled = shuffleCards(combinedCards);
  roomState.shoe = shuffled;
  roomState.discardPile = [];
  roomState.burnCard = roomState.shoe.shift() || null;
  roomState.needsShuffle = false;

  return roomState;
}

function serializeCard(card, visible = true) {
  if (!card) return null;
  if (!visible) {
    return {
      suit: 'hidden',
      rank: '?',
      code: 'XX',
      visible: false
    };
  }

  return {
    suit: card.suit,
    rank: card.rank,
    code: card.code,
    visible: true
  };
}

function serializeDealerHand(hand, revealHoleCard) {
  if (!Array.isArray(hand)) return [];

  return hand.map((card, index) => serializeCard(card, revealHoleCard || index === 0));
}

module.exports = {
  createDeck,
  shuffleCards,
  createShoe,
  drawCardFromShoe,
  discardCards,
  shouldReshuffle,
  reshuffleShoe,
  serializeCard,
  serializeDealerHand
};
