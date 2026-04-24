export const CHIP_VALUES = [1, 5, 10, 50, 100, 500, 1000];
export const TURN_TIMEOUT_SECONDS = 90;

export function formatKC(cents) {
  return `${(cents / 100).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} KC`;
}

export function normalizeRoomSlug(value, maxPlayers) {
  const trimmed = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);

  if (!trimmed) {
    return `blackjack-${maxPlayers}-${Date.now().toString(36).slice(-5)}`;
  }

  return `blackjack-${maxPlayers}-${trimmed}`;
}

export function buildChipBreakdown(amountCents) {
  let remaining = Math.floor((amountCents || 0) / 100);
  return [...CHIP_VALUES]
    .sort((a, b) => b - a)
    .flatMap((chip) => {
      const count = Math.floor(remaining / chip);
      remaining %= chip;
      return Array.from({ length: count }, () => chip);
    });
}

export function buildRealisticStack(amountCents) {
  const values = [100000, 50000, 10000, 5000, 2500, 1000, 500, 100];
  let remaining = amountCents;
  const stack = [];
  for (const value of values) {
    while (remaining >= value && stack.length < 15) {
      stack.push(value / 100);
      remaining -= value;
    }
  }
  return stack.reverse();
}
