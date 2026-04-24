import { useState } from 'react';
import { buildRealisticGroups, buildRealisticStack, formatKC } from '../utils/formatters';

export default function ChipStack({ amount, onClick, isPending }) {
  const chips = buildRealisticStack(amount);
  const groupedChips = buildRealisticGroups(amount);
  const [showTooltip, setShowTooltip] = useState(false);

  if (!amount || amount <= 0) return null;

  return (
    <div
      className={`blackjack-realistic-stack ${isPending ? 'pending' : ''}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={onClick}
    >
      <div className={`chips-container${isPending ? ' grouped' : ''}`}>
        {(isPending ? groupedChips : chips.map((value) => ({ value, count: 1 }))).flatMap((entry, groupIndex) => {
          const count = isPending ? entry.count : 1;
          return Array.from({ length: count }, (_, index) => {
            const absoluteIndex = isPending ? index : groupIndex;
            const offsetX = isPending ? groupIndex * 16 : absoluteIndex * 0.4;
            const offsetY = absoluteIndex * 4;
            const value = entry.value;
            return (
              <div
                key={`${value}-${groupIndex}-${index}`}
                className="casino-chip-layered"
                style={{
                  '--chip-color': value >= 1000 ? '#1e1b4b' : value >= 500 ? '#7c3aed' : value >= 100 ? '#dc2626' : value >= 50 ? '#0ea5e9' : value >= 25 ? '#ec4899' : value >= 10 ? '#22c55e' : value >= 5 ? '#f59e0b' : '#f8fafc',
                  bottom: `${offsetY}px`,
                  left: `${offsetX}px`,
                  zIndex: absoluteIndex + groupIndex,
                  boxShadow: `0 ${2 + absoluteIndex * 0.5}px ${4 + absoluteIndex * 0.5}px rgba(0,0,0,0.4)`
                }}
              >
                <div className="chip-inner-ring" />
                <span className="chip-val-tiny" style={{ opacity: index === count - 1 ? 1 : 0.6 }}>{value}</span>
              </div>
            );
          });
        })}
      </div>

      {showTooltip && (
        <div className="chip-stack-tooltip">
          {formatKC(amount)}
          {isPending && <span className="pending-tag">PENDING (Click to clear)</span>}
        </div>
      )}
    </div>
  );
}
