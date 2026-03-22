const dbLayer = require('../database');
const axios = require('axios');

const resolveBets = async () => {
    try {
        const unresolvedBets = await dbLayer.getUnresolvedPastBets();
        if (!unresolvedBets || unresolvedBets.length === 0) return;

        console.log(`[betResolver] Found ${unresolvedBets.length} unresolved past bets. Checking Polymarket...`);

        // Group bets by slug
        const groupedBets = {};
        for (const bet of unresolvedBets) {
            const urlParts = bet.polymarketUrl.split('/event/');
            if (urlParts.length < 2) continue;
            const slug = urlParts[1].split('?')[0].replace(/\/$/, '');
            if (!groupedBets[slug]) groupedBets[slug] = [];
            groupedBets[slug].push(bet);
        }

        // Smart string matching helper
        const isMatch = (teamA, teamB) => {
            const ignoreWords = ['team', 'esports', 'gaming', 'club', 'los', 'the', 'academy', 'fc', 'e-sports'];
            const getWords = s => (s || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !ignoreWords.includes(w));
            const wordsA = getWords(teamA);
            const wordsB = getWords(teamB);
            
            // If there's an intersection in meaningful words, it's a match
            if (wordsA.some(w => wordsB.includes(w))) return true;

            // Fallback for very short names (like "G2", "T1")
            const normA = (teamA || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const normB = (teamB || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return normA.includes(normB) || normB.includes(normA);
        };

        for (const slug of Object.keys(groupedBets)) {
            const betsInGroup = groupedBets[slug];
            try {
                const response = await axios.get(`https://gamma-api.polymarket.com/events`, {
                    params: { slug }
                });

                if (!response.data || response.data.length === 0) continue;
                const event = response.data[0];

                const winnerMarket = (event.markets || []).find(m => m.sportsMarketType === 'moneyline' || m.groupItemTitle === 'Match Winner') 
                                  || (event.markets || [])[0];
                
                if (!winnerMarket) continue;

                const outcomes = JSON.parse(winnerMarket.outcomes || '[]');
                const prices = JSON.parse(winnerMarket.outcomePrices || '[]');

                // Check if match is de-facto decided (a price hit 1.0 = 100%)
                const hasDecisivePrice = prices.some(p => parseFloat(p) === 1);

                // Skip only if the event is still active AND no decisive price exists
                if (!event.closed && event.active && !hasDecisivePrice) {
                    continue;
                }
                
                let winningOutcome = null;
                for (let i = 0; i < prices.length; i++) {
                    if (parseFloat(prices[i]) === 1) {
                        winningOutcome = outcomes[i];
                        break;
                    }
                }

                // Process all bets for this match
                for (const bet of betsInGroup) {
                    if (!winningOutcome && event.closed) {
                       await dbLayer.updateBetStatus(bet.id, 'canceled');
                       await dbLayer.addKoalaCoins(bet.userId, bet.stake, `Bet Canceled (Refund) on ${bet.chosenTeam}`);
                       console.log(`[betResolver] Bet ${bet.id} canceled/refunded.`);
                       continue;
                    }

                    if (!winningOutcome) continue;

                    const isWin = bet.polymarketTeam 
                        ? (winningOutcome.toLowerCase() === bet.polymarketTeam.toLowerCase())
                        : isMatch(winningOutcome, bet.chosenTeam);

                    if (isWin) {
                        await dbLayer.updateBetStatus(bet.id, 'won');
                        const payout = Math.floor(bet.stake * bet.odds);
                        await dbLayer.addKoalaCoins(bet.userId, payout, `Bet Won on ${bet.chosenTeam}`);
                        console.log(`[betResolver] Bet ${bet.id} won. Payout: ${payout}`);
                    } else {
                        await dbLayer.updateBetStatus(bet.id, 'lost');
                        console.log(`[betResolver] Bet ${bet.id} lost.`);
                    }
                }
            } catch (err) {
                console.error(`[betResolver] Error resolving slug ${slug}:`, err.message);
            }
        }
    } catch (err) {
        console.error('[betResolver] Global error:', err.message);
    }
};

const startCron = () => {
    // Run once after 5s, then every hour
    setTimeout(resolveBets, 5000);
    setInterval(resolveBets, 60 * 60 * 1000);
    console.log('[betResolver] Cron job initialized (runs every hour).');
};

module.exports = { startCron, resolveBets };
