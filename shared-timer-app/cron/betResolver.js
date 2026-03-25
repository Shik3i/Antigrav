const dbLayer = require('../database');
const axios = require('axios');

const resolveBets = async () => {
    console.log('[betResolver] Starting bet resolution cycle...');
    const startTime = new Date();
    let stats = { processedMatches: 0, resolvedBets: 0, fails: 0, unresolvedCount: 0 };

    try {
        const unresolvedBets = await dbLayer.getUnresolvedPastBets();
        stats.unresolvedCount = unresolvedBets ? unresolvedBets.length : 0;

        if (!unresolvedBets || unresolvedBets.length === 0) {
            console.log('[betResolver] No unresolved past bets found.');
            return stats;
        }

        // LOG 1: Initial find
        await dbLayer.logError(`Bet Resolver: Found ${unresolvedBets.length} unresolved bets older than 1 hour.`, 'INFO_LOG', `Total bets: ${unresolvedBets.length}`);

        console.log(`[betResolver] Found ${unresolvedBets.length} unresolved past bets. Fetching data for ${new Set(unresolvedBets.map(b => b.matchName)).size} unique matches...`);

        // Group bets by slug
        const groupedBets = {};
        for (const bet of unresolvedBets) {
            if (!bet.polymarketUrl) continue;
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
            if (wordsA.some(w => wordsB.includes(w))) return true;
            const normA = (teamA || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const normB = (teamB || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return normA.includes(normB) || normB.includes(normA);
        };

        for (const slug of Object.keys(groupedBets)) {
            const betsInGroup = groupedBets[slug];
            const matchName = betsInGroup[0]?.matchName || 'Unknown Match';
            
            // LOG 2: Processing group
            console.log(`[betResolver] Processing group for slug: ${slug} with ${betsInGroup.length} bets.`);
            await dbLayer.logError(`Bet Resolver: Processing slug "${slug}" for match "${matchName}"`, 'INFO_LOG', `Bets in group: ${betsInGroup.length}`);

            try {
                const response = await axios.get(`https://gamma-api.polymarket.com/events`, {
                    params: { slug },
                    timeout: 10000
                });

                if (!response.data || response.data.length === 0) {
                    // LOG 3: No data
                    console.log(`[betResolver] Polymarket API returned no event for slug: ${slug}`);
                    await dbLayer.logError(`Bet Resolver: Polymarket API returned no event for slug: ${slug}`, 'INFO_LOG', matchName);
                    continue;
                }

                const event = response.data[0];
                const winnerMarket = (event.markets || []).find(m => m.sportsMarketType === 'moneyline' || m.groupItemTitle === 'Match Winner') 
                                  || (event.markets || [])[0];
                
                if (!winnerMarket) {
                    console.log(`[betResolver] No suitable winner market found for slug: ${slug}`);
                    continue;
                }

                const outcomes = JSON.parse(winnerMarket.outcomes || '[]');
                const prices = JSON.parse(winnerMarket.outcomePrices || '[]');
                const hasDecisivePrice = prices.some(p => parseFloat(p) === 1);
                const winningIndex = prices.findIndex(p => parseFloat(p) === 1);
                const winningOutcome = winningIndex !== -1 ? outcomes[winningIndex] : null;

                // Skip only if the event is still active AND no decisive price exists
                if (!event.closed && event.active && !hasDecisivePrice) {
                    console.log(`[betResolver] Match "${matchName}" is still active/trading. Skipping.`);
                    continue;
                }
                
                // Process all bets for this match
                for (const bet of betsInGroup) {
                    try {
                        const winStatus = winningOutcome ? (
                            bet.polymarketTeam 
                                ? (winningOutcome.toLowerCase() === bet.polymarketTeam.toLowerCase() ? 'won' : 'lost')
                                : (isMatch(winningOutcome, bet.chosenTeam) ? 'won' : 'lost')
                        ) : (event.closed ? 'canceled' : null);

                        if (!winStatus) continue;

                        const payoutAmount = winStatus === 'won' ? Math.floor(bet.stake * bet.odds) : (winStatus === 'canceled' ? bet.stake : 0);
                        const reason = winStatus === 'won' ? `Bet Won on ${bet.chosenTeam}` : (winStatus === 'canceled' ? `Bet Canceled (Refund) on ${bet.chosenTeam}` : null);

                        const result = await dbLayer.resolveBetAtomic(bet.id, winStatus, payoutAmount, reason);
                        
                        if (result.success) {
                            console.log(`[betResolver] Bet ${bet.id} resolved as ${winStatus.toUpperCase()}.`);
                            stats.resolvedBets++;
                        } else {
                            console.log(`[betResolver] Bet ${bet.id} skip: ${result.reason}`);
                        }
                    } catch (betErr) {
                        console.error(`[betResolver] Critical error processing individual bet ${bet.id}:`, betErr.message);
                        stats.fails++;
                    }
                }
                stats.processedMatches++;
            } catch (matchErr) {
                console.error(`[betResolver] FAILED to process match "${matchName}" (Slug: ${slug}). Error:`, matchErr.message);
                dbLayer.logError('Bet Resolver Match Error: ' + matchName, matchErr.stack, slug);
                stats.fails++;
            }
        }
        console.log(`[betResolver] Cycle finished. Processed: ${stats.processedMatches} matches, Resolved: ${stats.resolvedBets} bets, Fails: ${stats.fails}.`);
        return stats;
    } catch (err) {
        console.error('[betResolver] CRITICAL GLOBAL ERROR:', err.message);
        dbLayer.logError('Bet Resolver Global Error', err.stack);
        return { ...stats, success: false, error: err.message };
    }
};

const startCron = () => {
    // Run once after 5s, then every 30 minutes
    setTimeout(resolveBets, 5000);
    setInterval(resolveBets, 30 * 60 * 1000);
    console.log('[betResolver] Cron job initialized (runs every 30 minutes).');
};

module.exports = { startCron, resolveBets };
