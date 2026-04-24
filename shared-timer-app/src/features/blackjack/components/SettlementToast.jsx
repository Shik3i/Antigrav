import { formatKC } from '../utils/formatters';

export default function SettlementToast({ settlements }) {
  if (!settlements || settlements.length === 0) return null;

  const totalNet = settlements.reduce((sum, settlement) => sum + (Number(settlement.netProfit) || 0), 0);
  const isPush = settlements.every((settlement) => settlement.result === 'push');

  let label = '';
  let color = '#fbbf24';
  if (totalNet > 0) {
    label = `+${formatKC(totalNet)}`;
    color = '#4ade80';
  } else if (totalNet < 0) {
    label = formatKC(totalNet);
    color = '#f87171';
  } else if (isPush) {
    label = 'PUSH';
    color = '#fbbf24';
  } else {
    return null;
  }

  return (
    <div className="blackjack-settlement-toast">
      <div className="toast-glow" style={{ '--toast-color': color }} />
      <div className="toast-text" style={{ color }}>{label}</div>
    </div>
  );
}
