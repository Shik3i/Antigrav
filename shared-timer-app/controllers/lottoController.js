const dbLayer = require('../database');
const { 
  getTodayDrawDate, 
  getLottoConfigPayload, 
  LOTTO_CONFIG 
} = require('../config/lotto');

/**
 * GET /api/lotto/config
 */
exports.getConfig = async (req, res) => {
  try {
    const today = getTodayDrawDate();
    const result = await dbLayer.getLottoConfig();
    const configPayload = getLottoConfigPayload();
    
    // Check if user is logged in to get their ticket count
    let userTicketsToday = 0;
    if (req.user && req.user.id) {
      userTicketsToday = await dbLayer.getUserLottoTicketCount(req.user.id, today);
    }

    res.json({
      success: true,
      config: configPayload,
      stats: result.stats || { totalPayout: 0, totalWins: 0, totalPlayed: 0 },
      lastDraw: result.lastDraw,
      userTicketsToday,
      today
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

    const today = getTodayDrawDate();

    // Validate each ticket
    for (const ticket of tickets) {
      if (!Array.isArray(ticket.numbers) || ticket.numbers.length !== 6) {
        return res.status(400).json({ success: false, message: 'Each ticket must have exactly 6 numbers.' });
      }
      
      const uniqueNumbers = [...new Set(ticket.numbers)];
      if (uniqueNumbers.length !== 6) {
        return res.status(400).json({ success: false, message: 'Numbers must be unique.' });
      }

      if (uniqueNumbers.some(n => n < 1 || n > 49)) {
        return res.status(400).json({ success: false, message: 'Numbers must be between 1 and 49.' });
      }

      if (typeof ticket.superzahl !== 'number' || ticket.superzahl < 0 || ticket.superzahl > 9) {
        return res.status(400).json({ success: false, message: 'Superzahl must be between 0 and 9.' });
      }
    }

    const { newBalance } = await dbLayer.purchaseLottoTickets(userId, tickets, today);

    res.json({
      success: true,
      message: `${tickets.length} Ticket(s) erfolgreich eingereicht!`,
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
          drawNumbers: t.drawNumbers ? JSON.parse(t.drawNumbers) : null,
          drawSuperzahl: t.drawSuperzahl,
          drawTotalPayout: t.drawTotalPayout,
          tickets: []
        };
      }
      grouped[t.drawDate].tickets.push({
        id: t.id,
        numbers: JSON.parse(t.numbers),
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
      numbers: JSON.parse(d.numbers)
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
