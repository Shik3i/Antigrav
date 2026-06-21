export function formatKC(cents) {
  return `${(cents / 100).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} KC`;
}
