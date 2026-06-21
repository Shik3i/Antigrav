const dbLayer = require('../database');
const axios = require('axios');

const resolveBets = async () => {
    console.log('[betResolver] Starting bet resolution cycle...');
    await dbLayer.logSystemEvent('info', 'betResolver', 'Starting bet resolution cycle...');
    const startTime = new Date();
    let stats = { processedMatches: 0, resolvedBets: 0, fails: 0, unresolvedCount: 0 };

    try {
        const unresolvedBets = await dbLayer.getUnresolvedPastBets();
        stats.unresolvedCount = unresolvedBets ? unresolvedBets.length : 0;

        if (!unresolvedBets || unresolvedBets.length === 0) {
            console.log('[betResolver] No unresolved past bets found.');
            await dbLayer.logSystemEvent('info', 'betResolver', 'No unresolved past bets found.');
            return stats;
        }

        // LOG 1: Initial find
        await dbLayer.logSystemEvent('info', 'betResolver', `Found ${unresolvedBets.length} unresolved bets older than 1 hour.`);

        console.log(`[betResolver] Found ${unresolvedBets.length} unresolved past bets. Fetching data for ${new Set(unresolvedBets.map(b => b.matchName)).size} unique matches...`);
        await dbLayer.logSystemEvent('info', 'betResolver', `Found ${unresolvedBets.length} unresolved past bets. Fetching data for ${new Set(unresolvedBets.map(b => b.matchName)).size} unique matches...`);

        // Group bets by slug
        const groupedBets = {};
        for (const bet of unresolvedBets) {
            if (!bet.polymarketUrl) {
                console.log(`[betResolver] Skipping bet ${bet.id}: Missing polymarketUrl.`);
                await dbLayer.logSystemEvent('warn', 'betResolver', `Skipping bet ${bet.id}: Missing Polymarket URL for match "${bet.matchName}".`);
                continue;
            }
            const urlParts = bet.polymarketUrl.split('/event/');
            if (urlParts.length < 2) {
                console.log(`[betResolver] Skipping bet ${bet.id}: Invalid polymarketUrl format ("${bet.polymarketUrl}").`);
                await dbLayer.logSystemEvent('warn', 'betResolver', `Skipping bet ${bet.id}: Invalid Polymarket URL format for match "${bet.matchName}".`);
                continue;
            }
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
            await dbLayer.logSystemEvent('info', 'betResolver', `Processing slug "${slug}" for match "${matchName}" (${betsInGroup.length} bets).`);

            try {
                const response = await axios.get(`https://gamma-api.polymarket.com/events`, {
                    params: { slug },
                    timeout: 10000
                });

                if (!response.data || response.data.length === 0) {
                    // LOG 3: No data
                    console.log(`[betResolver] Polymarket API returned no event for slug: ${slug}`);
                    await dbLayer.logSystemEvent('warn', 'betResolver', `API returned no event for slug "${slug}" (Match: ${matchName}).`);
                    continue;
                }

                const event = response.data[0];
                const winnerMarket = (event.markets || []).find(m => m.sportsMarketType === 'moneyline' || m.groupItemTitle === 'Match Winner') 
                                  || (event.markets || [])[0];
                
                if (!winnerMarket) {
                    console.log(`[betResolver] Skipping slug "${slug}": No suitable winner market found in event data.`);
                    await dbLayer.logSystemEvent('warn', 'betResolver', `No winner market found for slug "${slug}" (Match: ${matchName}).`);
                    continue;
                }

                const outcomes = JSON.parse(winnerMarket.outcomes || '[]');
                const prices = JSON.parse(winnerMarket.outcomePrices || '[]');
                const hasDecisivePrice = prices.some(p => parseFloat(p) === 1);
                const winningIndex = prices.findIndex(p => parseFloat(p) === 1);
                const winningOutcome = winningIndex !== -1 ? outcomes[winningIndex] : null;

                // RESOLUTION CONDITION: Trigger if closed, or not active, or a price is 1.00 (100%)
                const isFinished = !!event.closed || !event.active || hasDecisivePrice;

                if (!isFinished) {
                    console.log(`[betResolver] Skipping slug "${slug}": Match is still active/trading (closed=${event.closed}, active=${event.active}, hasDecisive=${hasDecisivePrice}).`);
                    continue;
                }

                if (event.closed && !winningOutcome) {
                    const msg = `Market closed for slug "${slug}", but no winner confirmed by oracle. Skipping to wait for resolution...`;
                    console.log(`[betResolver] ${msg}`);
                    await dbLayer.logSystemEvent('info', 'betResolver', msg);
                    continue;
                }
                
                console.log(`[betResolver] Slug "${slug}" is considered finished. Winner: ${winningOutcome || 'None (Canceled?)'}. Proceeding to resolve ${betsInGroup.length} bets.`);
                await dbLayer.logSystemEvent('info', 'betResolver', `Slug "${slug}" is considered finished. Winner: ${winningOutcome || 'None'}. Resolving ${betsInGroup.length} bets.`);
                
                // Process all bets for this match
                for (const bet of betsInGroup) {
                    try {
                        let winStatus = null;
                        
                        if (winningOutcome) {
                            const apiWinnerNorm = winningOutcome.toLowerCase().trim();
                            const dbPolyTeamNorm = (bet.polymarketTeam || '').toLowerCase().trim();
                            const dbChosenTeamNorm = (bet.chosenTeam || '').toLowerCase().trim();

                            if (bet.polymarketTeam) {
                                if (apiWinnerNorm === dbPolyTeamNorm) {
                                    winStatus = 'won';
                                } else {
                                    winStatus = 'lost';
                                    const msg = `Bet ${bet.id} LOST: API winner "${apiWinnerNorm}" does not match DB polymarketTeam "${dbPolyTeamNorm}".`;
                                    console.log(`[betResolver] ${msg}`);
                                    await dbLayer.logSystemEvent('warn', 'betResolver', msg);
                                }
                            } else {
                                if (isMatch(winningOutcome, bet.chosenTeam)) {
                                    winStatus = 'won';
                                } else {
                                    winStatus = 'lost';
                                    const msg = `Bet ${bet.id} LOST: API winner "${apiWinnerNorm}" does not fuzzy-match DB chosenTeam "${dbChosenTeamNorm}".`;
                                    console.log(`[betResolver] ${msg}`);
                                    await dbLayer.logSystemEvent('warn', 'betResolver', msg);
                                }
                            }
                        }

                        if (!winStatus) {
                            const msg = `Skipping bet ${bet.id}: Could not determine win status (Winner: ${winningOutcome}, Event Status: ${event.closed ? 'closed' : 'open'}).`;
                            console.log(`[betResolver] ${msg}`);
                            await dbLayer.logSystemEvent('info', 'betResolver', msg);
                            continue;
                        }

                        const payoutAmount = winStatus === 'won' ? Math.floor(bet.stake * bet.odds) : (winStatus === 'canceled' ? bet.stake : 0);
                        const reason = winStatus === 'won' 
                            ? `Bet Won (API: ${winningOutcome}, DB: ${bet.chosenTeam})` 
                            : (winStatus === 'canceled' ? `Bet Canceled/Refunded` : `Bet Lost (API: ${winningOutcome}, DB: ${bet.chosenTeam})`);

                        const result = await dbLayer.resolveBetAtomic(bet.id, winStatus, payoutAmount, reason);
                        
                        if (result.success) {
                            const msg = `Bet ${bet.id} successfully resolved as ${winStatus.toUpperCase()}. Payout: ${payoutAmount}`;
                            console.log(`[betResolver] ${msg}`);
                            await dbLayer.logSystemEvent('info', 'betResolver', msg);
                            stats.resolvedBets++;
                        } else {
                            const msg = `Bet ${bet.id} resolution FAILED (Atomic): ${result.reason}`;
                            console.log(`[betResolver] ${msg}`);
                            await dbLayer.logSystemEvent('warn', 'betResolver', msg);
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
        await dbLayer.logSystemEvent('info', 'betResolver', `Cycle finished. Processed: ${stats.processedMatches} matches, Resolved: ${stats.resolvedBets} bets, Fails: ${stats.fails}.`);
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
    dbLayer.logSystemEvent('info', 'betResolver', 'Cron job initialized (runs every 30 minutes).');
};

module.exports = { startCron, resolveBets };
