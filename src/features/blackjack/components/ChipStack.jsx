import { useState } from 'react';
import { buildRealisticGroups, buildRealisticStack, formatKC } from '../utils/formatters';
import { getChipColor, getChipTextColor } from '../../casino/chipConfig';
import { useChipSkin } from '../../casino/ChipSkinContext';

export default function ChipStack({ amount, onClick, isPending, title, skin: skinProp }) {
  const { skin: skinCtx, getSkinImage } = useChipSkin();
  const skin = skinProp ?? skinCtx;
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
      title={title}
      aria-label={title}
    >
      <div className={`chips-container${isPending ? ' grouped' : ''}`}>
        {(isPending ? groupedChips : chips.map((value) => ({ value, count: 1 }))).flatMap((entry, groupIndex) => {
          const count = isPending ? entry.count : 1;
          return Array.from({ length: count }, (_, index) => {
            const absoluteIndex = isPending ? index : groupIndex;
            const offsetX = isPending ? groupIndex * 28 : absoluteIndex * 0.4;
            const offsetY = absoluteIndex * 4;
            const value = entry.value;
            const img = getSkinImage(value, skin);
            return (
              <div
                key={`${value}-${groupIndex}-${index}`}
                className="casino-chip-layered"
                style={{
                  '--chip-color': getChipColor(value),
                  '--chip-text-color': getChipTextColor(value),
                  bottom: `${offsetY}px`,
                  left: `${offsetX}px`,
                  zIndex: absoluteIndex + groupIndex,
                  boxShadow: `0 ${2 + absoluteIndex * 0.5}px ${4 + absoluteIndex * 0.5}px rgba(0,0,0,0.4)`
                }}
              >
                {img ? (
                  <img
                    src={img}
                    alt={`${value} KC`}
                    className="chip-skin-img"
                    style={{ opacity: index === count - 1 ? 1 : 0.6 }}
                  />
                ) : (
                  <>
                    <div className="chip-inner-ring" />
                    <span className="chip-val-tiny" style={{ opacity: index === count - 1 ? 1 : 0.6 }}>{value}</span>
                  </>
                )}
              </div>
            );
          });
        })}
      </div>

      {showTooltip && (
        <div className="chip-stack-tooltip">
          {formatKC(amount)}
          {isPending && <span className="pending-tag">{title || 'PENDING (Click to clear)'}</span>}
        </div>
      )}
    </div>
  );
}
