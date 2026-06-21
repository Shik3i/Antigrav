import CasinoSettlementToast from '../../casino/components/SettlementToast';

export default function SettlementToast({ settlements }) {
  if (!settlements || settlements.length === 0) return null;

  const totalNet = settlements.reduce((sum, s) => sum + (Number(s.netProfit) || 0), 0);
  const isPush = settlements.every((s) => s.result === 'push');

  return (
    <CasinoSettlementToast
      netChangeCents={totalNet}
      isPush={isPush}
      className="blackjack-settlement-toast"
    />
  );
}
