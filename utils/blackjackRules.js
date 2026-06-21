function getCardValue(rank) {
  if (['J', 'Q', 'K'].includes(rank)) return 10;
  if (rank === 'A') return 11;

  return Number(rank) || 0;
}

function calculateHandValue(hand) {
  const cards = Array.isArray(hand) ? hand : [];
  let total = 0;
  let aces = 0;

  cards.forEach((card) => {
    const value = getCardValue(card?.rank);
    total += value;
    if (card?.rank === 'A') aces += 1;
  });

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
}

function isSoft17(hand) {
  const cards = Array.isArray(hand) ? hand : [];
  let total = 0;
  let aces = 0;

  cards.forEach((card) => {
    const value = getCardValue(card?.rank);
    total += value;
    if (card?.rank === 'A') aces += 1;
  });

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total === 17 && aces > 0;
}

function isBust(hand) {
  return calculateHandValue(hand) > 21;
}

function isBlackjack(hand) {
  return Array.isArray(hand) && hand.length === 2 && calculateHandValue(hand) === 21;
}

module.exports = {
  calculateHandValue,
  isSoft17,
  isBust,
  isBlackjack
};
