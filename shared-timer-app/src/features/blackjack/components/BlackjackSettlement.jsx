import { Trophy } from 'lucide-react';
import { formatKC } from '../utils/formatters';

const RESULT_META = {
  win: { label: 'Win', color: '#22c55e', bg: 'rgba(34,197,94,0.18)' },
  lose: { label: 'Lose', color: '#ef4444', bg: 'rgba(239,68,68,0.18)' },
  push: { label: 'Push', color: '#facc15', bg: 'rgba(250,204,21,0.18)' },
  blackjack: { label: 'Blackjack', color: '#fbbf24', bg: 'rgba(245,158,11,0.18)' },
  bust: { label: 'Bust', color: '#fb7185', bg: 'rgba(244,63,94,0.18)' }
};

export default function BlackjackSettlement({ recentSettlement, settlementRows }) {
  if (!settlementRows?.length) {
    return null;
  }

  return (
    <section className="blackjack-surface blackjack-surface-muted">
      <div className="blackjack-surface-header">
        <div>
          <div className="blackjack-surface-title">
            <Trophy size={18} />
            Letzte Abrechnung
          </div>
          <div className="blackjack-surface-copy">
            Bleibt sichtbar, bis die nächste Runde wirklich gestartet wird.
          </div>
        </div>
        <div className="blackjack-meta-copy">
          Hand #{recentSettlement?.roundId || '-'}
        </div>
      </div>

      <div className="blackjack-grid-list">
        {settlementRows.map((entry, index) => {
          const meta = RESULT_META[entry.result] || RESULT_META.push;
          return (
            <div
              key={`${entry.userId}-${recentSettlement?.roundId || index}`}
              className="blackjack-settlement-card blackjack-settlement-row"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <div>
                <div className="blackjack-entry-name">{entry.username}</div>
                <div className="blackjack-entry-copy">
                  {entry.blackjack ? 'Natural Blackjack' : entry.busted ? 'Bust' : `Hand ${entry.handValue}`}
                </div>
              </div>
              <div className="blackjack-value-cell">{formatKC(entry.bet)}</div>
              <div className="blackjack-value-cell">{entry.handValue}</div>
              <div className="blackjack-value-cell">
                <span className="blackjack-result-pill" style={{ background: meta.bg, color: meta.color }}>
                  {meta.label}
                </span>
              </div>
              <div className={`blackjack-profit-cell${entry.netProfit >= 0 ? ' is-positive' : ' is-negative'}`}>
                {formatKC(entry.netProfit)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
