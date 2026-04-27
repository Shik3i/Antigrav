import { useEffect, useState } from 'react';
import { formatKC } from '../formatters';

/**
 * Generic casino settlement result overlay.
 *
 * Props:
 *   netChangeCents  number     Net win/loss in cents. Positive=win, negative=loss.
 *   isPush          boolean    Show "PUSH" when netChangeCents is 0.
 *   badge           ReactNode  Optional extra content (e.g. spin number badge).
 *   autoHideMs      number     If set, auto-hides after this many ms on each change.
 *   className       string     Extra CSS class on root element.
 */
export default function SettlementToast({ netChangeCents, isPush = false, badge, autoHideMs, className = '' }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!autoHideMs || netChangeCents === undefined) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), autoHideMs);
    return () => clearTimeout(t);
  }, [netChangeCents, autoHideMs]);

  if (!visible) return null;

  let label = '';
  let color = '#fbbf24';

  if (netChangeCents > 0) {
    label = `+${formatKC(netChangeCents)}`;
    color = '#4ade80';
  } else if (netChangeCents < 0) {
    label = formatKC(netChangeCents);
    color = '#f87171';
  } else if (isPush) {
    label = 'PUSH';
    color = '#fbbf24';
  } else {
    return null;
  }

  return (
    <div className={`casino-settlement-toast ${className}`.trim()}>
      {badge && <div className="casino-settlement-toast__badge">{badge}</div>}
      <div className="casino-settlement-toast__glow" style={{ '--toast-color': color }} />
      <div className="casino-settlement-toast__text" style={{ color }}>{label}</div>
    </div>
  );
}
