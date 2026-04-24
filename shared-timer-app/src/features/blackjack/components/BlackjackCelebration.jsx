export default function BlackjackCelebration({ active }) {
  if (!active) return null;

  return (
    <div className="blackjack-celebration-overlay">
      <div className="confetti-container">
        {Array.from({ length: 16 }).map((_, index) => (
          <div
            key={index}
            className="confetti-particle"
            style={{
              '--angle': `${index * 22.5}deg`,
              '--delay': `${index * 20}ms`,
              '--color': ['#fbbf24', '#f59e0b', '#fcd34d', '#fff'][index % 4]
            }}
          />
        ))}
      </div>
      <div className="blackjack-pop-text">BLACKJACK!</div>
    </div>
  );
}
