import BlackjackCelebration from './BlackjackCelebration';
import PlayingCard from './PlayingCard';

function getDealerStatusText(roomState) {
  if (roomState?.status === 'betting' || roomState?.status === 'waiting') return 'Waiting for bets';
  if (roomState?.status === 'dealing') return 'Dealing';
  if (roomState?.status === 'dealer_turn') {
    if (roomState?.dealerPhase === 'reveal') return 'Dealer reveals hole card';
    if (roomState?.dealerPhase === 'draw') return 'Dealer draws';
    if (roomState?.dealerPhase === 'stand') return 'Dealer stands';
    if (roomState?.dealerPhase === 'bust') return 'Dealer busts';
    return 'Dealer turn';
  }
  if (roomState?.status === 'settlement') {
    if ((roomState?.dealerHandValue || 0) > 21) return 'Dealer busts';
    return 'Dealer stands';
  }

  return 'Waiting for bets';
}

export default function BlackjackDealer({ roomState }) {
  const isBlackjack = roomState?.dealerHandValue === 21 && roomState?.dealerHand?.length === 2;

  return (
    <div className="blackjack-dealer-zone">
      <BlackjackCelebration active={isBlackjack} />
      <div className="blackjack-dealer-header" style={{ marginBottom: (roomState?.dealerHand?.length || 0) > 0 ? '10px' : '0' }}>
        <div className="blackjack-dealer-status" style={{ fontWeight: 800, color: '#facc15', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem' }}>
          {getDealerStatusText(roomState)}
        </div>
        {(roomState?.dealerHand?.length || 0) > 0 && (
          <div className="blackjack-value-badge" style={{ padding: '2px 8px' }}>Value {roomState?.dealerHandValue ?? 0}</div>
        )}
      </div>

      <div className="blackjack-dealer-cards">
        {(roomState?.dealerHand || []).map((card, index) => (
          <PlayingCard key={`${card.code}-${index}`} card={card} index={index} />
        ))}
      </div>
    </div>
  );
}
