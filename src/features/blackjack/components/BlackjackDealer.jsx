import BlackjackCelebration from './BlackjackCelebration';
import PlayingCard from './PlayingCard';

function getDealerStatusText(roomState) {
  if (roomState?.status === 'betting' || roomState?.status === 'waiting') return 'Waiting for bets';
  if (roomState?.status === 'dealing') return 'Dealing';
  if (roomState?.status === 'dealer_turn') {
    if (roomState?.dealerPhase === 'reveal') return 'Reveal';
    if (roomState?.dealerPhase === 'draw') return 'Draw';
    if (roomState?.dealerPhase === 'stand') return 'Stand';
    if (roomState?.dealerPhase === 'bust') return 'Bust';
    return 'Waiting for bets';
  }
  if (roomState?.status === 'settlement') return 'Settling bets';

  return 'Waiting for bets';
}

export default function BlackjackDealer({ roomState }) {
  const isBlackjack = roomState?.dealerHandValue === 21 && roomState?.dealerHand?.length === 2;

  return (
    <div className="blackjack-dealer-zone">
      <BlackjackCelebration active={isBlackjack} />
      <div className="blackjack-dealer-header" style={{ marginBottom: (roomState?.dealerHand?.length || 0) > 0 ? '10px' : '0' }}>
        <div className="blackjack-dealer-status">
          {getDealerStatusText(roomState)}
        </div>
        {(roomState?.dealerHand?.length || 0) > 0 && (
          <div className="blackjack-value-badge" style={{ padding: '2px 8px' }}>Value {roomState?.dealerHandValue ?? 0}</div>
        )}
      </div>

      <div className="blackjack-dealer-cards" data-bj-anchor="dealer-hand">
        {(roomState?.dealerHand || []).map((card, index) => (
          <PlayingCard
            key={`${card.code}-${index}`}
            card={card}
            index={index}
            motionAnchorId={`dealer-hand-card-${index}`}
          />
        ))}
      </div>
    </div>
  );
}
