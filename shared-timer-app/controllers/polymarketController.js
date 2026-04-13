const dbLayer = require('../database');
const axios = require('axios');

exports.addGeneralBet = async (req, res, next) => {
    try {
        const { title, url } = req.body;
        const userId = req.user?.id || req.user?.userId;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!title || !url) return res.status(400).json({ error: 'Title and URL are required' });

        // Permission check
        const settings = await dbLayer.getPolymarketSettings();
        const user = await dbLayer.getUserById(userId);
        const isSuperAdmin = user?.is_superadmin || false;

        if (!isSuperAdmin && !settings.allowUsersToAdd) {
            return res.status(403).json({ error: 'Das Hinzufügen von Wetten ist aktuell nur für Superadmins erlaubt.' });
        }

        // Extract slug from URL
        let slug = '';
        if (url.includes('/event/')) {
            slug = url.split('/event/')[1].split('?')[0].replace(/\/$/, '');
        } else if (url.includes('/market/')) {
            // Some URLs are /market/[slug]
            slug = url.split('/market/')[1].split('?')[0].replace(/\/$/, '');
        }

        if (!slug) {
            return res.status(400).json({ error: 'Invalid Polymarket URL. Must contain /event/ or /market/' });
        }

        // Fetch metadata from Gamma API
        const response = await axios.get('https://gamma-api.polymarket.com/events', {
            params: { slug }
        });

        if (!response.data || response.data.length === 0) {
            return res.status(404).json({ error: 'Polymarket event not found for this slug' });
        }

        const event = response.data[0];
        const markets = event.markets || [];

        // Detect if this is a Multi-Choice event (Tournament/Election)
        const isMultiMarket = markets.length > 2 && markets.every(m => {
            try {
                const outcomes = JSON.parse(m.outcomes || '[]');
                return outcomes.includes('Yes') || outcomes.includes('No');
            } catch { return false; }
        });

        let formattedOutcomes = [];

        if (isMultiMarket) {
            // AGGREGATE MODE: Collect "Yes" prices from all binary markets
            formattedOutcomes = markets.map(m => {
                const outcomes = JSON.parse(m.outcomes || '[]');
                const prices = JSON.parse(m.outcomePrices || '[]');
                const yesIndex = outcomes.indexOf('Yes');
                
                let name = m.groupItemTitle || m.question;
                if (name && name.startsWith('Will ') && name.endsWith(' win?')) {
                    name = name.substring(5, name.length - 5);
                }

                return {
                    name: name || 'Unknown',
                    price: parseFloat(prices[yesIndex] || 0),
                    pct: Math.round(parseFloat(prices[yesIndex] || 0) * 100)
                };
            }).sort((a, b) => b.price - a.price);
        } else {
            // SINGLE MARKET MODE: Existing winner market logic
            const winnerMarket = markets.find(m => m.sportsMarketType === 'moneyline' || m.groupItemTitle === 'Match Winner') 
                              || markets[0];

            if (!winnerMarket) {
                return res.status(400).json({ error: 'No suitable market found for this event' });
            }

            const outcomes = JSON.parse(winnerMarket.outcomes || '[]');
            const prices = JSON.parse(winnerMarket.outcomePrices || '[]');

            formattedOutcomes = outcomes.map((name, i) => ({
                name,
                price: parseFloat(prices[i] || 0),
                pct: Math.round(parseFloat(prices[i] || 0) * 100)
            }));
        }

        const result = await dbLayer.addPolymarketGeneralBet(userId, title, slug, url, formattedOutcomes);
        res.json({ success: true, id: result.id });
    } catch (err) {
        if (err.message && err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'This bet has already been added' });
        }
        next(err);
    }
};

exports.getAllGeneralBets = async (req, res, next) => {
    try {
        const bets = await dbLayer.getAllPolymarketGeneralBets();
        res.json(bets);
    } catch (err) {
        next(err);
    }
};

