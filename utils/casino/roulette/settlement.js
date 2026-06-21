const { doesBetWin } = require('./coverage');
const { getOdds } = require('./odds');

function calculatePayouts(room) {
  const { spinResult, bets } = room.rounds[room.roundId];
  const payouts = {};

  for (const [playerId, playerBets] of Object.entries(bets)) {
    payouts[playerId] = playerBets.map(bet => {
      const won = doesBetWin(bet.type, spinResult.number);
      if (won) {
        const oddsFactor = getOdds(bet.type);
        return { ...bet, status: 'won', payout: bet.amount * oddsFactor };
      }
      return { ...bet, status: 'lost', payout: 0 };
    });
  }

  return payouts;
}

function calculateBalanceChange(bet) {
  return bet.status === 'won' ? bet.payout : -bet.amount;
}

function prepareSettlementUpdates(payouts) {
  return Object.entries(payouts).map(([playerId, playerPayouts]) => {
    let displayChange = 0;
    let payoutReturn = 0;
    const betIds = [];

    for (const payout of playerPayouts) {
      displayChange += calculateBalanceChange(payout);
      if (payout.status === 'won') {
        payoutReturn += payout.amount + payout.payout;
      }
      betIds.push(payout.betId);
    }

    return { playerId, displayChange, payoutReturn, bets: betIds };
  });
}

module.exports = { calculatePayouts, calculateBalanceChange, prepareSettlementUpdates };
