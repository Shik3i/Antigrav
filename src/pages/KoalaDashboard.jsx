import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Trophy, TrendingUp, TrendingDown, Gift, History, Target, ArrowLeft } from 'lucide-react';


import { useNavigate } from 'react-router-dom';
import { applyRechartsStyleSheetFix } from '../utils/rechartsFix';

applyRechartsStyleSheetFix();

const TRANSACTION_TYPES = {
    'Bet placed': { icon: Target, color: '#ef4444', label: 'Bet Placed' },
    'Bet Won': { icon: Trophy, color: '#10b981', label: 'Bet Won' },
    'Completed': { icon: Trophy, color: '#3b82f6', label: 'Timer Completed' }, // Assuming timers start with "Completed "
    'Welcome': { icon: Gift, color: '#f59e0b', label: 'Welcome Bonus' },
    'Admin': { icon: Gift, color: '#8b5cf6', label: 'Admin Gift' }
};

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    return (
        <div style={{ 
            background: 'rgba(20, 24, 30, 0.85)', 
            border: '1px solid rgba(255, 255, 255, 0.1)', 
            borderRadius: '12px', 
            padding: '16px', 
            backdropFilter: 'blur(16px)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            fontSize: '0.9rem'
        }}>
            <div style={{ color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>{data.fullDate}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px' }}>
                    <span style={{ color: '#3b82f6' }}>Asset Value:</span>
                    <span style={{ fontWeight: 800 }}>{(data.assetValue || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KC</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px' }}>
                    <span style={{ color: '#10b981' }}>Liquid Balance:</span>
                    <span style={{ fontWeight: 700 }}>{(data.balance || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KC</span>
                </div>
                {data.activeRisk > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px', marginTop: '2px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Active Risk:</span>
                        <span style={{ color: '#f59e0b', fontWeight: 600 }}>{(data.activeRisk || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KC</span>
                    </div>
                )}
            </div>
        </div>
    );
};

const getTransactionMeta = (reason, amount) => {
    const r = (reason || '').toLowerCase();
    if (r.includes('bet placed')) return TRANSACTION_TYPES['Bet placed'];
    if (r.includes('bet won')) return TRANSACTION_TYPES['Bet Won'];
    if (r.includes('completed')) return TRANSACTION_TYPES['Completed'];
    if (r.includes('welcome')) return TRANSACTION_TYPES['Welcome'];
    if (r.includes('manual') || r.includes('admin')) return TRANSACTION_TYPES['Admin'];
    
    // Fallback
    return amount > 0 
        ? { icon: TrendingUp, color: '#10b981', label: 'Income' }
        : { icon: TrendingDown, color: '#ef4444', label: 'Expense' };
};


const KoalaDashboard = () => {
    const { token, user } = useAuth();
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState([]);
    const [bets, setBets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'bets'
    const [showLiquidBalance, setShowLiquidBalance] = useState(false);
    const [timeframe, setTimeframe] = useState('30d'); // '30d' | 'all'


    const fetchData = React.useCallback(async (isRefresh = false) => {
        if (!token) return;
        try {
            if (!isRefresh) setLoading(true);
            const [txRes, betsRes] = await Promise.all([
                fetch('/api/koala/transactions', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/esports/bets', { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            
            if (!txRes.ok) throw new Error('Failed to load transactions');
            if (!betsRes.ok) throw new Error('Failed to load bets');

            const txData = await txRes.json();
            const betsData = await betsRes.json();
            
            setTransactions(txData || []);
            setBets(betsData || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchData(false);
    }, [fetchData]);

    const handleRefresh = () => fetchData(true);

    const chartData = useMemo(() => {
        if (!transactions || transactions.length === 0 || !user) return [];
        
        // 1. Sort transactions by date (safeguard)
        const sortedTxs = [...transactions].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        // 2. Enhance bets with smarter matching logic
        const enhancedBets = bets.map(bet => {
            const betCreated = new Date(bet.createdAt || bet.created_at).getTime();
            const matchDeltaLimit = 300000; // 5 minutes proximity

            // Find placement transaction
            let placementTime = betCreated;
            const placementTx = sortedTxs.find(t => 
                t.reason?.toLowerCase().includes('bet placed') && 
                t.amount === -bet.stake &&
                Math.abs(new Date(t.created_at).getTime() - betCreated) < matchDeltaLimit
            );
            if (placementTx) placementTime = new Date(placementTx.created_at).getTime();

            let resolutionTime = Infinity;
            if (bet.status !== 'open') {
                const eventTime = new Date(bet.eventDate).getTime();
                if (bet.status === 'lost') {
                    resolutionTime = eventTime + 7200000; // +2 hours
                } else {
                    const reasonPrefix = bet.status === 'won' ? 'Bet Won on ' : 'Bet Canceled';
                    const matchTx = sortedTxs.find(t => 
                        t.reason?.startsWith(reasonPrefix) && 
                        t.reason?.includes(bet.chosenTeam) && 
                        new Date(t.created_at).getTime() >= eventTime - 60000
                    );
                    resolutionTime = matchTx ? new Date(matchTx.created_at).getTime() : eventTime + 7200000;
                }
            }
            return { ...bet, placementTime, resolutionTime };
        });

        // 3. Pre-calculate Risk Timeline (O(B + T))
        const riskDeltas = []; 
        enhancedBets.forEach(b => {
            riskDeltas.push({ time: b.placementTime, delta: b.stake });
            if (b.resolutionTime !== Infinity) {
                riskDeltas.push({ time: b.resolutionTime, delta: -b.stake });
            }
        });
        riskDeltas.sort((a, b) => a.time - b.time);

        // Pre-calculate cumulative risk at every unique event time
        const riskSnapshots = [];
        let rAcc = 0;
        riskDeltas.forEach(d => {
            rAcc += d.delta;
            riskSnapshots.push({ time: d.time, risk: rAcc });
        });

        const getRiskAtTime = (t) => {
            // Binary search or simple find for O(log B)
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
                activeRisk: risk / 100,
                fullDate: new Date(timestamp).toLocaleString('de-DE', { 
                    day: '2-digit', month: '2-digit', year: 'numeric', 
                    hour: '2-digit', minute: '2-digit' 
                })
            };
        };

        allPts.push(createPoint(nowMs, curBal));

        for (const tx of sortedTxs) {
            allPts.push(createPoint(new Date(tx.created_at).getTime(), curBal));
            curBal -= tx.amount;
        }
        // Add final start point
        if (sortedTxs.length > 0) {
            allPts.push(createPoint(new Date(sortedTxs[sortedTxs.length-1].created_at).getTime() - 1000, curBal));
        }

        allPts.reverse(); // Now chronological

        // 5. Filter for 30d if needed
        if (timeframe === '30d') {
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            const filtered = allPts.filter(p => p.timestamp >= thirtyDaysAgo);
            
            // If we filtered out the start, we MUST inject a dummy start point to keep math precise
            if (filtered.length < allPts.length && filtered.length > 0) {
                const firstVisible = filtered[0];
                const realPrev = allPts[allPts.indexOf(firstVisible) - 1];
                if (realPrev) {
                    filtered.unshift({ ...realPrev, timestamp: thirtyDaysAgo });
                }
            }
            allPts = filtered;
        }

        // 6. Downsampling (Bucket-based aggregation)
        if (allPts.length > 120) {
            const targetCount = 100;
            const bucketSize = (allPts[allPts.length - 1].timestamp - allPts[0].timestamp) / targetCount;
            const sampled = [];
            let currentBucketEnd = allPts[0].timestamp + bucketSize;
            let bucketBuffer = [];

            allPts.forEach((p, idx) => {
                if (p.timestamp <= currentBucketEnd || idx === allPts.length - 1) {
                    bucketBuffer.push(p);
                } else {
                    if (bucketBuffer.length > 0) {
                        sampled.push(bucketBuffer[bucketBuffer.length - 1]); // Last point in bucket
                    }
                    bucketBuffer = [p];
                    currentBucketEnd += bucketSize;
                }
            });
            // Ensure last point is always included for precision
            if (bucketBuffer.length > 0) sampled.push(allPts[allPts.length - 1]);
            return sampled;
        }

        return allPts;
    }, [transactions, bets, user.id, user.koala_balance, timeframe]);


    const activeBets = bets.filter(b => b.status === 'open');
    const pastBets = bets.filter(b => b.status !== 'open');

    return (
        <div className="animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                <button className="btn-ghost" onClick={() => navigate('/esports')} style={{ padding: '8px' }}>
                    <ArrowLeft size={24} />
                </button>
                <Trophy size={32} color="var(--accent-primary)" />
                <h1 style={{ margin: 0, fontSize: '2.5rem' }}>Financial Dashboard</h1>
                {loading && transactions.length > 0 && (
                    <div className="animate-spin" style={{ marginLeft: '12px', width: '20px', height: '20px', border: '2px solid var(--accent-primary)', borderTopColor: 'transparent', borderRadius: '50%' }} />
                )}
            </div>
            {/* Top Stat Cards */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
                gap: '16px', 
                marginBottom: '32px' 
            }}>
                <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Asset Value</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, background: 'linear-gradient(135deg, #10b981, #059669)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        {(((user?.koala_balance || 0) + activeBets.reduce((sum, b) => sum + b.stake, 0)) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KC
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Liquid Balance</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        {((user?.koala_balance || 0) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KC
                    </div>
                </div>
                
                <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Bets Risked</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                        {((activeBets.reduce((sum, b) => sum + b.stake, 0)) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KC
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Potential Wealth</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, background: 'linear-gradient(135deg, #f59e0b, #d97706)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        {(((user?.koala_balance || 0) + activeBets.reduce((sum, b) => sum + Math.round(b.stake * b.odds), 0)) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KC
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <button 
                    className={`btn-ghost ${activeTab === 'overview' ? 'active' : ''}`}
                    style={{ padding: '10px 20px', borderRadius: '8px', background: activeTab === 'overview' ? 'rgba(59, 130, 246, 0.15)' : 'transparent', color: activeTab === 'overview' ? 'var(--accent-primary)' : 'var(--text-muted)' }}
                    onClick={() => setActiveTab('overview')}
                >
                    <History size={18} /> Overview & Ledger
                </button>
                <button 
                    className={`btn-ghost ${activeTab === 'bets' ? 'active' : ''}`}
                    style={{ padding: '10px 20px', borderRadius: '8px', background: activeTab === 'bets' ? 'rgba(59, 130, 246, 0.15)' : 'transparent', color: activeTab === 'bets' ? 'var(--accent-primary)' : 'var(--text-muted)' }}
                    onClick={() => setActiveTab('bets')}
                >
                    <Target size={18} /> Betting History ({bets.length})
                </button>
            </div>

            {loading ? (
                 <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading financial data...</div>
            ) : error ? (
                <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>{error}</div>
            ) : activeTab === 'overview' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px' }}>
                    {/* Chart Section */}
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Balance History</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <button 
                                        onClick={() => setTimeframe('30d')}
                                        style={{ 
                                            padding: '6px 12px', borderRadius: '8px', border: 'none', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                            background: timeframe === '30d' ? 'var(--accent-primary)' : 'transparent',
                                            color: timeframe === '30d' ? '#fff' : 'var(--text-muted)',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >30T</button>
                                    <button 
                                        onClick={() => setTimeframe('all')}
                                        style={{ 
                                            padding: '6px 12px', borderRadius: '8px', border: 'none', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                            background: timeframe === 'all' ? 'var(--accent-primary)' : 'transparent',
                                            color: timeframe === 'all' ? '#fff' : 'var(--text-muted)',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >ALLE</button>
                                </div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={showLiquidBalance} 
                                        onChange={(e) => setShowLiquidBalance(e.target.checked)} 
                                        style={{ margin: 0 }}
                                    />
                                    Liquid Balance
                                </label>
                            </div>

                        </div>
                        <div style={{ width: '100%', height: '350px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                                    <XAxis 
                                        dataKey="timestamp" 
                                        stroke="var(--text-muted)" 
                                        fontSize={12} 
                                        tickLine={false} 
                                        axisLine={false} 
                                        minTickGap={30}
                                        tickFormatter={(unixTime) => {
                                            const d = new Date(unixTime);
                                            // Quick check if it's "Now" (very recent)
                                            if (Math.abs(Date.now() - unixTime) < 60000) return 'Now';
                                            return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
                                        }}
                                    />
                                    <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `${v >= 1000 ? (v/1000).toFixed(1)+'k' : v}`} width={50} />
                                    <Tooltip content={<CustomTooltip />} />

                                    <Area type="monotone" dataKey="assetValue" stroke="#3b82f6" strokeWidth={2} fillOpacity={0.2} fill="url(#colorBalance)" />
                                    {showLiquidBalance && (
                                        <Area type="monotone" dataKey="balance" stroke="#10b981" strokeWidth={2} fillOpacity={0.8} fill="url(#colorBalance)" />
                                    )}
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Ledger Section */}
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <h3 style={{ margin: '0 0 24px 0', fontSize: '1.2rem' }}>Recent Transactions</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {transactions.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No transactions found.</div>
                            ) : (
                                transactions.slice(0, 50).map((tx) => {
                                    const meta = getTransactionMeta(tx.reason, tx.amount);
                                    const Icon = meta.icon;
                                    const isPos = tx.amount > 0;
                                    
                                    return (
                                        <div key={tx.id} style={{ 
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                                            padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)',
                                            border: '1px solid var(--border-color)'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: `${meta.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Icon size={20} color={meta.color} />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '1rem' }}>{meta.label}</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>{tx.reason || 'Manual Adjustment'}</div>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: isPos ? '#10b981' : '#ef4444' }}>
                                                    {isPos ? '+' : ''}{(tx.amount / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KC
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    {new Date(tx.created_at).toLocaleString('de-DE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    {/* Active Bets */}
                    <div>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: 10, height: 10, background: '#3b82f6', borderRadius: '50%', animation: 'pulse 2s infinite' }} />
                            Aktiv ({activeBets.length})
                        </h3>
                        {activeBets.length === 0 ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                                Keine aktiven Wetten.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {activeBets.map(bet => (
                                    <BetCard key={bet.id} bet={bet} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Past Bets */}
                    <div>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.3rem', color: 'var(--text-muted)' }}>
                            Vergangen ({pastBets.length})
                        </h3>
                        {pastBets.length === 0 ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                                Noch keine vergangenen Wetten.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {pastBets.map(bet => (
                                    <BetCard key={bet.id} bet={bet} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const BetCard = ({ bet }) => {
    const isWon = bet.status === 'won';
    const isLost = bet.status === 'lost';
    const isRefund = bet.status === 'canceled';

    return (
        <div className="glass-card" style={{
            padding: '16px', 
            borderLeft: isWon ? '4px solid #10b981' : isLost ? '4px solid #ef4444' : isRefund ? '4px solid #f59e0b' : '4px solid #3b82f6'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '1.1rem' }}>{bet.chosenTeam}</h4>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {bet.matchName} • {new Date(bet.eventDate).toLocaleString('de-DE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {bet.polymarketUrl && (
                        <a href={bet.polymarketUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', fontSize: '0.8rem', color: 'var(--accent-primary)', marginTop: '8px' }}>
                            View Market
                        </a>
                    )}
                </div>
                
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        Einsatz: <strong style={{ color: 'var(--text-main)' }}>{(bet.stake / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KC</strong>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        Quote: <strong style={{ color: 'var(--text-main)' }}>{bet.odds.toFixed(2)}</strong>
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '4px', color: isWon ? '#10b981' : isLost ? '#ef4444' : 'var(--text-main)' }}>
                        {isWon ? `+${(Math.floor(bet.stake * bet.odds) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KC` : 
                         isLost ? `-${(bet.stake / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KC` : 
                         isRefund ? 'Refunded' :
                         `Potenzial: ${(Math.floor(bet.stake * bet.odds) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KC`}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KoalaDashboard;
