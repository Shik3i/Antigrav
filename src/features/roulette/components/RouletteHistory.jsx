import React from 'react';

export default function RouletteHistory({ history }) {
  if (!history || history.length === 0) return null;

  return (
    <div className="roulette-history">
      <h3>Last Rounds</h3>
      <table className="history-table">
        <thead>
          <tr>
            <th>Number</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {history.map((round, i) => (
            <tr key={round.roundId || i} className={round.change >= 0 ? 'history-row--win' : 'history-row--loss'}>
              <td>
                <span className={`history-number history-number--${round.color}`}>
                  {round.number}
                </span>
              </td>
              <td className={round.change >= 0 ? 'history-change--win' : 'history-change--loss'}>
                {round.change >= 0 ? '+' : ''}{round.change} KC
                {round.wonBets?.length > 0 && (
                  <div className="history-won-bets">
                    {round.wonBets.map((t, j) => <span key={j} className="history-won-badge">{t}</span>)}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
