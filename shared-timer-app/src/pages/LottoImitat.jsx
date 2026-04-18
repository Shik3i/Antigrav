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

    // Load data on mount
    useEffect(() => {
        loadLottoData();
    }, [loadLottoData]);

    // Countdown logic
    useEffect(() => {
        const updateCountdown = () => {
            if (!lottoData.today) return;
            // Target is 16:00 UTC
            const targetStr = lottoData.today.split('T')[0] + 'T16:00:00Z';
            const drawTime = new Date(targetStr);
            const now = new Date();
            let diff = drawTime - now;

            if (diff <= 0) {
                // If draw time for today passed, target tomorrow
                const tomorrow = new Date(drawTime);
                tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
                diff = tomorrow - now;
            }

            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);
            setCountdown(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        };

        const timer = setInterval(updateCountdown, 1000);
        updateCountdown();
        return () => clearInterval(timer);
    }, [lottoData.today]);

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
        const currentTotal = cart.length + lottoData.userTicketsToday;
        const maxAllowed = lottoData.config?.maxTicketsPerDay || 100;
        
        if (currentTotal >= maxAllowed) {
            showToast('Tägliches Ticket-Limit bereits erreicht!', 'error');
            return;
        }

        const actualToAdd = Math.min(count, maxAllowed - currentTotal);
        if (actualToAdd < count) {
            showToast(`Nur ${actualToAdd} Tickets hinzugefügt (Limit erreicht).`, 'info');
        }

        // Create a set of existing combinations for duplicate checking
        // Format: "1,2,3,4,5,6_SZ"
        const existingCombis = new Set();
        // Add purchased tickets to set
        lottoData.userHistory.forEach(draw => {
             // We only care about tickets for the CURRENT draw, but for safety 
             // we could check the draw_date if we had it more clearly.
             // Looking at loadLottoData, it fetches history.
             // Let's check draw_date.
             if (draw.draw_date === lottoData.today) {
                const nums = safeParseNumbers(draw.numbers).sort((a,b) => a-b).join(',');
                existingCombis.add(`${nums}_${draw.super_number}`);
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
        if (cart.length + lottoData.userTicketsToday >= (lottoData.config?.maxTicketsPerDay || 100)) {
            showToast('Tägliches Ticket-Limit erreicht!', 'error');
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

        // Check duplicates in already purchased (if we have draw_date info)
        const isAlreadyPurchased = lottoData.userHistory.some(draw => {
            if (draw.draw_date === lottoData.today) {
                const s = safeParseNumbers(draw.numbers).sort((a,b) => a-b).join(',');
                return `${s}_${draw.super_number}` === selectionKey;
            }
            return false;
        });

        if (isAlreadyPurchased) {
            showToast('Dieses Ticket hast du für heute bereits gekauft!', 'error');
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
    }, [selectedNumbers, selectedSuper, cart, lottoData.userTicketsToday, lottoData.today, lottoData.userHistory, lottoData.config?.maxTicketsPerDay, showToast]);

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
                    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
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
            `}</style>

            <header className="lotto-header animate-in">
                <div className="lotto-title">
                    <h1>Lotto Imitat</h1>
                    <p>Wähle 6 aus 49 Zahlen und knacke den täglichen Jackpot.</p>
                </div>
                <div className="glass-card countdown-box">
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Nächste Ziehung</span>
                        <span style={{ fontSize: '1.4rem', fontWeight: 900, fontFamily: 'monospace', color: '#f59e0b' }}>{countdown}</span>
                    </div>
                    <Clock size={28} color="#f59e0b" />
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
                        <span className="stat-label">Lose im Umlauf</span>
                    </div>
                </div>
                <div className="glass-card stat-card">
                    <div className="stat-icon"><CheckCircle2 size={24}/></div>
                    <div className="stat-info">
                        <span className="stat-value">{lottoData.userTicketsToday} / {lottoData.config?.maxTicketsPerDay || 100}</span>
                        <span className="stat-label">Tickets heute</span>
                    </div>
                </div>
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
                            style={{ width: '100%', marginTop: '32px', height: '56px', fontSize: '1.1rem' }}
                            onClick={addToCart}
                            disabled={selectedNumbers.length < 6}
                        >
                            <Ticket size={22}/> Ticket zum Warenkorb ({(lottoData.config?.ticketPrice || 100) / 100} KC)
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
                            <button className="btn-secondary" onClick={() => addBulkRandom(5)} style={{ height: '48px' }}>+5 Zufall</button>
                            <button className="btn-secondary" onClick={() => addBulkRandom(10)} style={{ height: '48px' }}>+10 Zufall</button>
                            <button className="btn-secondary" onClick={() => addBulkRandom(25)} style={{ height: '48px' }}>+25 Zufall</button>
                            <button className="btn-secondary" onClick={() => addBulkRandom(50)} style={{ height: '48px' }}>+50 Zufall</button>
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
                                {lottoData.userHistory.map((draw) => (
                                    <div key={draw.draw_date} className="draw-history-item">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Calendar size={14} className="text-muted" />
                                                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{new Date(draw.draw_date).toLocaleDateString('de-DE')}</span>
                                            </div>
                                            <div style={{ 
                                                color: draw.payout > 0 ? '#10b981' : 'var(--text-muted)', 
                                                fontWeight: 800, 
                                                background: draw.payout > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.03)',
                                                padding: '4px 12px',
                                                borderRadius: '20px',
                                                fontSize: '0.85rem'
                                            }}>
                                                {draw.payout > 0 ? `+${(draw.payout / 100).toLocaleString('de-DE')} KC` : 'Niete'}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            {safeParseNumbers(draw.numbers).map((n, i) => <span key={i} className="ball-mini">{n}</span>)}
                                            <span className="ball-mini super">{draw.super_number}</span>
                                        </div>
                                    </div>
                                ))}
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
                                <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px' }}>
                                    Gewinnausschüttung: <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{(lottoData.lastDraw.total_payout / 100).toLocaleString()} KC</span>
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