exports.placeGeneralBet = async (req, res, next) => {
    try {
        const { betId, outcomeIndex, amount } = req.body;
        const userId = req.user?.id || req.user?.userId;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        
        const betAmount = parseInt(amount);
        if (isNaN(betAmount) || betAmount <= 0) {
            return res.status(400).json({ error: 'Invalid bet amount' });
        }

        const user = await dbLayer.getUserById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        if (user.koala_balance < betAmount) {
            return res.status(400).json({ error: 'Not enough KoalaCoins' });
        }

        // Fetch the general bet to get current outcomes/prices to calculate shares
        const generalBet = await dbLayer.getPolymarketGeneralBetById(betId);
        if (!generalBet) return res.status(404).json({ error: 'General bet not found' });

        // Force a refresh of odds for this specific market to get the most accurate price
        const { fetchPolymarketOddsData } = require('./apiController');
        const oddsData = await fetchPolymarketOddsData({ 
            slug: generalBet.slug, 
            team1: '', team2: '', startTime: '' // Stub for generateSlugs
        });

        const event = oddsData.find(e => e.slug === generalBet.slug);
        if (!event || !event.outcomes || !event.outcomes[outcomeIndex]) {
            return res.status(400).json({ error: 'Could not fetch current market price. Please try again later.' });
        }

        const priceAtBet = parseFloat(event.outcomes[outcomeIndex].price);
        if (priceAtBet <= 0) {
            return res.status(400).json({ error: 'Market price is invalid or too low.' });
        }

        const shares = parseFloat((betAmount / priceAtBet).toFixed(4));

        // Place the bet with shares
        await dbLayer.placePolymarketUserBet(userId, betId, outcomeIndex, betAmount, shares, priceAtBet);
        
        // Deduct coins using the canonical method
        const amountCents = betAmount * 100;
        const newBalanceCents = await dbLayer.addKoalaCoins(userId, -amountCents, `Polymarket-Wette: ${generalBet.title} (Ausgang: ${event.outcomes[outcomeIndex].name})`);

        res.json({ 
            success: true, 
            newBalance: newBalanceCents / 100,
            shares,
            priceAtBet
        });
    } catch (err) {
        next(err);
    }
};

exports.deleteGeneralBet = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || req.user?.userId;

        const user = await dbLayer.getUserById(userId);
        if (!user || !user.is_superadmin) {
            return res.status(403).json({ error: 'Nur Superadmins können Wetten löschen' });
        }

        await dbLayer.deletePolymarketGeneralBet(id);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

exports.resolveGeneralBet = async (req, res, next) => {
    try {
        const { id } = req.body;
        const userId = req.user?.id || req.user?.userId;

        const user = await dbLayer.getUserById(userId);
        if (!user || !user.is_superadmin) {
            return res.status(403).json({ error: 'Nur Superadmins können Wetten auflösen' });
        }

        const generalBet = await dbLayer.getPolymarketGeneralBetById(id);
        if (!generalBet) return res.status(404).json({ error: 'Bet not found' });
        if (generalBet.status === 'resolved') return res.status(400).json({ error: 'Diese Wette wurde bereits aufgelöst.' });

        // Fetch current outcome prices
        const { fetchPolymarketOddsData } = require('./apiController');
        const oddsData = await fetchPolymarketOddsData({ 
            slug: generalBet.slug, 
            team1: '', team2: '', startTime: '' 
        });

        const event = oddsData.find(e => e.slug === generalBet.slug);
        if (!event || !event.outcomes) {
            return res.status(400).json({ error: 'Marktdaten konnten nicht abgerufen werden.' });
        }

        // Check for winner (price >= 0.99)
        const winnerIndex = event.outcomes.findIndex(o => parseFloat(o.price) >= 0.99);

        if (winnerIndex === -1) {
            return res.status(200).json({ success: false, message: 'Markt noch offen (Kein eindeutiges Ergebnis gefunden).' });
        }

        const winnerName = event.outcomes[winnerIndex].name;
        
        // Payout winners
        const userBets = await dbLayer.getPolymarketUserBets(id);
        let payoutsCount = 0;
        let totalCentsPaid = 0;

        for (const userBet of userBets) {
            if (userBet.outcomeIndex === winnerIndex) {
                const payoutCents = Math.floor(userBet.shares * 100);
                if (payoutCents > 0) {
                    await dbLayer.addKoalaCoins(userBet.userId, payoutCents, `Polymarket Gewinn: ${generalBet.title} (Ausgang: ${winnerName})`);
                    payoutsCount++;
                    totalCentsPaid += payoutCents;
                }
            }
        }

        // Update bet status
        await dbLayer.updatePolymarketGeneralBetStatus(id, 'resolved', winnerIndex);

        res.json({ 
            success: true, 
            message: `Wette erfolgreich aufgelöst: ${winnerName}`,
            payoutsCount,
            totalPaid: totalCentsPaid / 100
        });

    } catch (err) {
        next(err);
    }
};

exports.getSettings = async (req, res, next) => {
    try {
        const settings = await dbLayer.getPolymarketSettings();
        res.json(settings);
    } catch (err) {
        next(err);
    }
};

exports.getAdminSettings = async (req, res, next) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const user = await dbLayer.getUserById(userId);
        if (!user || !user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });

        const settings = await dbLayer.getPolymarketSettings();
        res.json(settings);
    } catch (err) {
        next(err);
    }
};

exports.updateSettings = async (req, res, next) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const user = await dbLayer.getUserById(userId);
        if (!user || !user.is_superadmin) return res.status(403).json({ error: 'Forbidden' });

        const { allowUsersToAdd } = req.body;
        await dbLayer.updatePolymarketSettings(allowUsersToAdd);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};
