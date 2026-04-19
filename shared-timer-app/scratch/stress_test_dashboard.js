/**
 * Stress Test for KoalaDashboard Chart Logic
 * Verifies performance with 5000 transactions and 500 bets.
 */

function stressTest() {
    console.log("Starting Stress Test...");

    // 1. Generate Mock Data
    const numTxs = 5000;
    const numBets = 500;
    const now = Date.now();
    
    const transactions = [];
    for(let i=0; i<numTxs; i++) {
        transactions.push({
            id: i,
            amount: (Math.random() - 0.4) * 1000, // mixture of pos/neg
            created_at: new Date(now - (i * 3600000)).toISOString() // one per hour
        });
    }

    const bets = [];
    for(let i=0; i<numBets; i++) {
        const placement = now - (Math.random() * numTxs * 3600000);
        bets.push({
            id: i,
            stake: Math.floor(Math.random() * 500),
            created_at: new Date(placement).toISOString(),
            eventDate: new Date(placement + 7200000).toISOString(),
            status: Math.random() > 0.5 ? 'won' : 'lost'
        });
    }

    const user = { koala_balance: 100000 };
    const timeframe = 'all';

    console.time("Chart Calculation");

    // --- REPLICATED LOGIC FROM KOALADASHBOARD.JSX ---
    
    // 1. Sort
    const sortedTxs = [...transactions].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // 2. Enhance bets (Simplified for test)
    const enhancedBets = bets.map(bet => {
        const betCreated = new Date(bet.created_at).getTime();
        const eventTime = new Date(bet.eventDate).getTime();
        let resolutionTime = eventTime + 7200000;
        return { ...bet, placementTime: betCreated, resolutionTime };
    });

    // 3. Pre-calculate Risk Timeline
    const riskDeltas = []; 
    enhancedBets.forEach(b => {
        riskDeltas.push({ time: b.placementTime, delta: b.stake });
        if (b.resolutionTime !== Infinity) {
            riskDeltas.push({ time: b.resolutionTime, delta: -b.stake });
        }
    });
    riskDeltas.sort((a, b) => a.time - b.time);

    const riskSnapshots = [];
    let rAcc = 0;
    riskDeltas.forEach(d => {
        rAcc += d.delta;
        riskSnapshots.push({ time: d.time, risk: rAcc });
    });

    const getRiskAtTime = (t) => {
        let low = 0, high = riskSnapshots.length - 1;
        let res = 0;
        while (low <= high) {
            let mid = Math.floor((low + high) / 2);
            if (riskSnapshots[mid].time <= t) {
                res = riskSnapshots[mid].risk;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        return res;
    };

    // 4. Reconstruct history backwards
    let curBal = user.koala_balance || 0;
    let allPts = [];
    const nowMs = Date.now();
    
    const createPoint = (timestamp, balance) => {
        const risk = getRiskAtTime(timestamp);
        return {
            timestamp,
            balance: balance / 100,
            assetValue: (balance + risk) / 100,
            activeRisk: risk / 100
        };
    };

    allPts.push(createPoint(nowMs, curBal));

    for (const tx of sortedTxs) {
        allPts.push(createPoint(new Date(tx.created_at).getTime(), curBal));
        curBal -= tx.amount;
    }
    allPts.reverse();

    // 5. Downsampling
    const targetCount = 100;
    const bucketSize = (allPts[allPts.length - 1].timestamp - allPts[0].timestamp) / targetCount;
    const sampled = [];
    let currentBucketEnd = allPts[0].timestamp + bucketSize;
    let bucketBuffer = [];

    allPts.forEach((p, idx) => {
        if (p.timestamp <= currentBucketEnd || idx === allPts.length - 1) {
            bucketBuffer.push(p);
        } else {
            if (bucketBuffer.length > 0) sampled.push(bucketBuffer[bucketBuffer.length - 1]);
            bucketBuffer = [p];
            currentBucketEnd += bucketSize;
        }
    });
    if (bucketBuffer.length > 0) sampled.push(allPts[allPts.length - 1]);

    console.timeEnd("Chart Calculation");
    
    console.log(`Input: ${numTxs} transactions, ${numBets} bets`);
    console.log(`Output points (chronological): ${allPts.length}`);
    console.log(`Sampled points: ${sampled.length}`);
    console.log(`Precision Check (End Balance): ${sampled[sampled.length - 1].balance * 100} (Expected: ${user.koala_balance})`);
    
    if (sampled[sampled.length - 1].balance * 100 === user.koala_balance) {
        console.log("SUCCESS: End point matches exactly.");
    } else {
        console.error("FAILURE: End point mismatch!");
    }
}

stressTest();
