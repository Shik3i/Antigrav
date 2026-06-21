const assert = require('assert');
const { createShoe, reshuffleShoe } = require('../utils/blackjackCards');

function totalCards(room) {
  return room.shoe.length + room.discardPile.length + (room.burnCard ? 1 : 0);
}

const room = createShoe(6);
assert.strictEqual(totalCards(room), 312, 'fresh 6-deck shoe should account for all cards including burn card');

reshuffleShoe(room);
assert.strictEqual(totalCards(room), 312, 'reshuffle should preserve the previous burn card in the total card pool');

reshuffleShoe(room);
assert.strictEqual(totalCards(room), 312, 'repeated reshuffles should not shrink the shoe');

console.log('blackjack shoe accounting regression passed');
