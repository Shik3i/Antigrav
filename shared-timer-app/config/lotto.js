const crypto = require('crypto');

// ─── Lotto "6 aus 49" + Superzahl ─────────────────────────────
// Exakte Nachbildung des deutschen Lottosystems.
// Ticket-Preis: 1 KC (100 Cent intern).
// Rückzahlungsquote: ~50% (analog zum echten deutschen Lotto).

const LOTTO_CONFIG = {
  gameId: 'lotto',
  displayName: 'Lotto 6 aus 49',
  numbersCount: 6,        // 6 Hauptzahlen
  numberRange: 49,         // Zahlen 1–49
  superzahlRange: 10,      // Superzahl 0–9
  ticketPriceCents: 100,   // 1 KC
  maxDailyTickets: 100,    // maximal 100 pro User pro Tag
  drawHourUTC: 16,          // Ziehung um 16:00 UTC
  cutoffMinutesBeforeDraw: 15 // Ticket-Annahme endet 15 Min vor Ziehung
};

// ─── Gewinnklassen ────────────────────────────────────────────
// Orientiert am echten deutschen Lotto 6 aus 49 mit ~50% Rückzahlungsquote.
//
// Erwartungswert-Berechnung pro 1 KC Ticket (100 Cent):
//   Kl.9: 800/76     = 10.53  Cent
//   Kl.8: 600/63     =  9.52  Cent
//   Kl.7: 3500/538   =  6.51  Cent
//   Kl.6: 10000/1032 =  9.69  Cent
//   Kl.5: 40000/10324=  3.88  Cent
//   Kl.4: 250000/54201= 4.61  Cent
//   Kl.3: 2500000/542008= 4.61 Cent
//   Kl.2: 25000000/15537573= 1.61 Cent
//   Kl.1: 100000000/139838160= 0.72 Cent
//   ─────────────────────────────────────
//   Gesamt-EV: ~51.7 Cent pro 100 Cent → ~51.7% Rückzahlung

const WIN_CLASSES = [
  // { class, matchCount, superzahlRequired, payoutCents, label, probability }
  { class: 9, matchCount: 2, superzahlRequired: true,  payoutCents: 800,        label: '2 Richtige + Superzahl',   probability: '1:76' },
  { class: 8, matchCount: 3, superzahlRequired: false, payoutCents: 600,        label: '3 Richtige',               probability: '1:63' },
  { class: 7, matchCount: 3, superzahlRequired: true,  payoutCents: 3_500,      label: '3 Richtige + Superzahl',   probability: '1:538' },
  { class: 6, matchCount: 4, superzahlRequired: false, payoutCents: 10_000,     label: '4 Richtige',               probability: '1:1.032' },
  { class: 5, matchCount: 4, superzahlRequired: true,  payoutCents: 40_000,     label: '4 Richtige + Superzahl',   probability: '1:10.324' },
  { class: 4, matchCount: 5, superzahlRequired: false, payoutCents: 250_000,    label: '5 Richtige',               probability: '1:54.201' },
  { class: 3, matchCount: 5, superzahlRequired: true,  payoutCents: 2_500_000,  label: '5 Richtige + Superzahl',   probability: '1:542.008' },
  { class: 2, matchCount: 6, superzahlRequired: false, payoutCents: 25_000_000, label: '6 Richtige',               probability: '1:15.537.573' },
  { class: 1, matchCount: 6, superzahlRequired: true,  payoutCents: 100_000_000,label: '6 Richtige + Superzahl',   probability: '1:139.838.160' },
];

/**
 * Determines the win class for a given ticket against drawn numbers.
 * Returns 0 if no win, or 1–9 for the corresponding win class.
 */
function determineWinClass(ticketNumbers, ticketSZ, drawnNumbers, drawnSZ) {
  const matchCount = ticketNumbers.filter(n => drawnNumbers.includes(n)).length;
  const superzahlMatch = ticketSZ === drawnSZ;

  // Manual logic from best to worst to ensure absolute correctness
  if (matchCount === 6 && superzahlMatch) return 1;
  if (matchCount === 6 && !superzahlMatch) return 2;
  if (matchCount === 5 && superzahlMatch) return 3;
  if (matchCount === 5 && !superzahlMatch) return 4;
  if (matchCount === 4 && superzahlMatch) return 5;
  if (matchCount === 4 && !superzahlMatch) return 6;
  if (matchCount === 3 && superzahlMatch) return 7;
  if (matchCount === 3 && !superzahlMatch) return 8;
  if (matchCount === 2 && superzahlMatch) return 9;

  return 0; // No win
}

/**
 * Returns the payout in cents for a given win class.
 */
function getPayoutForClass(winClass) {
  if (winClass <= 0 || winClass > 9) return 0;
  const wc = WIN_CLASSES.find(w => w.class === winClass);
  return wc ? wc.payoutCents : 0;
}

/**
 * Generates drawn numbers using crypto.randomInt for fair randomness.
 * Returns { numbers: [sorted 6 unique from 1-49], superzahl: 0-9 }
 */
function generateDrawNumbers() {
  const numbers = new Set();
  while (numbers.size < LOTTO_CONFIG.numbersCount) {
    numbers.add(crypto.randomInt(1, LOTTO_CONFIG.numberRange + 1));
  }
  const superzahl = crypto.randomInt(0, LOTTO_CONFIG.superzahlRange);
  return {
    numbers: Array.from(numbers).sort((a, b) => a - b),
    superzahl
  };
}

/**
 * Returns the draw date string (YYYY-MM-DD) for the current draw.
 * If it's before 16:00 UTC, today's date is used; if after, today's date is still used
 * (the cron handles the actual execution).
 */
function getTodayDrawDate() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns the draw date string (YYYY-MM-DD) for the next draw.
 */
function getTomorrowDrawDate() {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const year = tomorrow.getUTCFullYear();
  const month = String(tomorrow.getUTCMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns the config payload for the frontend.
 */
function getLottoConfigPayload() {
  return {
    ...LOTTO_CONFIG,
    winClasses: WIN_CLASSES.map(wc => ({
      class: wc.class,
      matchCount: wc.matchCount,
      superzahlRequired: wc.superzahlRequired,
      payoutCents: wc.payoutCents,
      label: wc.label,
      probability: wc.probability
    }))
  };
}

/**
 * Implementation of server-authoritative draw timing.
 * Returns { drawTime, cutoffTime } as UTC timestamps (ms).
 */
function getNextDrawTimestamps() {
  const now = new Date();
  
  // Set to today 16:00 UTC
  const drawTime = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    LOTTO_CONFIG.drawHourUTC, 0, 0, 0
  ));

  const cutoffTime = new Date(drawTime.getTime() - (LOTTO_CONFIG.cutoffMinutesBeforeDraw || 15) * 60 * 1000);

  // If we are past today's draw, move to tomorrow
  if (now.getTime() >= drawTime.getTime()) {
    drawTime.setUTCDate(drawTime.getUTCDate() + 1);
    cutoffTime.setUTCDate(cutoffTime.getUTCDate() + 1);
  }

  return {
    drawTime: drawTime.getTime(),
    cutoffTime: cutoffTime.getTime()
  };
}

module.exports = {
  LOTTO_CONFIG,
  WIN_CLASSES,
  determineWinClass,
  getPayoutForClass,
  generateDrawNumbers,
  getTodayDrawDate,
  getTomorrowDrawDate,
  getNextDrawTimestamps,
  getLottoConfigPayload
};
