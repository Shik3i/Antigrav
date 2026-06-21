/**
 * Generic confetti celebration overlay.
 *
 * Props:
 *   active    boolean  Show when true.
 *   message   string   Text to display (e.g. "BLACKJACK!").
 *   colors    string[] Confetti color palette.
 *   count     number   Particle count. Default 16.
 */
export default function CelebrationOverlay({
  active,
  message,
  colors = ['#fbbf24', '#f59e0b', '#fcd34d', '#fff'],
  count = 16,
}) {
  if (!active) return null;

  return (
    <div className="casino-celebration-overlay">
      <div className="casino-confetti-container">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="casino-confetti-particle"
            style={{
              '--angle': `${i * (360 / count)}deg`,
              '--delay': `${i * 20}ms`,
              '--color': colors[i % colors.length],
            }}
          />
        ))}
      </div>
      {message && <div className="casino-celebration-text">{message}</div>}
    </div>
  );
}
