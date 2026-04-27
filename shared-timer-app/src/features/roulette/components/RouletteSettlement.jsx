import React from 'react';
import CasinoSettlementToast from '../../casino/components/SettlementToast';

export default function RouletteSettlement({ settlement, userId, spinResult }) {
  const myResult = settlement?.find(s => String(s.playerId) === String(userId));
  if (!myResult) return null;

  const badge = spinResult && (
    <span className={`settlement-number-badge settlement-number-badge--${spinResult.color}`}>
      {spinResult.number}
    </span>
  );

  return (
    <CasinoSettlementToast
      netChangeCents={myResult.displayChange * 100}
      badge={badge}
      autoHideMs={4000}
      className="settlement-toast"
    />
  );
}
