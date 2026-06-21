const dbLayer = require('../database');

const emitBalanceUpdate = (req, userId, balance) => {
  const io = req.app?.get('socketio') || req.app?.get('io');
  if (io && userId && Number.isFinite(balance)) {
    io.to(userId).emit('COIN_BALANCE_UPDATE', { balance });
  }
};

const { 
  getTodayDrawDate, 
  getTomorrowDrawDate,
  getLottoConfigPayload, 
  getNextDrawTimestamps,
  getDrawDateString,
  LOTTO_CONFIG 
} = require('../config/lotto');

/**
 * Helper to safely parse numbers from DB JSON
 */
const safeParse = (str, fallback = []) => {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch (e) {
    console.error('[LottoController] Parse Error:', e, str);
    return fallback;
  }
};

/**
 * GET /api/lotto/config
 */
exports.getConfig = async (req, res) => {
  try {
    // Determine Draw Dates based on the NEXT available draw
    const { drawTime, cutoffTime } = getNextDrawTimestamps();
    const nextDrawDate = getDrawDateString(drawTime);
    const followingDrawDate = getDrawDateString(drawTime + 24 * 60 * 60 * 1000);
    
    // Fetch Global Config and Stats
    const result = await dbLayer.getLottoConfig();
    const configPayload = getLottoConfigPayload();

    // Check if user is logged in to get their ticket count
    let userTicketsToday = 0;
    let userTicketsTomorrow = 0;
    if (req.user && req.user.id) {
      userTicketsToday = await dbLayer.getUserLottoTicketCountForDraw(req.user.id, nextDrawDate);
      userTicketsTomorrow = await dbLayer.getUserLottoTicketCountForDraw(req.user.id, followingDrawDate);
    }

    res.json({
      success: true,
      config: configPayload,
      stats: result.stats || { totalPayout: 0, totalWins: 0, totalPlayed: 0 },
      lastDraw: result.lastDraw,
      userTicketsToday,
      userTicketsTomorrow,
      today: nextDrawDate,
      tomorrow: followingDrawDate,
      serverTime: Date.now(),
      nextDrawTime: drawTime,
      nextCutoffTime: cutoffTime
    });
  } catch (error) {
    console.error('Lotto getConfig error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching lotto config.' });
  }
};

/**
 * POST /api/lotto/buy
 */
exports.buyTicket = async (req, res) => {
  try {
    const userId = req.user.id;
    const { tickets } = req.body; // Array of { numbers: [6], superzahl: 0-9 }

    if (!Array.isArray(tickets) || tickets.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid tickets format.' });
    }

    if (tickets.length > LOTTO_CONFIG.maxDailyTickets) {
      return res.status(400).json({ success: false, message: `Max ${LOTTO_CONFIG.maxDailyTickets} tickets per purchase.` });
    }

    // Rollover Logic: Server-authoritative timing.
    const now = new Date();
    const nowTs = now.getTime();
    const { drawTime, cutoffTime } = getNextDrawTimestamps();
    
    // Hard Lockout: During the 15min draw window, no tickets can be sold.
    if (nowTs >= cutoffTime && nowTs < drawTime) {
      return res.status(403).json({ 
        success: false, 
        message: 'Annahmeschluss erreicht. Während der Ziehung (15:45 - 16:00 UTC) ist der Ticket-Kauf gesperrt. Bitte versuche es nach 16:00 UTC erneut.' 
      });
    }

    // The drawDate is ALWAYS the date component of the target drawTime.
    const drawDate = getDrawDateString(drawTime);

    // Validate each ticket
    for (const ticket of tickets) {
      if (!Array.isArray(ticket.numbers) || ticket.numbers.length !== 6) {
        return res.status(400).json({ success: false, message: 'Each ticket must have exactly 6 numbers.' });
      }
      
      const uniqueNumbers = [...new Set(ticket.numbers)];
      if (uniqueNumbers.length !== 6) {
        return res.status(400).json({ success: false, message: 'Numbers must be unique.' });
      }

      // Check Integer and Range
      if (uniqueNumbers.some(n => !Number.isInteger(n) || n < 1 || n > 49)) {
        return res.status(400).json({ success: false, message: 'Numbers must be integers between 1 and 49.' });
      }

      // Check Superzahl Integer and Range
      if (!Number.isInteger(ticket.superzahl) || ticket.superzahl < 0 || ticket.superzahl > 9) {
        return res.status(400).json({ success: false, message: 'Superzahl must be an integer between 0 and 9.' });
      }
    }

    // Server-side validation of the 100-ticket-per-draw limit
    const existingCount = await dbLayer.getUserLottoTicketCountForDraw(userId, drawDate);
    if (existingCount + tickets.length > LOTTO_CONFIG.maxDailyTickets) {
      return res.status(400).json({ 
        success: false, 
        message: `Limit von ${LOTTO_CONFIG.maxDailyTickets} Tickets pro Ziehung erreicht. Du hast bereits ${existingCount} Tickets für den ${drawDate}.` 
      });
    }

    const { newBalance } = await dbLayer.purchaseLottoTickets(userId, tickets, drawDate);
    emitBalanceUpdate(req, userId, newBalance);

    res.json({
      success: true,
      message: `${tickets.length} Ticket(s) erfolgreich für den ${drawDate} eingereicht!`,
      newBalance
    });
  } catch (error) {
    console.error('Lotto buyTicket error:', error);
    res.status(400).json({ success: false, message: error.message || 'Error purchasing tickets.' });
  }
};

/**
 * GET /api/lotto/history
 */
exports.getHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const tickets = await dbLayer.getUserLottoHistory(userId);
    
    // Group tickets by drawDate
    const grouped = {};
    tickets.forEach(t => {
      if (!grouped[t.drawDate]) {
        grouped[t.drawDate] = {
          drawDate: t.drawDate,
          drawNumbers: safeParse(t.drawNumbers, null),
          drawSuperzahl: t.drawSuperzahl,
          drawTotalPayout: t.drawTotalPayout,
          tickets: []
        };
      }
      grouped[t.drawDate].tickets.push({
        id: t.id,
        numbers: safeParse(t.numbers),
        superzahl: t.superzahl,
        matchCount: t.matchCount,
        superzahlMatch: !!t.superzahlMatch,
        winClass: t.winClass,
        winAmount: t.winAmount,
        status: t.status,
        createdAt: t.createdAt
      });
    });

    const drawGroups = Object.values(grouped).sort((a, b) => b.drawDate.localeCompare(a.drawDate));

    res.json({
      success: true,
      draws: drawGroups
    });
  } catch (error) {
    console.error('Lotto getHistory error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching lotto history.' });
  }
};

/**
 * GET /api/lotto/draws
 */
exports.getDrawHistory = async (req, res) => {
  try {
    const draws = await dbLayer.getLottoDrawHistory();
    const parsedDraws = draws.map(d => ({
      ...d,
      numbers: safeParse(d.numbers)
    }));
    res.json({
      success: true,
      draws: parsedDraws
    });
  } catch (error) {
    console.error('Lotto getDrawHistory error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching draw history.' });
  }
};
