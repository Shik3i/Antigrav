import React from 'react';
import { CHIP_VALUES, getChipColor, getChipImage } from '../../casino/chipConfig';
import { useChipSkin } from '../../casino/ChipSkinContext';

export default function RouletteChipSelector({ selected, onSelect, disabled, eraseMode, onToggleErase }) {
  const { skin } = useChipSkin();
  return (
    <div className="chip-selector">
      {CHIP_VALUES.map(val => {
        const img = getChipImage(val, skin);
        return (
          <button
            key={val}
            className={`chip chip--${val === selected && !eraseMode ? 'selected' : 'idle'}${img ? ' chip--image' : ''}`}
            style={img ? undefined : { '--chip-color': getChipColor(val) }}
            onClick={() => { onToggleErase && eraseMode && onToggleErase(false); onSelect(val); }}
            disabled={disabled}
          >
            {img
              ? <img src={img} alt={`${val} KC`} className="chip-skin-img" />
              : <span className="chip-value">{val}</span>
            }
          </button>
        );
      })}
      <button
        className={`chip chip--erase${eraseMode ? ' chip--erase-active' : ''}`}
        onClick={() => onToggleErase && onToggleErase(!eraseMode)}
        disabled={disabled}
        title="Löschen-Modus (auch Rechtsklick auf Feld)"
      >
        <span className="chip-value">✕</span>
      </button>
    </div>
  );
}
