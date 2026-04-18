const dbLayer = require('../database');
const { 
  generateDrawNumbers, 
  getTodayDrawDate, 
  LOTTO_CONFIG 
} = require('../config/lotto');

let ioInstance = null;

/**
 * Initializes and starts the lotto draw cron job.
 * Executes daily at 16:00 UTC.
 */
function startLottoCron(io) {
  ioInstance = io;
  console.log(`[LottoCron] Initialized. Target: ${LOTTO_CONFIG.drawHourUTC}:00 UTC daily.`);
  
  // Check every minute
  setInterval(checkAndExecuteDraw, 60000);
  
  // Also run once on startup to check if we missed today's draw
  checkAndExecuteDraw();
}

/**
 * Checks if a draw is due and executes it if necessary.
 */
async function checkAndExecuteDraw() {
  try {
    const now = new Date();
    const currentHourUTC = now.getUTCHours();
    const today = getTodayDrawDate();

    // Only proceed if it's after the draw hour
    if (currentHourUTC < LOTTO_CONFIG.drawHourUTC) return;

    // Check if draw for today already exists
    const draws = await dbLayer.getLottoDrawHistory(1);
    if (draws && draws.length > 0 && draws[0].drawDate === today) {
      // Already drawn today
      return;
    }

    console.log(`[LottoCron] Executing draw for ${today}...`);
    
    // 1. Generate Numbers
    const { numbers, superzahl } = generateDrawNumbers();
    
    // 2. Execute in DB
    const result = await dbLayer.executeLottoDraw(today, numbers, superzahl);
    
    console.log(`[LottoCron] Draw completed: ${numbers.join(', ')} | SZ: ${superzahl}. Total Winners: ${result.totalWinners}, Payout: ${result.totalPayout}`);

    // 3. Broadcast to all clients
    if (ioInstance) {
      ioInstance.emit('lotto_draw_result', {
        drawDate: today,
        numbers,
        superzahl,
        totalWinners: result.totalWinners,
        totalPayout: result.totalPayout,
        stats: (await dbLayer.getLottoConfig()).stats
      });
    }

    await dbLayer.logSystemEvent('info', 'LottoDraw', `Ziehung für ${today} erfolgreich: ${numbers.join(',')} SZ:${superzahl}. Gewinner: ${result.totalWinners}`);

  } catch (error) {
    console.error('[LottoCron] Error during draw execution:', error);
    await dbLayer.logSystemEvent('error', 'LottoDraw', `Fehler bei Ziehung: ${error.message}`);
  }
}

module.exports = {
  startLottoCron
};
