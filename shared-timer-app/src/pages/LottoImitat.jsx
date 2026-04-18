import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    Ticket, 
    History, 
    TrendingUp, 
    Clock, 
    ShoppingBag, 
    RefreshCw, 
    CheckCircle2, 
    AlertCircle, 
    ChevronRight, 
    ChevronDown,
    Dices, 
    Trash2,
    Calendar,
    Trophy,
    Lock,
    Zap
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { usePersistentData } from '../context/PersistentDataContext';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import '../index.css';

    const LottoImitat = () => {
        const { token, user } = useAuth();
        const { lottoData, loadingLotto, loadLottoData } = usePersistentData();
        const { showToast } = useToast();
        const navigate = useNavigate();

    const [selectedNumbers, setSelectedNumbers] = useState([]);
    const [selectedSuper, setSelectedSuper] = useState(0);
    const [cart, setCart] = useState([]);
    const [isPurchasing, setIsPurchasing] = useState(false);
    const [countdown, setCountdown] = useState('');
    const [cutoffCountdown, setCutoffCountdown] = useState('');
    const [expandedGroups, setExpandedGroups] = useState({});
    const [showOdds, setShowOdds] = useState(false);
    const [expandedSubCategories, setExpandedSubCategories] = useState({}); // Key: `${drawDate}-${type}`
    const [extraGains, setExtraGains] = useState(null); // Local state for sidebar logic if needed

    // --- Memoized State & Derived Logic (Must be defined before use in functions) ---
    const isCutoffActiveMemo = useMemo(() => {
        if (!lottoData.nextCutoffTime || !lottoData.nextDrawTime) return false;
        const adjustedNow = Date.now() + (lottoData.clockOffset || 0);
        return adjustedNow >= lottoData.nextCutoffTime && adjustedNow < lottoData.nextDrawTime;
    }, [lottoData.nextCutoffTime, lottoData.nextDrawTime, lottoData.clockOffset, countdown]);

    const willBuyForTomorrowMemo = useMemo(() => {
        if (!lottoData.nextCutoffTime) return false;
        const adjustedNow = Date.now() + (lottoData.clockOffset || 0);
        return adjustedNow >= lottoData.nextCutoffTime;
    }, [lottoData.nextCutoffTime, lottoData.clockOffset, countdown]);

    const sortedWinClasses = useMemo(() => {
        if (!lottoData.config?.winClasses) return [];
        return [...lottoData.config.winClasses].sort((a, b) => a.class - b.class);
    }, [lottoData.config?.winClasses]);

    const activeWinClasses = useMemo(() => {
        const classes = new Set();
        lottoData.userHistory.forEach(group => {
            if (expandedGroups[group.drawDate]) {
                group.tickets.forEach(ticket => {
                    if (ticket.winClass > 0) classes.add(ticket.winClass);
                });
            }
        });
        return classes;
    }, [lottoData.userHistory, expandedGroups]);

    const toggleGroup = (drawDate) => {
        setExpandedGroups(prev => ({
            ...prev,
            [drawDate]: !prev[drawDate]
        }));
    };

    const toggleSubCategory = (drawDate, type) => {
        setExpandedSubCategories(prev => {
            const key = `${drawDate}-${type}`;
            // If it doesn't exist yet, we need to know the default to flip it
            return {
                ...prev,
                [key]: prev[key] === undefined ? false : !prev[key] // Note: This logic assumes we handle defaults in the render
            };
        });
    };

    // Load data on mount
    useEffect(() => {
        loadLottoData();
    }, [loadLottoData]);

    // Countdown logic
    useEffect(() => {
        const updateCountdown = () => {
            if (!lottoData.nextDrawTime || !lottoData.nextCutoffTime) {
                setCountdown('--:--:--');
                setCutoffCountdown('--:--:--');
                return;
            }

            const adjustedNow = Date.now() + (lottoData.clockOffset || 0);

            // 1. Draw Countdown
            const drawDiff = lottoData.nextDrawTime - adjustedNow;
            if (drawDiff <= 0) {
                setCountdown('00:00:00');
            } else {
                const h = Math.floor(drawDiff / 3600000);
                const m = Math.floor((drawDiff % 3600000) / 60000);
                const s = Math.floor((drawDiff % 60000) / 1000);
                setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
            }

            // 2. Cutoff Countdown
            const cutoffDiff = lottoData.nextCutoffTime - adjustedNow;
            if (cutoffDiff <= 0) {
                setCutoffCountdown('Beendet');
                /* setCutoffCountdown('Beendet'); // DEMO MODE */
            } else {
                const h = Math.floor(cutoffDiff / 3600000);
                const m = Math.floor((cutoffDiff % 3600000) / 60000);
                const s = Math.floor((cutoffDiff % 60000) / 1000);
                setCutoffCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
            }
        };

        const timer = setInterval(updateCountdown, 1000);
        updateCountdown();
        return () => clearInterval(timer);
    }, [lottoData.nextDrawTime, lottoData.nextCutoffTime, lottoData.clockOffset]);

    // Number interaction
    const quickTipp = () => {
        const nums = [];
        while (nums.length < 6) {
            const r = Math.floor(Math.random() * 49) + 1;
            if (!nums.includes(r)) nums.push(r);
        }
        setSelectedNumbers(nums.sort((a, b) => a - b));
        setSelectedSuper(Math.floor(Math.random() * 10));
    };

    const generateRandomTicket = () => {
        const nums = new Set();
        while (nums.size < 6) {
            nums.add(Math.floor(Math.random() * 49) + 1);
        }
        return {
            numbers: Array.from(nums).sort((a,b) => a-b),
            superzahl: Math.floor(Math.random() * 10)
        };
    };
    const addBulkRandom = (count) => {
        const relevantTicketCount = willBuyForTomorrowMemo 
            ? lottoData.userTicketsTomorrow 
            : lottoData.userTicketsToday;
        const currentTotal = cart.length + relevantTicketCount;
        const maxAllowed = lottoData.config?.maxTicketsPerDay || 100;
        
        const remaining = maxAllowed - currentTotal;
        const actualToAdd = Math.min(count, remaining);
        
        if (actualToAdd <= 0) {
            showToast('Ticket-Limit für diese Ziehung erreicht!', 'error');
            return;
        }

        if (actualToAdd < count) {
            showToast(`Nur ${actualToAdd} Tickets hinzugefügt (Limit erreicht).`, 'info');
        }

        const relevantDrawDate = willBuyForTomorrowMemo ? lottoData.tomorrow : lottoData.today;

        // Create a set of existing combinations for duplicate checking
        const existingCombis = new Set();
        lottoData.userHistory.forEach(group => {
             if (group.drawDate === relevantDrawDate) {
                group.tickets.forEach(ticket => {
                    const nums = safeParseNumbers(ticket.numbers).sort((a,b) => a-b).join(',');
                    existingCombis.add(`${nums}_${ticket.superzahl}`);
                });
             }
        });
        // Add current cart to set
        cart.forEach(item => {
            const nums = [...item.numbers].sort((a,b) => a-b).join(',');
            existingCombis.add(`${nums}_${item.superzahl}`);
        });

        const newTickets = [];
        let attempts = 0;
        while (newTickets.length < actualToAdd && attempts < actualToAdd * 10) {
            attempts++;
            const ticket = generateRandomTicket();
            const nums = [...ticket.numbers].sort((a,b) => a-b).join(',');
            const key = `${nums}_${ticket.superzahl}`;
            
            if (!existingCombis.has(key)) {
                existingCombis.add(key);
                newTickets.push({ 
                    ...ticket, 
                    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9) 
                });
            }
        }

        if (newTickets.length > 0) {
            setCart(prev => [...prev, ...newTickets]);
        }
        
        if (newTickets.length < actualToAdd) {
            showToast('Einige Zufallstickets wurden übersprungen (Duplikate).', 'info');
        }
    };

    const addToCart = useCallback(() => {
        if (selectedNumbers.length < 6) {
            showToast('Bitte wähle 6 Zahlen aus!', 'error');
            return;
        }
        const relevantTicketCount = willBuyForTomorrowMemo 
            ? lottoData.userTicketsTomorrow 
            : lottoData.userTicketsToday;
        if (cart.length + relevantTicketCount >= (lottoData.config?.maxTicketsPerDay || 100)) {
            showToast('Ticket-Limit für diese Ziehung erreicht!', 'error');
            return;
        }

        const sortedSelection = [...selectedNumbers].sort((a,b) => a-b).join(',');
        const selectionKey = `${sortedSelection}_${selectedSuper}`;

        // Check duplicates in cart
        const isDuplicateInCart = cart.some(item => {
            const s = [...item.numbers].sort((a,b) => a-b).join(',');
            return `${s}_${item.superzahl}` === selectionKey;
        });

        if (isDuplicateInCart) {
            showToast('Dieses Ticket befindet sich bereits im Warenkorb!', 'error');
            return;
        }

        const relevantDrawDate = willBuyForTomorrowMemo ? lottoData.tomorrow : lottoData.today;

        // Check duplicates in already purchased
        const isAlreadyPurchased = lottoData.userHistory.some(group => {
            if (group.drawDate === relevantDrawDate) {
                return group.tickets.some(ticket => {
                    const s = safeParseNumbers(ticket.numbers).sort((a,b) => a-b).join(',');
                    return `${s}_${ticket.superzahl}` === selectionKey;
                });
            }
            return false;
        });

        if (isAlreadyPurchased) {
            showToast(`Dieses Ticket hast du für den ${relevantDrawDate === lottoData.today ? 'heutigen' : 'morgigen'} Tag bereits gekauft!`, 'error');
            return;
        }

        const newId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9);
        setCart(prev => [...prev, { 
            id: newId,
            numbers: [...selectedNumbers], 
            superzahl: selectedSuper 
        }]);
        setSelectedNumbers([]);
        showToast('Ticket zum Warenkorb hinzugefügt', 'success');
    }, [selectedNumbers, selectedSuper, cart, lottoData.userTicketsToday, lottoData.userTicketsTomorrow, lottoData.today, lottoData.tomorrow, lottoData.userHistory, lottoData.config?.maxTicketsPerDay, showToast, willBuyForTomorrowMemo]);

    const buyTickets = useCallback(async () => {
        if (cart.length === 0) return;
        setIsPurchasing(true);
        try {
            await axios.post('/api/lotto/buy', { tickets: cart }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            showToast(`${cart.length} Tickets erfolgreich gekauft!`, 'success');
            setCart([]);
            loadLottoData(true);
        } catch (err) {
            const msg = err.response?.data?.message || err.response?.data?.error || 'Kauf fehlgeschlagen';
            showToast(msg, 'error');
        } finally {
            setIsPurchasing(false);
        }
    }, [cart, token, loadLottoData, showToast]);

    const removeCartItem = useCallback((id) => {
        setCart(prev => prev.filter(item => item.id !== id));
    }, []);

    const toggleNumber = useCallback((num) => {
        setSelectedNumbers(prev => {
            if (prev.includes(num)) return prev.filter(n => n !== num);
            if (prev.length >= 6) return prev;
            return [...prev, num].sort((a, b) => a - b);
        });
    }, []);

    const safeParseNumbers = (data) => {
        if (Array.isArray(data)) return data;
        try {
            return JSON.parse(data || '[]');
        } catch (e) {
            return [];
        }
    };

    const parseDrawDate = (str) => {
        if (!str) return null;
        const [y, m, d] = str.split('-').map(Number);
        return new Date(y, m - 1, d);
    };



    // --- History Rendering Helper ---
    const renderHistoryTicket = (ticket, group, outcomeType) => {
        const ticketNums = safeParseNumbers(ticket.numbers);
        const drawnNums = safeParseNumbers(group.drawNumbers);
        const isSuperMatch = Number(ticket.superzahl) === Number(group.drawSuperzahl);
        const matchCount = ticket.matchCount ?? 0;
        const winAmount = ticket.winAmount ?? 0;

        let borderStyle = '1px solid var(--border-color)';
        let opacity = 1;
        if (outcomeType === 'winner') borderStyle = '1px solid #10b981';
        else if (outcomeType === 'near') borderStyle = '1px solid #f59e0b';
        else if (outcomeType === 'lose') opacity = 0.6;

        return (
            <div key={ticket.id} style={{ 
                display: 'flex', 
                flexDirection: 'column',
                background: 'rgba(255,255,255,0.02)', 
                padding: '12px', 
                borderRadius: '12px',
                gap: '8px',
                flex: '0 0 auto',
                border: borderStyle,
                borderLeft: (outcomeType === 'winner' || outcomeType === 'near') ? `4px solid ${outcomeType === 'winner' ? '#10b981' : '#f59e0b'}` : borderStyle.split(' ')[2],
                opacity: opacity,
                transition: 'all 0.2s ease'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {ticketNums.map((n, i) => {
                            const isMatch = drawnNums.includes(n);
                            return (
                                <span key={i} className="ball-mini" style={{ 
                                    background: isMatch ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                                    color: isMatch ? 'white' : 'var(--text-muted)',
                                    boxShadow: isMatch ? '0 0 8px rgba(99,102,241,0.5)' : 'none',
                                    border: isMatch ? 'none' : '1px solid var(--border-color)'
                                }}>{n}</span>
                            );
                        })}
                        <span className="ball-mini super" style={{ 
                            background: isSuperMatch ? '#ef4444' : 'rgba(245, 158, 11, 0.1)',
                            color: isSuperMatch ? 'white' : '#f59e0b',
                            boxShadow: isSuperMatch ? '0 0 8px rgba(239, 68, 68, 0.5)' : 'none',
                            border: isSuperMatch ? 'none' : '1px solid rgba(245, 158, 11, 0.2)'
                        }}>{ticket.superzahl}</span>
                    </div>
                    <div style={{ 
                        color: winAmount > 0 ? '#10b981' : 'var(--text-muted)', 
                        fontWeight: 800, 
                        fontSize: '0.8rem',
                        whiteSpace: 'nowrap'
                    }}>
                        {winAmount > 0 ? `+${(winAmount / 100).toLocaleString('de-DE')} KC` : 'Niete'}
                    </div>
                </div>
                <div style={{ 
                    fontSize: '0.7rem', 
                    fontWeight: 700, 
                    color: matchCount >= 1 ? (outcomeType === 'winner' ? '#10b981' : (outcomeType === 'near' ? '#f59e0b' : 'var(--accent-primary)')) : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                }}>
                    <CheckCircle2 size={12} />
                    {matchCount} Treffer{ticket.superzahlMatch ? ' + SZ ✓' : ''}
                </div>
            </div>
        );
    };

    // --- Memoized Components ---
    const numberGrid = useMemo(() => Array.from({ length: 49 }, (_, i) => i + 1).map(num => (
        <div 
            key={num}
            className={`lotto-num ${selectedNumbers.includes(num) ? 'selected' : ''}`}
            onClick={() => toggleNumber(num)}
        >
            {num}
        </div>
    )), [selectedNumbers, toggleNumber]);

    const superNumberGrid = useMemo(() => Array.from({ length: 10 }, (_, i) => i).map(num => (
        <div 
            key={num}
            className={`super-num ${selectedSuper === num ? 'selected' : ''}`}
            onClick={() => setSelectedSuper(num)}
        >
            {num}
        </div>
    )), [selectedSuper]);

    // Auth Guard
    if (!token) {
        return (
            <div className="lotto-auth-guard">
                <div className="glass-card lotto-auth-card">
                    <div className="lotto-lock-icon">
                        <Lock size={40} />
                    </div>
                    <h2>Exklusives Lotto</h2>
                    <p>Logge dich ein, um an der täglichen Ziehung teilzunehmen, deine Historie zu verfolgen und KoalaCoins zu gewinnen.</p>
                    <button className="btn-primary" style={{ width: '100%' }} onClick={() => navigate('/login')}>Jetzt Anmelden</button>
                </div>
                <style>{`
                    .lotto-auth-guard {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 80vh;
                        width: 100%;
                    }
                    .lotto-auth-card {
                        max-width: 480px;
                        padding: 48px;
                        text-align: center;
                        background: rgba(255,255,255,0.03);
                        border: 1px solid var(--border-color);
                    }
                    .lotto-lock-icon {
                        width: 80px;
                        height: 80px;
                        background: rgba(59, 130, 246, 0.1);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto 32px;
                        color: var(--accent-primary);
                    }
                `}</style>
            </div>
        );
    }

    if (loadingLotto && !lottoData.config) {
        return (
            <div className="flex-center" style={{ height: '60vh', flexDirection: 'column', gap: '16px' }}>
                <div className="spinner"></div>
                <h3>Lade Lotto-Daten...</h3>
                <style>{`
                    .spinner {
                        width: 40px;
                        height: 40px;
                        border: 4px solid var(--border-color);
                        border-top-color: var(--accent-primary);
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    }
                    @keyframes spin { to { transform: rotate(360deg); } }
                `}</style>
            </div>
        );
    }

    return (
        <div className="lotto-page-container">
            <style>{`
                .lotto-page-container {
                    width: 100%;
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 40px 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 32px;
                    min-height: 100vh;
                    color: var(--text-main);
                }

                .lotto-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    flex-wrap: wrap;
                    gap: 24px;
                    padding-bottom: 24px;
                    border-bottom: 1px solid var(--border-color);
                }

                .lotto-title h1 {
                    font-size: 2.5rem;
                    margin: 0 0 8px 0;
                    background: var(--accent-gradient);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .lotto-title p {
                    color: var(--text-muted);
                    font-size: 1rem;
                    margin: 0;
                }

                .countdown-box {
                    padding: 12px 24px;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }

                /* Stats Row */
                .lotto-stats-row {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                }

                .stat-card {
                    padding: 24px;
                    display: flex;
                    align-items: center;
                    gap: 20px;
                }

                .stat-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 14px;
                    background: rgba(255,255,255,0.05);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--accent-primary);
                    flex-shrink: 0;
                }

                .stat-info .stat-value {
                    display: block;
                    font-size: 1.4rem;
                    font-weight: 800;
                    font-family: 'Outfit';
                }

                .stat-info .stat-label {
                    font-size: 0.8rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                /* Layout Grid */
                .lotto-content-grid {
                    display: grid;
                    grid-template-columns: 1fr 380px;
                    gap: 32px;
                    align-items: start;
                }

                @media (max-width: 1100px) {
                    .lotto-content-grid {
                        grid-template-columns: 1fr;
                    }
                }

                /* Play Section */
                .play-section {
                    display: flex;
                    flex-direction: column;
                    gap: 32px;
                }

                .lotto-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }

                .number-grid {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 10px;
                    margin-bottom: 32px;
                }

                .lotto-num {
                    aspect-ratio: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    user-select: none;
                }

                .lotto-num:hover {
                    background: rgba(255,255,255,0.08);
                    transform: translateY(-2px);
                    border-color: var(--accent-secondary);
                }

                .lotto-num.selected {
                    background: var(--accent-gradient);
                    color: white;
                    border-color: transparent;
                    box-shadow: 0 4px 15px rgba(255,255,255,0.15);
                    transform: scale(1.05);
                }

                /* Superzahl */
                .superzahl-section {
                    background: rgba(255,255,255,0.015);
                    padding: 24px;
                    border-radius: 20px;
                    border: 1px solid var(--border-color);
                }

                .superzahl-grid {
                    display: flex;
                    gap: 12px;
                    justify-content: space-between;
                    margin-top: 20px;
                    flex-wrap: wrap;
                }

                .super-num {
                    width: 38px;
                    height: 38px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    border: 1px solid var(--border-color);
                    cursor: pointer;
                    font-weight: 700;
                    transition: all 0.2s;
                    font-size: 0.9rem;
                }

                .super-num.selected {
                    background: #f59e0b;
                    color: white;
                    border-color: transparent;
                    box-shadow: 0 0 15px rgba(245, 158, 11, 0.4);
                    transform: scale(1.1);
                }

                /* Sidebar */
                .sidebar-column {
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                    position: sticky;
                    top: 24px;
                }

                .cart-items-list {
                    max-height: 420px;
                    overflow-y: auto;
                    margin-bottom: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    padding-right: 4px;
                }

                .cart-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px;
                    background: rgba(255,255,255,0.03);
                    border-radius: 12px;
                    border: 1px solid var(--border-color);
                }

                .cart-numbers {
                    display: flex;
                    gap: 4px;
                    flex-wrap: wrap;
                }

                .ball-mini {
                    width: 22px;
                    height: 22px;
                    font-size: 0.7rem;
                    background: var(--accent-secondary);
                    color: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                }

                .ball-mini.super {
                    background: #f59e0b;
                }

                .btn-remove {
                    background: none;
                    border: none;
                    color: var(--text-muted);
                    cursor: pointer;
                    padding: 4px;
                    display: flex;
                    transition: color 0.2s;
                }

                .btn-remove:hover {
                    color: #ef4444;
                }

                /* History */
                .draw-history-item {
                    padding: 20px;
                    border-bottom: 1px solid var(--border-color);
                }

                .draw-history-item:last-child {
                    border-bottom: none;
                }

                @keyframes fadeInIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .animate-in {
                    animation: fadeInIn 0.4s ease-out forwards;
                }

                .action-buttons {
                    display: flex;
                    gap: 12px;
                }

                .odds-table {
                    width: 100%;
                    border-collapse: collapse;
                    text-align: left;
                    font-size: 0.9rem;
                }

                .odds-table th {
                    padding: 12px 20px;
                    background: rgba(255,255,255,0.03);
                    color: var(--text-muted);
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    font-weight: 800;
                }

                .odds-table td {
                    padding: 14px 20px;
                    border-bottom: 1px solid rgba(255,255,255,0.03);
                }

                .odds-table tr:last-child td {
                    border-bottom: none;
                }

                @media (max-width: 600px) {
                    .odds-table {
                        font-size: 0.8rem;
                    }
                    .odds-table th, .odds-table td {
                        padding: 10px 12px;
                    }
                }
            `}</style>

            <header className="lotto-header animate-in">
                <div className="lotto-title">
                    <h1>Lotto Imitat</h1>
                    <p>Wähle 6 aus 49 Zahlen und knacke den täglichen Jackpot.</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <div className="glass-card countdown-box" style={{ gap: '24px' }}>
                        <div style={{ textAlign: 'right', paddingRight: '16px', borderRight: '1px solid var(--border-color)' }}>
                            <span style={{ display: 'block', fontSize: '0.65rem', color: '#f59e0b', textTransform: 'uppercase', fontWeight: 800 }}>Annahmeschluss</span>
                            <span style={{ fontSize: '1.1rem', fontWeight: 900, fontFamily: 'monospace', color: cutoffCountdown === 'Beendet' ? '#ef4444' : '#f59e0b' }}>
                                {cutoffCountdown}
                            </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Nächste Ziehung</span>
                            <span style={{ fontSize: '1.4rem', fontWeight: 900, fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{countdown}</span>
                        </div>
                        <Clock size={28} color="var(--accent-primary)" />
                    </div>
                    {isCutoffActiveMemo && (
                        <div style={{ 
                            background: 'rgba(245, 158, 11, 0.1)', 
                            border: '1px solid rgba(245, 158, 11, 0.2)', 
                            padding: '10px 16px', 
                            borderRadius: '10px',
                            color: '#f59e0b',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            animation: 'fadeInIn 0.4s ease-out'
                        }}>
                            <Zap size={14} />
                            Ziehung läuft. Die Ticket-Annahme ist bis 16:00 UTC gesperrt.
                        </div>
                    )}
                </div>
            </header>

            <div className="lotto-stats-row animate-in" style={{ animationDelay: '0.1s' }}>
                <div className="glass-card stat-card">
                    <div className="stat-icon"><Trophy size={24}/></div>
                    <div className="stat-info">
                        <span className="stat-value">{(lottoData.stats.totalPayout / 100).toLocaleString('de-DE')} KC</span>
                        <span className="stat-label">Gesamtgewinne</span>
                    </div>
                </div>
                <div className="glass-card stat-card">
                    <div className="stat-icon"><ShoppingBag size={24}/></div>
                    <div className="stat-info">
                        <span className="stat-value">{lottoData.stats.totalPlayed.toLocaleString('de-DE')}</span>
                        <span className="stat-label">Verkaufte Lose (gesamt)</span>
                    </div>
                </div>
                <div className="glass-card stat-card">
                    <div className="stat-icon"><Ticket size={24}/></div>
                    <div className="stat-info">
                        <span className="stat-value">{lottoData.stats.totalPending?.toLocaleString('de-DE') || 0}</span>
                        <span className="stat-label">Lose nächste Ziehung</span>
                    </div>
                </div>
                <div className="glass-card stat-card">
                    <div className="stat-icon"><CheckCircle2 size={24}/></div>
                    {(() => {
                        const relevantUserTickets = willBuyForTomorrowMemo ? lottoData.userTicketsTomorrow : lottoData.userTicketsToday;
                        const targetDate = willBuyForTomorrowMemo ? lottoData.tomorrow : lottoData.today;
                        const formattedDate = parseDrawDate(targetDate)?.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) || targetDate;
                        
                        return (
                            <div className="stat-info">
                                <span className="stat-value">{relevantUserTickets} / {lottoData.config?.maxTicketsPerDay || 100}</span>
                                <span className="stat-label">Tickets ({formattedDate})</span>
                            </div>
                        );
                    })()}
                </div>
            </div>
            <div className="lotto-odds-section animate-in" style={{ animationDelay: '0.15s' }}>
                <div 
                    className="glass-card" 
                    style={{ 
                        padding: '16px 24px', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        border: showOdds ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                        background: showOdds ? 'rgba(99, 102, 241, 0.05)' : 'rgba(255, 255, 255, 0.03)'
                    }}
                    onClick={() => setShowOdds(!showOdds)}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 700 }}>
                        {showOdds ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                        <Trophy size={18} className="text-muted" />
                        <span>Gewinnquoten & Auszahlungen</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {showOdds ? 'Einklappen' : 'Details anzeigen'}
                    </div>
                </div>

                {showOdds && lottoData.config?.winClasses && (
                    <div className="glass-card" style={{ marginTop: '12px', overflow: 'hidden', animation: 'fadeInIn 0.3s ease-out' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="odds-table">
                                <thead>
                                    <tr>
                                        <th>Klasse</th>
                                        <th>Treffer</th>
                                        <th>Chance</th>
                                        <th>Gewinn</th>
                                        <th style={{ textAlign: 'right' }}>Letzte Ziehung</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedWinClasses.map((wc, idx) => {
                                        const isHighlighted = activeWinClasses.has(wc.class);
                                        return (
                                            <tr 
                                                key={wc.class} 
                                                style={{ 
                                                    background: isHighlighted 
                                                        ? 'rgba(16, 185, 129, 0.1)' 
                                                        : (idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'),
                                                    borderLeft: isHighlighted ? '4px solid #10b981' : 'none',
                                                    transition: 'all 0.3s ease'
                                                }}
                                            >
                                                <td style={{ fontWeight: 800, color: isHighlighted ? '#10b981' : 'var(--text-muted)' }}>Kl. {wc.class}</td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        {wc.label.split('+').map((part, i) => (
                                                            <React.Fragment key={i}>
                                                                {i > 0 && <span>+</span>}
                                                                <span style={{ 
                                                                    color: part.includes('Superzahl') ? '#ef4444' : (isHighlighted ? '#10b981' : 'inherit'), 
                                                                    fontWeight: (part.includes('Superzahl') || isHighlighted) ? 700 : 400 
                                                                }}>
                                                                    {part.trim()}
                                                                </span>
                                                            </React.Fragment>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: isHighlighted ? '#10b981' : 'inherit' }}>{wc.probability}</td>
                                                <td style={{ 
                                                    textAlign: 'right', 
                                                    fontWeight: 800, 
                                                    color: (wc.class === 1 || wc.class === 2) ? '#f59e0b' : (isHighlighted ? '#10b981' : 'var(--accent-primary)'),
                                                    fontSize: '1rem'
                                                }}>
                                                    {(wc.payoutCents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KC
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    {(() => {
                                                        const winCount = lottoData.lastDraw?.winnersByClass?.[wc.class];
                                                        if (winCount > 0) {
                                                            return (
                                                                <span style={{ 
                                                                    background: 'rgba(16, 185, 129, 0.15)', 
                                                                    color: '#10b981', 
                                                                    padding: '4px 10px', 
                                                                    borderRadius: '20px', 
                                                                    fontSize: '0.75rem', 
                                                                    fontWeight: 800,
                                                                    border: '1px solid rgba(16, 185, 129, 0.2)',
                                                                    whiteSpace: 'nowrap'
                                                                }}>
                                                                    {winCount.toLocaleString('de-DE')} Gewinner
                                                                </span>
                                                            );
                                                        }
                                                        return <span style={{ color: 'var(--text-muted)' }}>–</span>;
                                                    })()}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            <main className="lotto-content-grid">
                <div className="play-section animate-in" style={{ animationDelay: '0.2s' }}>
                    <div className="glass-card" style={{ padding: '32px' }}>
                        <div className="lotto-card-header">
                            <div>
                                <h2 style={{ margin: 0 }}>Zahlen wählen</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '4px 0 0 0' }}>Wähle 6 Zahlen aus dem Feld</p>
                            </div>
                            <div className="action-buttons">
                                <button className="btn-ghost" onClick={() => setSelectedNumbers([])}>
                                    <Trash2 size={16}/> Reset
                                </button>
                                <button className="btn-ghost" onClick={quickTipp} style={{ background: 'rgba(255,255,255,0.05)' }}>
                                    <RefreshCw size={16}/> Zufall
                                </button>
                            </div>
                        </div>

                        <div className="number-grid">
                            {numberGrid}
                        </div>

                        <div className="superzahl-section">
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Bonus: Wähle eine Superzahl (0-9)</span>
                            <div className="superzahl-grid">
                                {superNumberGrid}
                            </div>
                        </div>

                        <button 
                            className="btn-primary" 
                            style={{ 
                                width: '100%', 
                                marginTop: '32px', 
                                height: '56px', 
                                fontSize: '1.1rem',
                                opacity: isCutoffActiveMemo ? 0.5 : 1,
                                cursor: isCutoffActiveMemo ? 'not-allowed' : 'pointer'
                            }}
                            onClick={addToCart}
                            disabled={selectedNumbers.length < 6 || isCutoffActiveMemo}
                        >
                            <Ticket size={22}/> {isCutoffActiveMemo ? 'Annahme gesperrt' : (willBuyForTomorrowMemo ? 'Für morgen einreihen' : 'Ticket zum Warenkorb')} ({(lottoData.config?.ticketPrice || 100) / 100} KC)
                        </button>
                    </div>

                    <div className="glass-card" style={{ marginTop: '24px', padding: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--accent-primary)' }}>
                            <Zap size={20}/>
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Bulk Quick-Tipp</h3>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                            Füge sofort mehrere zufällig generierte Tickets zu deinem Warenkorb hinzu.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <button className="btn-secondary" onClick={() => addBulkRandom(5)} disabled={isCutoffActiveMemo} style={{ height: '48px', opacity: isCutoffActiveMemo ? 0.5 : 1 }}>+5 {willBuyForTomorrowMemo ? 'morgen' : 'heute'}</button>
                            <button className="btn-secondary" onClick={() => addBulkRandom(10)} disabled={isCutoffActiveMemo} style={{ height: '48px', opacity: isCutoffActiveMemo ? 0.5 : 1 }}>+10 {willBuyForTomorrowMemo ? 'morgen' : 'heute'}</button>
                            <button className="btn-secondary" onClick={() => addBulkRandom(25)} disabled={isCutoffActiveMemo} style={{ height: '48px', opacity: isCutoffActiveMemo ? 0.5 : 1 }}>+25 {willBuyForTomorrowMemo ? 'morgen' : 'heute'}</button>
                            <button className="btn-secondary" onClick={() => addBulkRandom(50)} disabled={isCutoffActiveMemo} style={{ height: '48px', opacity: isCutoffActiveMemo ? 0.5 : 1 }}>+50 {willBuyForTomorrowMemo ? 'morgen' : 'heute'}</button>
                        </div>
                    </div>

                    <div className="glass-card">
                        <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <History size={22} className="text-muted" />
                            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Deine Gewinn-Historie</h2>
                        </div>
                        {lottoData.userHistory.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '60px 40px', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.1 }}>📜</div>
                                <p>Bisher wurden keine Tickets für dich in der Datenbank gefunden.</p>
                            </div>
                        ) : (
                            <div className="history-list">
                                {(() => {
                                    // lottoData.userHistory is an array of Draw Groups: { drawDate, drawNumbers, tickets: [] }
                                    const pending = lottoData.userHistory.filter(d => d.status === 'pending' || !d.drawNumbers);
                                    const completed = lottoData.userHistory.filter(d => d.status !== 'pending' && d.drawNumbers);
                                    
                                    return (
                                        <>
                                            {pending.length > 0 && (
                                                <div style={{ padding: '20px 32px 10px', background: 'rgba(245, 158, 11, 0.03)', borderBottom: '1px solid var(--border-color)' }}>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase' }}>Ausstehende Tickets</span>
                                                </div>
                                            )}
                                            {pending.map((group) => {
                                                const isExpanded = expandedGroups[group.drawDate] !== false; // Default to expanded for pending
                                                return (
                                                    <div key={group.drawDate} className="draw-history-item" style={{ borderLeft: '4px solid #f59e0b', width: 'auto', minWidth: '350px' }}>
                                                        <div 
                                                            style={{ display: 'flex', justifyContent: 'space-between', marginBottom: isExpanded ? '16px' : '0', alignItems: 'center', gap: '20px', cursor: 'pointer' }}
                                                            onClick={() => toggleGroup(group.drawDate)}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                                                                {isExpanded ? <ChevronDown size={16} className="text-muted" /> : <ChevronRight size={16} className="text-muted" />}
                                                                <Calendar size={14} className="text-muted" />
                                                                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Ziehung am {parseDrawDate(group.drawDate)?.toLocaleDateString('de-DE') || group.drawDate}</span>
                                                            </div>
                                                            <div style={{ 
                                                                color: '#f59e0b', 
                                                                fontWeight: 800, 
                                                                background: 'rgba(245, 158, 11, 0.1)',
                                                                padding: '4px 12px',
                                                                borderRadius: '20px',
                                                                fontSize: '0.85rem',
                                                                whiteSpace: 'nowrap'
                                                            }}>
                                                                {group.tickets.length} Ticket{group.tickets.length > 1 ? 's' : ''} ausstehend
                                                            </div>
                                                        </div>
                                                        {isExpanded && (
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                                {group.tickets.map((ticket, idx) => (
                                                                    <div key={ticket.id} style={{ 
                                                                        display: 'flex', 
                                                                        alignItems: 'center',
                                                                        gap: '6px', 
                                                                        background: 'rgba(255,255,255,0.03)', 
                                                                        border: '1px solid var(--border-color)',
                                                                        borderRadius: '10px', 
                                                                        padding: '8px 12px',
                                                                        flex: '0 0 auto'
                                                                    }}>
                                                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', minWidth: '16px' }}>
                                                                                #{idx + 1}
                                                                            </span>
                                                                            {safeParseNumbers(ticket.numbers).map((n, i) => <span key={i} className="ball-mini">{n}</span>)}
                                                                            <span className="ball-mini super">{ticket.superzahl}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}

                                            {completed.length > 0 && (
                                                <div style={{ padding: '30px 32px 10px', borderBottom: '1px solid var(--border-color)' }}>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Abgeschlossene Ziehungen</span>
                                                </div>
                                            )}
                                            {completed.map((group) => {
                                                const isExpanded = !!expandedGroups[group.drawDate]; // Default to collapsed for completed
                                                const groupWinTotal = group.tickets.reduce((sum, t) => sum + (t.winAmount ?? 0), 0);
                                                
                                                return (
                                                    <div key={group.drawDate} className="draw-history-item" style={{ width: 'auto', minWidth: '450px' }}>
                                                        <div 
                                                            style={{ display: 'flex', justifyContent: 'space-between', marginBottom: isExpanded ? '20px' : '0', alignItems: 'center', gap: '40px', cursor: 'pointer' }}
                                                            onClick={() => toggleGroup(group.drawDate)}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', whiteSpace: 'nowrap' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    {isExpanded ? <ChevronDown size={16} className="text-muted" /> : <ChevronRight size={16} className="text-muted" />}
                                                                    <Calendar size={14} className="text-muted" />
                                                                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Ziehung am {parseDrawDate(group.drawDate)?.toLocaleDateString('de-DE') || group.drawDate}</span>
                                                                </div>
                                                                {groupWinTotal > 0 && (
                                                                    <div style={{ 
                                                                        background: 'rgba(16, 185, 129, 0.15)', 
                                                                        color: '#10b981', 
                                                                        padding: '2px 10px', 
                                                                        borderRadius: '20px', 
                                                                        fontSize: '0.75rem', 
                                                                        fontWeight: 800,
                                                                        border: '1px solid rgba(16, 185, 129, 0.2)',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px',
                                                                        animation: 'fadeInIn 0.3s ease-out'
                                                                    }}>
                                                                        <Trophy size={12} />
                                                                        {(groupWinTotal / 100).toLocaleString('de-DE')} KC gewonnen
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                                                {group.drawNumbers && safeParseNumbers(group.drawNumbers).map((n, i) => (
                                                                    <span key={i} className="ball-mini" style={{ background: 'var(--accent-primary)', width: '18px', height: '18px', fontSize: '0.6rem' }}>{n}</span>
                                                                ))}
                                                                {group.drawSuperzahl !== undefined && (
                                                                    <span className="ball-mini super" style={{ width: '18px', height: '18px', fontSize: '0.6rem' }}>{group.drawSuperzahl}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {isExpanded && (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px' }}>
                                                                {(() => {
                                                                    const winners = group.tickets.filter(t => (t.winAmount ?? 0) > 0 || (t.winClass ?? 0) > 0);
                                                                    const nearMisses = group.tickets.filter(t => ((t.winAmount ?? 0) === 0 && (t.winClass ?? 0) === 0) && (t.matchCount ?? 0) >= 1);
                                                                    const lose = group.tickets.filter(t => ((t.winAmount ?? 0) === 0 && (t.winClass ?? 0) === 0) && (t.matchCount ?? 0) === 0);
                                                                    
                                                                    // Helper to get effective expanded state
                                                                    const isSubExpanded = (type) => {
                                                                        const key = `${group.drawDate}-${type}`;
                                                                        const manual = expandedSubCategories[key];
                                                                        if (manual !== undefined) return manual;
                                                                        // Defaults
                                                                        if (type === 'winners') return true;
                                                                        if (type === 'near') return winners.length === 0;
                                                                        return false; // lose
                                                                    };

                                                                    return (
                                                                        <>
                                                                            {winners.length > 0 && (
                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                                                    <div 
                                                                                        onClick={() => toggleSubCategory(group.drawDate, 'winners')}
                                                                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', width: 'fit-content' }}
                                                                                    >
                                                                                        {isSubExpanded('winners') ? <ChevronDown size={14} color="#10b981" /> : <ChevronRight size={14} color="#10b981" />}
                                                                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🏆 Gewinnerlose</span>
                                                                                        <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '1px 8px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 800 }}>{winners.length} Gewinner</span>
                                                                                    </div>
                                                                                    {isSubExpanded('winners') && (
                                                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', animation: 'fadeInIn 0.2s ease-out' }}>
                                                                                            {winners.map(ticket => renderHistoryTicket(ticket, group, 'winner'))}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                            {nearMisses.length > 0 && (
                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                                                    <div 
                                                                                        onClick={() => toggleSubCategory(group.drawDate, 'near')}
                                                                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', width: 'fit-content' }}
                                                                                    >
                                                                                        {isSubExpanded('near') ? <ChevronDown size={14} color="#f59e0b" /> : <ChevronRight size={14} color="#f59e0b" />}
                                                                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🎯 Knapp daneben</span>
                                                                                        <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '1px 8px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 800 }}>{nearMisses.length} knapp</span>
                                                                                    </div>
                                                                                    {isSubExpanded('near') && (
                                                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', animation: 'fadeInIn 0.2s ease-out' }}>
                                                                                            {nearMisses.map(ticket => renderHistoryTicket(ticket, group, 'near'))}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                            {lose.length > 0 && (
                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                                                    <div 
                                                                                        onClick={() => toggleSubCategory(group.drawDate, 'lose')}
                                                                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', width: 'fit-content' }}
                                                                                    >
                                                                                        {isSubExpanded('lose') ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
                                                                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>💀 Nieten</span>
                                                                                        <span style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', padding: '1px 8px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 800 }}>{lose.length} Nieten</span>
                                                                                    </div>
                                                                                    {isSubExpanded('lose') && (
                                                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', animation: 'fadeInIn 0.2s ease-out' }}>
                                                                                            {lose.map(ticket => renderHistoryTicket(ticket, group, 'lose'))}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </>
                                                                    );
                                                                })()}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </div>

                <div className="sidebar-column animate-in" style={{ animationDelay: '0.3s' }}>
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', fontSize: '1rem' }}>
                            <ShoppingBag size={18} /> Warenkorb ({cart.length})
                        </h3>
                        {cart.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(0,0,0,0.1)', borderRadius: '16px' }}>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Dein Warenkorb ist leer.</p>
                            </div>
                        ) : (
                            <>
                                <div className="cart-items-list thin-scrollbar">
                                    {cart.map((item) => (
                                        <div key={item.id} className="cart-item">
                                            <div className="cart-numbers">
                                                {item.numbers.map((n, i) => <span key={i} className="ball-mini">{n}</span>)}
                                                <span className="ball-mini super">{item.superzahl}</span>
                                            </div>
                                            <button onClick={() => removeCartItem(item.id)} className="btn-remove">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
                                    <div className="flex-between" style={{ marginBottom: '16px' }}>
                                        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Gesamtpreis:</span>
                                        <span style={{ fontWeight: 800, color: '#f59e0b', fontSize: '1.3rem' }}>
                                            {(cart.length * (lottoData.config?.ticketPrice || 100) / 100).toLocaleString('de-DE', { minimumFractionDigits: 1 })} KC
                                        </span>
                                    </div>
                                    <button 
                                        className="btn-primary" 
                                        style={{ width: '100%', padding: '14px' }}
                                        onClick={buyTickets}
                                        disabled={isPurchasing}
                                    >
                                        {isPurchasing ? 'Wird verarbeitet...' : 'Tickets jetzt kaufen'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="glass-card" style={{ padding: '24px' }}>
                        <h3 style={{ marginBottom: '20px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <TrendingUp size={18} /> Letzte Ziehung
                        </h3>
                        {lottoData.lastDraw ? (
                            <div>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', justifyContent: 'center' }}>
                                    {safeParseNumbers(lottoData.lastDraw.numbers).map((n, i) => (
                                        <div key={i} className="super-num selected">{n}</div>
                                    ))}
                                    <div className="super-num" style={{ background: '#ef4444', color: 'white', borderColor: 'transparent' }}>
                                        {lottoData.lastDraw.superzahl || lottoData.lastDraw.super_number}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div>Gewinnausschüttung: <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{((lottoData.lastDraw?.drawTotalPayout ?? lottoData.lastDraw?.total_payout ?? 0) / 100).toLocaleString('de-DE')} KC</span></div>
                                    {(() => {
                                        const lastDrawGroup = lottoData.userHistory.find(g => g.drawDate === lottoData.lastDraw?.drawDate);
                                        if (lastDrawGroup) {
                                            const myWin = lastDrawGroup.tickets.reduce((sum, t) => sum + (t.winAmount ?? 0), 0);
                                            return (
                                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                                                    Dein Gewinn: {myWin > 0 ? (
                                                        <span style={{ color: '#10b981', fontWeight: 800 }}>{(myWin / 100).toLocaleString('de-DE')} KC</span>
                                                    ) : (
                                                        <span style={{ color: 'var(--text-muted)' }}>– (Niete)</span>
                                                    )}
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                            </div>
                        ) : (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', margin: 0 }}>Noch keine Ziehungsdaten vorhanden.</p>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default LottoImitat;
