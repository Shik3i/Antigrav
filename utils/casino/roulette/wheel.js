const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

function getColor(number) {
  if (number === 0) return 'green';
  return RED_NUMBERS.includes(number) ? 'red' : 'black';
}

function spin(roundId) {
  const number = Math.floor(Math.random() * 37); // 0-36
  return {
    roundId,
    number,
    color: getColor(number),
    timestamp: Date.now(),
  };
}

module.exports = { spin, getColor };
