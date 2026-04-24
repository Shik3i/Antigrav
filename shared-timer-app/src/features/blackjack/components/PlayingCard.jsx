const cardSuitMap = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
  hidden: '🂠'
};

function cardStyle(card) {
  const red = card?.suit === 'hearts' || card?.suit === 'diamonds';
  return {
    width: '58px',
    height: '84px',
    borderRadius: '14px',
    border: card?.visible === false ? '1px solid rgba(245,158,11,0.22)' : '1px solid rgba(255,255,255,0.14)',
    background: card?.visible === false
      ? 'linear-gradient(145deg, rgba(18,24,38,0.98), rgba(34,45,68,0.95))'
      : 'linear-gradient(180deg, rgba(250,250,250,0.98), rgba(235,241,248,0.94))',
    color: card?.visible === false ? '#f8fafc' : (red ? '#dc2626' : '#111827'),
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '8px',
    boxShadow: '0 12px 24px rgba(0,0,0,0.24)',
    fontWeight: 800
  };
}

export default function PlayingCard({ card, index = 0, compact = false }) {
  return (
    <div
      className={`blackjack-card${compact ? ' compact' : ''}${card?.visible === false ? ' hidden-card' : ''}`}
      style={{
        ...cardStyle(card),
        animation: 'blackjackDealIn 460ms cubic-bezier(0.16, 1, 0.3, 1) both',
        animationDelay: `${index * 90}ms`,
        transformOrigin: card?.visible === false ? 'center center' : 'top center'
      }}
    >
      <span style={{ fontSize: '1rem' }}>{card?.visible === false ? '?' : card?.rank}</span>
      <span style={{ alignSelf: 'center', fontSize: '1.35rem' }}>{cardSuitMap[card?.suit] || '♠'}</span>
      <span style={{ alignSelf: 'flex-end', transform: 'rotate(180deg)', fontSize: '1rem' }}>{card?.visible === false ? '?' : card?.rank}</span>
    </div>
  );
}
