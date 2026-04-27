import React from 'react';
import { getChipImage, CHIP_VALUES } from '../../casino/chipConfig';

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function bestChipValue(amountKC) {
  for (let i = CHIP_VALUES.length - 1; i >= 0; i--) {
    if (CHIP_VALUES[i] <= amountKC) return CHIP_VALUES[i];
  }
  return CHIP_VALUES[0];
}

// Standard roulette layout: 3 rows, 12 columns (numbers 1-36), plus 0
// Row order from top: 3,6,9,...36 / 2,5,8,...35 / 1,4,7,...34
const ROWS = [
  [3,6,9,12,15,18,21,24,27,30,33,36],
  [2,5,8,11,14,17,20,23,26,29,32,35],
  [1,4,7,10,13,16,19,22,25,28,31,34],
];

function getNumColor(n) {
  if (n === 0) return 'green';
  return RED_NUMBERS.has(n) ? 'red' : 'black';
}

export default function RouletteBettingTable({ onBet, onRemove, canBet, eraseMode, myUserId, playerBets, playerColors, playerSkins }) {
  const BetZone = ({ type, label, className, children }) => {
    const betsOnField = playerBets?.[type] || {};
    const entries = Object.entries(betsOnField);
    const hasSelfBet = entries.some(([uid]) => uid === myUserId);

    const handleClick = () => canBet && onBet(type);
    const handleContextMenu = (e) => {
      e.preventDefault();
      if (canBet && onRemove) onRemove(type);
    };

    return (
      <div
        className={`bet-zone ${className || ''} ${canBet ? 'bet-zone--active' : ''} ${hasSelfBet ? 'bet-zone--has-bet' : ''} ${eraseMode && canBet ? 'bet-zone--erase-mode' : ''}`}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        title={type}
      >
        {children || label}
        {entries.length > 0 && (
          <span className="bet-zone-chips">
            {entries.map(([uid, amount]) => {
              const skinName = playerSkins?.[uid] || 'default';
              const chipVal = bestChipValue(amount);
              const img = getChipImage(chipVal, skinName);
              return img ? (
                <span key={uid} className="bet-zone-chip bet-zone-chip--image" title={`${amount} KC`}>
                  <img src={img} alt={`${amount} KC`} />
                </span>
              ) : (
                <span
                  key={uid}
                  className="bet-zone-chip"
                  style={{ background: playerColors?.[uid] || '#888' }}
                  title={`${amount} KC`}
                >
                  {amount}
                </span>
              );
            })}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="roulette-table">
      <div className="roulette-table-grid">
        {/* Zero */}
        <div className="roulette-zero-col">
          <BetZone type="straight_0" className="bet-zone--number bet-zone--green">0</BetZone>
        </div>

        {/* Number grid */}
        <div className="roulette-number-grid">
          {ROWS.map((row, rowIdx) => (
            <div key={rowIdx} className="roulette-row">
              {row.map(num => (
                <BetZone
                  key={num}
                  type={`straight_${num}`}
                  className={`bet-zone--number bet-zone--${getNumColor(num)}`}
                >
                  {num}
                </BetZone>
              ))}
              {/* Column bets on the right */}
              <BetZone type={`column_${3 - rowIdx}`} className="bet-zone--column">2:1</BetZone>
            </div>
          ))}
        </div>
      </div>

      {/* Dozens row */}
      <div className="roulette-dozens">
        <BetZone type="dozen_1" className="bet-zone--outside">1st 12</BetZone>
        <BetZone type="dozen_2" className="bet-zone--outside">2nd 12</BetZone>
        <BetZone type="dozen_3" className="bet-zone--outside">3rd 12</BetZone>
      </div>

      {/* Outside bets row */}
      <div className="roulette-outside">
        <BetZone type="range_1to18" className="bet-zone--outside">1-18</BetZone>
        <BetZone type="even" className="bet-zone--outside">Even</BetZone>
        <BetZone type="red" className="bet-zone--outside bet-zone--red-btn">♦</BetZone>
        <BetZone type="black" className="bet-zone--outside bet-zone--black-btn">♦</BetZone>
        <BetZone type="odd" className="bet-zone--outside">Odd</BetZone>
        <BetZone type="range_19to36" className="bet-zone--outside">19-36</BetZone>
      </div>
    </div>
  );
}
