import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
    Trophy, 
    Zap, 
    Info, 
    ChevronDown, 
    ChevronUp, 
    ShoppingBag, 
    Sparkles,
    Volume2,
    VolumeX,
    Star
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Avatar from '../components/Avatar';
import Scratchcard from '../components/Scratchcard';
import { playPurchaseSound, playCoinJingle } from '../utils/soundGenerator';
import { useAuth } from '../context/AuthContext';
import { applyRechartsStyleSheetFix } from '../utils/rechartsFix';

applyRechartsStyleSheetFix();

const ScratchcardShop = () => {
    const { token, isGuest, user, setUser } = useAuth();
    const [packs, setPacks] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState(false);
    const [activeCard, setActiveCard] = useState(null);
    const [showGame, setShowGame] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [stats, setStats] = useState({ total_sold: 0, total_won: 0, latestWinners: [], topWinners: [], leaderboard: [] });
    const [chartData, setChartData] = useState([]);
    const [showInfo, setShowInfo] = useState(false);
    const [isMuted, setIsMuted] = useState(localStorage.getItem('scratch_muted') === 'true');
    const [revealedFields, setRevealedFields] = useState(new Array(9).fill(false));
    const [allRevealed, setAllRevealed] = useState(false);
    const [winningLines, setWinningLines] = useState([]); // Array of winning lines: [{line: [0,1,2], code: 'KC'}]
    const [infoModal, setInfoModal] = useState(null); // stores the pack object for the modal
    const [revealAll, setRevealAll] = useState(false);
    const [showWinners, setShowWinners] = useState(false);
    const [selectedWinner, setSelectedWinner] = useState(null);
    const [winnersTab, setWinnersTab] = useState('latest'); // 'latest' or 'top'
    const isClaiming = useRef(false);

    const handleToggleMute = () => {
        const newVal = !isMuted;
        setIsMuted(newVal);
        localStorage.setItem('scratch_muted', newVal.toString());
    };

    useEffect(() => {
        fetchInitialData();
    }, [token, isGuest]);

    const fetchInitialData = async () => {
        try {
            const [configRes, teamsRes, statsRes, chartRes] = await Promise.all([
                axios.get('/api/scratchcards/config', { headers: token ? { 'Authorization': `Bearer ${token}` } : {} }),
                axios.get('/api/esports/teams'),
                axios.get('/api/scratchcards/stats'),
                axios.get('/api/scratchcards/chart')
            ]);
            
            setPacks(configRes.data);
            setTeams(teamsRes.data);
            setStats(statsRes.data);
            setChartData(chartRes.data);

            if (!isGuest && token) {
                try {
                    const meRes = await axios.get('/api/auth/me', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    setUser(prev => ({ ...prev, koala_balance: meRes.data.koala_balance }));
                } catch (err) {
                    console.log('Error fetching user balance:', err);
                }
            }
        } catch (err) {
            console.error('Failed to fetch scratchcard data:', err);
            setError('Failed to load shop data.');
        } finally {
            setLoading(false);
        }
    };

    const handleBuy = async (packId) => {
        if (isGuest) {
            setError('Bitte logge dich ein, um Rubbellose zu kaufen.');
            return;
        }
        setPurchasing(true);
        setError('');
        setRevealAll(false);
        try {
            if (!isMuted) playPurchaseSound();
            const res = await axios.post('/api/scratchcards/buy', { packId }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const pack = packs.find(p => p.id === packId);
            setActiveCard({ ...res.data, pack });
            setShowGame(true);
            setResult(null);
            isClaiming.current = false;
            setRevealedFields(new Array(9).fill(false));
            setAllRevealed(false);
            setWinningLines([]);
            
            // Update local state for daily count immediately
            setPacks(prevPacks => prevPacks.map(p => 
                p.id === packId ? { ...p, userDailyCount: (p.userDailyCount || 0) + 1 } : p
            ));

            // Refresh stats and user balance
            fetchInitialData();
        } catch (err) {
            setError(err.response?.data?.error || 'Purchase failed.');
        } finally {
            setPurchasing(false);
        }
    };

    const handleScratchComplete = async () => {
        if (isClaiming.current) return;
        isClaiming.current = true;
        
        try {
            // Safe extraction: handle both primitive ID and nested object if format varies
            const cardId = typeof activeCard.id === 'object' ? activeCard.id.id : activeCard.id;
            if (!cardId) throw new Error('Invalid Card ID');

            console.log('[Shop] Claiming card ID:', cardId);
            const res = await axios.post('/api/scratchcards/claim', { id: cardId }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log('[Shop] Claim result:', res.data);
            setResult(res.data);
            
            if (res.data.winAmount > 0) {
                if (!isMuted) playCoinJingle();
                // We use the winningLines provided by the backend to ensure consistency
                if (res.data.winningLines) {
                    setWinningLines(res.data.winningLines);
                } else {
                    // Fallback to local calculation if backend didn't provide it
                    setWinningLines(findWinningLines(activeCard.grid));
                }
            }
            
            const meRes = await axios.get('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setUser(prev => ({ ...prev, koala_balance: meRes.data.koala_balance }));
        } catch (err) {
            console.error('Claim failed:', err);
            setError('Verarbeitung des Gewinns fehlgeschlagen. Bitte versuche es erneut oder kontaktiere den Support.');
            isClaiming.current = false;
            // If claim fails, we don't set result, but we show the error so the user isn't stuck.
        }
    };

    const findTeamImage = (code) => {
        const team = teams.find(t => t.code === code);
        if (!team || !team.image) return null;
        return team.image.replace('http://', 'https://');
    };

    const findWinningLines = (grid) => {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
            [0, 4, 8], [2, 4, 6]             // diags
        ];
        const wins = [];
        for (const line of lines) {
            const [a, b, c] = line;
            if (grid[a] && grid[a] === grid[b] && grid[a] === grid[c]) {
                wins.push({ line, code: grid[a] });
            }
        }
        return wins;
    };

    const handleFieldReveal = (idx) => {
        setRevealedFields(prev => {
            if (prev[idx]) return prev;
            const next = [...prev];
            next[idx] = true;
            
            const count = next.filter(v => v).length;
            if (count === 9) {
                setAllRevealed(true);
            }
            return next;
        });
    };

    if (loading) {
        return (
            <div style={{ padding: '64px', textAlign: 'center', width: '100%', color: 'var(--accent-primary)' }}>
                <div className="flex-center" style={{ marginBottom: '16px' }}>
                    <div style={{ width: '40px', height: '40px', border: '4px solid var(--border-color)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                </div>
                <h3>Lade Scratchcard Shop...</h3>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    // Styles for our layout
    const styles = {
        container: {
            width: '100%',
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '40px 24px',
            flex: 1
            // Removed overflowY: auto to fix double scrollbar bug - page scrolls naturally
        },
        header: {
            marginBottom: '32px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '24px',
            position: 'relative',
            zIndex: 100 // Ensure header content stays above the info banner
        },
        titleSection: {
            display: 'flex',
            flexDirection: 'column'
        },
        title: {
            fontSize: '2rem',
            margin: '0 0 8px 0',
            background: 'var(--accent-gradient)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.5px'
        },
        subtitle: {
            color: 'var(--text-muted)',
            fontSize: '0.95rem'
        },
        balanceWidget: {
            padding: '12px 20px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px'
        },
        statsContainer: {
            display: 'flex',
            gap: '24px',
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '10px 24px',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            position: 'relative',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            zIndex: 20
        },
        statItem: {
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
        },
        statLabel: {
            fontSize: '0.65rem',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontWeight: 700,
            marginBottom: '2px'
        },
        statValue: {
            fontSize: '1.25rem',
            fontWeight: 800,
            color: 'var(--text-main)',
            lineHeight: 1
        },
        grid: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: '48px'
        },
        card: {
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            cursor: 'default',
            minHeight: '200px',
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '16px'
        },
        cardComingSoon: {
            filter: 'grayscale(1)',
            opacity: 0.5,
            pointerEvents: 'none'
        },
        prizeBadge: {
            fontSize: '0.7rem',
            fontWeight: 800,
            color: 'var(--accent-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: '12px',
            display: 'inline-block',
            background: 'rgba(59, 130, 246, 0.1)',
            padding: '2px 8px',
            borderRadius: '12px'
        },
        cardTitle: {
            fontSize: '1.2rem',
            marginBottom: '6px',
            color: 'var(--text-main)',
            fontWeight: 700
        },
        badgeRegional: {
            color: '#60a5fa',
            background: 'rgba(59, 130, 246, 0.15)'
        },
        badgeInternational: {
            color: '#fcd34d',
            background: 'rgba(251, 191, 36, 0.2)'
        },
        winDisplay: {
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            marginBottom: '16px'
        },
        priceSection: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            paddingTop: '16px',
            borderTop: '1px solid rgba(255,255,255,0.05)'
        },
        priceLabel: {
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            fontWeight: 700,
            marginBottom: '2px'
        },
        priceValue: {
            fontSize: '1.1rem',
            fontWeight: 800,
            color: 'var(--text-main)'
        },
        buyBtn: {
            padding: '6px 12px',
            fontSize: '0.8rem',
            width: 'auto',
            borderRadius: '8px'
        },
        infoSection: {
            marginTop: '60px',
            maxWidth: '800px',
            margin: '60px auto 40px auto'
        },
        infoContent: {
            padding: '24px',
            lineHeight: '1.6',
            color: 'var(--text-muted)',
            fontSize: '0.9rem'
        },
        gameOverlay: {
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.9)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            backdropFilter: 'blur(20px)'
        },
        scratchContainer: {
            width: '300px',
            height: '300px',
            background: '#151b23',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '6px solid #0d0f12',
            boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
            position: 'relative',
            margin: '0 auto'
        },
        scratchGrid: {
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridTemplateRows: 'repeat(3, 1fr)',
            width: '100%',
            height: '100%',
            padding: '0',
            gap: '0',
            background: '#0a0d11'
        },
        scratchCell: {
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(255,255,255,0.05)',
            padding: '8px'
        },
        teamLogo: {
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            maxHeight: '40px', // Fixed giant logo issue during reveal
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))'
        },
        modalOverlay: {
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            backdropFilter: 'blur(10px)'
        },
        modalContent: {
            background: '#1a202c',
            width: '100%',
            maxWidth: '450px',
            borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            maxHeight: '90vh'
        }
    };

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <div style={styles.titleSection}>
                    <h1 style={styles.title}>SCRATCH & WIN</h1>
                    <p style={styles.subtitle}>Rubbel dich zum Sieg! Deine Lieblingslogos bringen dir KoalaCoins.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0,0,0,0.3)', padding: '6px 14px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <button 
                            onClick={handleToggleMute}
                            style={{ background: 'none', border: 'none', color: isMuted ? '#ef4444' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            title={isMuted ? "Unmute" : "Mute Sound"}
                        >
                            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                        </button>
                    </div>

                    <div 
                        style={styles.statsContainer}
                        onClick={() => {
                            setShowWinners(!showWinners);
                            if (showWinners) setSelectedWinner(null);
                        }}
                    >
                        <div style={styles.statItem}>
                            <span style={styles.statLabel}>LOSE VERKAUFT</span>
                            <span style={styles.statValue}>{stats.total_sold ? Number(stats.total_sold).toLocaleString() : 0}</span>
                        </div>
                        <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', height: '16px', alignSelf: 'center' }}></div>
                        <div style={styles.statItem}>
                            <span style={styles.statLabel}>GEWONNENE LOSE</span>
                            <span style={{ ...styles.statValue, color: 'var(--accent-primary)' }}>{stats.total_wins ? Number(stats.total_wins).toLocaleString() : 0}</span>
                        </div>
                        <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', height: '16px', alignSelf: 'center' }}></div>
                        <div style={styles.statItem}>
                            <span style={styles.statLabel}>GEWINNAUSSCHÜTTUNG</span>
                            <span style={{ ...styles.statValue, color: '#fbbf24' }}>{stats.total_won ? (stats.total_won / 100).toLocaleString('de-DE') : '0'} KC</span>
                        </div>

                        {/* Winners Popover */}
                        {showWinners && stats.latestWinners && stats.latestWinners.length > 0 && (
                            <div 
                                style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 12px)',
                                    right: '0',
                                    width: '320px',
                                    background: '#1a1f26',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: '20px',
                                    boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
                                    zIndex: 2100, // High z-index to stay above info banner
                                    padding: '16px',
                                    pointerEvents: 'auto',
                                    animation: 'fadeInScale 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                    filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <button 
                                            onClick={() => { setWinnersTab('latest'); setSelectedWinner(null); }}
                                            style={{ 
                                                background: 'none', 
                                                border: 'none', 
                                                color: winnersTab === 'latest' ? 'var(--accent-primary)' : 'var(--text-muted)', 
                                                fontSize: '0.75rem', 
                                                fontWeight: 700,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em',
                                                cursor: 'pointer',
                                                padding: '4px 0',
                                                borderBottom: winnersTab === 'latest' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >Neueste</button>
                                        <button 
                                            onClick={() => { setWinnersTab('top'); setSelectedWinner(null); }}
                                            style={{ 
                                                background: 'none', 
                                                border: 'none', 
                                                color: winnersTab === 'top' ? '#f59e0b' : 'var(--text-muted)', 
                                                fontSize: '0.75rem', 
                                                fontWeight: 700,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em',
                                                cursor: 'pointer',
                                                padding: '4px 0',
                                                borderBottom: winnersTab === 'top' ? '2px solid #f59e0b' : '2px solid transparent',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >Top Gewinne</button>
                                        <button 
                                            onClick={() => { setWinnersTab('leaders'); setSelectedWinner(null); }}
                                            style={{ 
                                                background: 'none', 
                                                border: 'none', 
                                                color: winnersTab === 'leaders' ? '#10b981' : 'var(--text-muted)', 
                                                fontSize: '0.75rem', 
                                                fontWeight: 700,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em',
                                                cursor: 'pointer',
                                                padding: '4px 0',
                                                borderBottom: winnersTab === 'leaders' ? '2px solid #10b981' : '2px solid transparent',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >Leaderboard</button>
                                    </div>
                                    <button 
                                        onClick={() => { setShowWinners(false); setSelectedWinner(null); }}
                                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem' }}
                                    >✕</button>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '450px', overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
                                    {(winnersTab === 'latest' ? stats.latestWinners : (winnersTab === 'top' ? stats.topWinners : stats.leaderboard)).map((w, idx) => {
                                        const isSelected = selectedWinner?.id === w.id || (selectedWinner?.username === w.username && selectedWinner?.createdAt === w.createdAt);
                                        const winVal = w.winAmount || w.totalWin;
                                        
                                        return (
                                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <div 
                                                    onClick={() => winnersTab !== 'leaders' && setSelectedWinner(isSelected ? null : w)}
                                                    style={{ 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        gap: '10px', 
                                                        padding: '10px', 
                                                        background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.03)', 
                                                        borderRadius: '12px',
                                                        cursor: winnersTab !== 'leaders' ? 'pointer' : 'default',
                                                        transition: 'all 0.2s ease',
                                                        border: isSelected ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent'
                                                    }}
                                                >
                                                    <Avatar user={{ username: w.username, preferences: w.preferences }} size={32} />
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.username}</div>
                                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                                            {winnersTab === 'leaders' ? `${w.ticketsWon} Lose gewonnen` : `${w.packName || 'Scratchcard'} • ${new Date(w.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                        <div style={{ fontWeight: 800, color: winnersTab === 'latest' ? '#f59e0b' : winnersTab === 'top' ? '#f59e0b' : '#10b981', fontSize: '0.9rem' }}>
                                                            +{(winVal / 100).toLocaleString('de-DE')}
                                                        </div>
                                                        {winnersTab !== 'leaders' && <div style={{ fontSize: '0.6rem', color: 'var(--accent-primary)', opacity: 0.8 }}>DETAILS</div>}
                                                    </div>
                                                </div>

                                                {/* Archived Card View */}
                                                {isSelected && winnersTab !== 'leaders' && w.grid && Array.isArray(w.grid) && (
                                                    <div style={{ 
                                                        padding: '12px', 
                                                        background: 'rgba(0,0,0,0.3)', 
                                                        borderRadius: '12px', 
                                                        border: '1px solid rgba(255,255,255,0.05)',
                                                        animation: 'fadeIn 0.3s ease'
                                                    }}>
                                                        <div style={{ 
                                                            display: 'grid', 
                                                            gridTemplateColumns: 'repeat(3, 1fr)', 
                                                            gap: '4px',
                                                            width: '120px',
                                                            margin: '0 auto'
                                                        }}>
                                                            {w.grid.map((code, gIdx) => {
                                                                const winLinesForCard = findWinningLines(w.grid);
                                                                const isWinPart = winLinesForCard.some(wl => wl.line.includes(gIdx));
                                                                
                                                                return (
                                                                    <div key={gIdx} style={{ 
                                                                        aspectRatio: '1', 
                                                                        background: 'rgba(255,255,255,0.05)', 
                                                                        borderRadius: '4px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        overflow: 'hidden',
                                                                        border: isWinPart ? '1px solid #f59e0b' : 'none'
                                                                    }}>
                                                                        <img src={findTeamImage(code)} alt={code} width="40" height="40" loading="lazy" style={{ width: '80%', height: '80%', objectFit: 'contain', opacity: isWinPart ? 1 : 0.4 }} />
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                                            Gewinn-Raster Archiv
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>


            {/* Shop Categories */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '48px', padding: '0 40px 60px 40px' }}>

                {/* Classic / Blue Section */}
                <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', borderLeft: '4px solid #3b82f6', paddingLeft: '16px' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(59, 130, 246, 0.15)' }}>
                            <ShoppingBag size={24} color="#3b82f6" />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, color: '#f8fafc', letterSpacing: '0.02em' }}>CLASSIC TICKETS</h2>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#3b82f6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Feste Auszahlungen • 100% Sicher</p>
                        </div>
                    </div>

                    <div style={styles.grid}>
                        {[...packs.filter(p => !p.is_weighted)].sort((a, b) => (b.is_special ? 1 : 0) - (a.is_special ? 1 : 0)).map((pack) => {
                            const isSpecial = !!pack.is_special;
                            return (
                            <div key={pack.id} className="glass-card hover-glow" style={{ ...styles.card, border: isSpecial ? '1px solid rgba(236, 72, 153, 0.3)' : '1px solid rgba(59, 130, 246, 0.2)', background: isSpecial ? 'linear-gradient(135deg, rgba(30, 15, 25, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)' : 'rgba(255,255,255,0.02)' }}>
                                <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '6px' }}>
                                    <button className="btn-ghost" style={{ padding: '4px', opacity: 0.7 }} onClick={() => setInfoModal(pack)} title="Info"><Info size={16} color={isSpecial ? '#ec4899' : '#3b82f6'} /></button>
                                    {isSpecial && <div style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', padding: '4px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800 }}>SPECIAL</div>}
                                    {!isSpecial && <div style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', padding: '4px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800 }}>CLASSIC</div>}
                                </div>
                                
                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{ ...styles.prizeBadge, background: isSpecial ? 'rgba(236, 72, 153, 0.15)' : 'rgba(59, 130, 246, 0.1)', color: isSpecial ? '#f472b6' : '#60a5fa' }}>{pack.region_label || pack.scope || 'CLASSIC'}</div>
                                    <h3 style={styles.cardTitle}>{pack.name.replace(' Scratch', '')}</h3>
                                    <div style={styles.winDisplay}>
                                        Win up to <span style={{ color: isSpecial ? '#ec4899' : '#10b981', fontWeight: 800 }}>{(pack.max_win / 100).toLocaleString()} KC</span>
                                    </div>
                                </div>

                                <div style={styles.priceSection}>
                                    <div>
                                        <div style={styles.priceLabel}>Preis</div>
                                        <div style={styles.priceValue}>{(pack.price / 100).toLocaleString()} <span style={{ fontSize: '0.7rem' }}>KC</span></div>
                                        {pack.max_daily_limit > 0 && (
                                            <div style={{ fontSize: '0.65rem', color: (pack.userDailyCount || 0) >= pack.max_daily_limit ? '#ef4444' : (isSpecial ? '#f472b6' : '#fbbf24'), marginTop: '4px', fontWeight: 600 }}>
                                                {(pack.userDailyCount || 0)} / {pack.max_daily_limit} heute übrig
                                            </div>
                                        )}
                                    </div>
                                    <button 
                                        className="btn-primary" 
                                        style={{ ...styles.buyBtn, background: isSpecial ? 'linear-gradient(135deg, #ec4899, #be185d)' : '#3b82f6', border: 'none', boxShadow: isSpecial ? '0 4px 12px rgba(236, 72, 153, 0.3)' : '0 4px 12px rgba(59, 130, 246, 0.3)' }}
                                        onClick={() => handleBuy(pack.id)}
                                        disabled={purchasing || ((user?.koala_balance || 0) < pack.price && !isGuest) || (pack.max_daily_limit > 0 && (pack.userDailyCount || 0) >= pack.max_daily_limit)}
                                    >
                                        {purchasing ? '...' : (pack.max_daily_limit > 0 && (pack.userDailyCount || 0) >= pack.max_daily_limit) ? 'Limit erreicht' : 'KAUFEN'}
                                    </button>
                                </div>
                            </div>
                            );
                        })}
                    </div>
                </section>

                {/* Premium / Gold Section */}
                <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', borderLeft: '4px solid #f59e0b', paddingLeft: '16px' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(245, 158, 11, 0.15)' }}>
                            <Star size={24} color="#f59e0b" />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, color: '#f8fafc', letterSpacing: '0.02em' }}>PREMIUM TICKETS</h2>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#f59e0b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Variable Jackpots • High Stakes</p>
                        </div>
                    </div>

                    <div style={styles.grid}>
                        {[...packs.filter(p => p.is_weighted)].sort((a, b) => (b.is_special ? 1 : 0) - (a.is_special ? 1 : 0)).map((pack) => {
                            const isSpecial = !!pack.is_special;
                            return (
                            <div key={pack.id} className="glass-card hover-glow" style={{ ...styles.card, border: isSpecial ? '1px solid rgba(236, 72, 153, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)', background: isSpecial ? 'linear-gradient(135deg, rgba(30, 15, 25, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)' : 'linear-gradient(135deg, rgba(26, 31, 44, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)' }}>
                                <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '6px' }}>
                                    <button className="btn-ghost" style={{ padding: '4px', opacity: 0.7 }} onClick={() => setInfoModal(pack)} title="Info"><Info size={16} color={isSpecial ? '#ec4899' : '#f59e0b'} /></button>
                                    {isSpecial && <div style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', padding: '4px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800 }}>SPECIAL</div>}
                                    {!isSpecial && <div style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '4px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800 }}>PREMIUM</div>}
                                </div>
                                
                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{ ...styles.prizeBadge, background: isSpecial ? 'rgba(236, 72, 153, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: isSpecial ? '#f472b6' : '#fbbf24' }}>{pack.region_label || pack.scope || 'PREMIUM'}</div>
                                    <h3 style={styles.cardTitle}>{pack.name.replace(' Scratch', '')}</h3>
                                    <div style={styles.winDisplay}>
                                        Win up to <span style={{ color: isSpecial ? '#ec4899' : '#f59e0b', fontWeight: 800 }}>{((pack.max_win || (pack.price * 160)) / 100).toLocaleString()} KC</span>
                                    </div>
                                </div>

                                <div style={styles.priceSection}>
                                    <div>
                                        <div style={styles.priceLabel}>Preis</div>
                                        <div style={styles.priceValue}>{(pack.price / 100).toLocaleString()} <span style={{ fontSize: '0.7rem' }}>KC</span></div>
                                        {pack.max_daily_limit > 0 && (
                                            <div style={{ fontSize: '0.65rem', color: (pack.userDailyCount || 0) >= pack.max_daily_limit ? '#ef4444' : (isSpecial ? '#f472b6' : '#fbbf24'), marginTop: '4px', fontWeight: 600 }}>
                                                {(pack.userDailyCount || 0)} / {pack.max_daily_limit} heute übrig
                                            </div>
                                        )}
                                    </div>
                                    <button 
                                        className="btn-primary" 
                                        style={{ ...styles.buyBtn, background: isSpecial ? 'linear-gradient(135deg, #ec4899, #be185d)' : 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', boxShadow: isSpecial ? '0 4px 12px rgba(236, 72, 153, 0.3)' : '0 4px 12px rgba(245, 158, 11, 0.3)' }}
                                        onClick={() => handleBuy(pack.id)}
                                        disabled={purchasing || ((user?.koala_balance || 0) < pack.price && !isGuest) || (pack.max_daily_limit > 0 && (pack.userDailyCount || 0) >= pack.max_daily_limit)}
                                    >
                                        {purchasing ? '...' : (pack.max_daily_limit > 0 && (pack.userDailyCount || 0) >= pack.max_daily_limit) ? 'Limit erreicht' : 'KAUFEN'}
                                    </button>
                                </div>
                            </div>
                            );
                        })}
                    </div>
                </section>
            </div>


            {/* Collapsible Info Section */}
            <div style={styles.infoSection}>
                <div 
                    className="glass-card" 
                    style={{ padding: '24px', cursor: 'pointer', transition: 'all 0.3s ease' }}
                    onClick={() => setShowInfo(!showInfo)}
                >
                    <div className="flex-between">
                        <div className="flex-center" style={{ gap: '16px' }}>
                            <div className="flex-center" style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)' }}>
                                <Info size={24} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Wie funktionieren Rubbellose?</h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Klicke hier für Details zu Regeln und Technik.</p>
                            </div>
                        </div>
                        <div style={{ color: 'var(--text-muted)' }}>
                            {showInfo ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                        </div>
                    </div>

                    {showInfo && (
                        <div style={styles.infoContent}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '32px', marginTop: '32px', paddingTop: '32px', borderTop: '1px solid var(--border-color)' }}>
                                <div>
                                    <h4 style={{ color: 'var(--text-main)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Trophy size={16} style={{ color: '#fbbf24' }} /> Regeln
                                    </h4>
                                    <p>Kaufe ein Los deiner Wahl. Rubbel das 3x3 Feld frei. Wenn du 3 identische Symbole in einer Reihe (horizontal, vertikal oder diagonal) findest, gewinnst du den Jackpot!</p>
                                </div>
                                <div>
                                    <h4 style={{ color: 'var(--text-main)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Zap size={16} style={{ color: 'var(--accent-primary)' }} /> Technik
                                    </h4>
                                    <p>Jedes Los wird beim Kauf sicher auf dem Server generiert. Das Ergebnis steht fest, sobald du bezahlst – das Rubbeln ist eine rein visuelle Enthüllung.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Game / Scratch Overlay */}
            {showGame && activeCard && (
                <div style={styles.gameOverlay}>
                    <div className="glass-card" style={{ padding: '40px', maxWidth: '440px', textAlign: 'center', background: '#0a0d11', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
                        {!result && (
                            <button 
                                onClick={() => { setShowGame(false); setActiveCard(null); }}
                                style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                title="Los wegwerfen"
                            >
                                <span style={{ fontSize: '0.7rem', verticalAlign: 'middle', marginRight: '6px' }}>WEGWERFEN</span> ✕
                            </button>
                        )}
                        
                        <h2 style={{ fontSize: '1.75rem', marginBottom: '8px' }}>RUBBELN!</h2>
                        <div style={styles.scratchContainer}>
                            <Scratchcard 
                                width={300} 
                                height={300} 
                                brushSize={35}
                                threshold={0.5}
                                overlayColor="#2a3441"
                                revealAll={revealAll}
                                onFieldReveal={(idx) => handleFieldReveal(idx)}
                                onComplete={handleScratchComplete}
                                isMuted={isMuted}
                            >
                                <div style={styles.scratchGrid}>
                                    {activeCard.grid.map((code, idx) => {
                                        const isWinningSymbol = winningLines.some(w => w.line.includes(idx));
                                        const isDimmed = winningLines.length > 0 && !winningLines.some(w => w.line.includes(idx));
                                        
                                        return (
                                            <div 
                                                key={idx} 
                                                style={{
                                                    ...styles.scratchCell,
                                                    border: '1px solid rgba(255,255,255,0.05)',
                                                    borderColor: isWinningSymbol ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                                                    transform: isWinningSymbol ? 'scale(1.05)' : 'scale(1)',
                                                    opacity: isDimmed ? 0.3 : 1,
                                                    transition: 'all 0.5s ease',
                                                    boxShadow: isWinningSymbol ? '0 0 20px var(--accent-primary)' : 'none',
                                                    zIndex: isWinningSymbol ? 10 : 1,
                                                    borderRadius: '0', // Square for grid alignment
                                                    overflow: 'hidden'
                                                }}
                                                className={isWinningSymbol ? 'win-glow' : ''}
                                            >
                                                <div className={revealedFields[idx] ? 'reveal-pop' : ''} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {findTeamImage(code) ? (
                                                        <img src={findTeamImage(code)} alt={code} width="40" height="40" loading="lazy" style={styles.teamLogo} />
                                                    ) : (
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 800 }}>{code}</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </Scratchcard>
                        </div>

                        {!allRevealed && (
                            <button 
                                className="btn-ghost" 
                                style={{ marginTop: '20px', fontSize: '0.8rem', opacity: 0.7 }}
                                onClick={() => {
                                    setRevealAll(true);
                                    setRevealedFields(new Array(9).fill(true));
                                }}
                            >
                                <span style={{ marginRight: '8px' }}>ℹ️</span> MANUELL PRÜFEN
                            </button>
                        )}
                        
                        <div style={{ marginTop: '40px', minHeight: '120px' }}>
                            {result ? (
                                <div className="animate-fade-in">
                                    {result.winAmount > 0 ? (
                                        <div style={{ marginBottom: '24px' }}>
                                            <div style={{ color: '#fbbf24', fontSize: winningLines.length > 1 ? '3rem' : '2.5rem', fontWeight: 900, textShadow: winningLines.length > 1 ? '0 0 20px rgba(251, 191, 36, 0.4)' : 'none' }}>
                                                {winningLines.length > 1 ? '🔥 EPISCH!' : 'GEWONNEN!'}
                                            </div>
                                            <div style={{ fontSize: '1.25rem', fontWeight: 700, margin: '4px 0' }}>+{(result.winAmount / 100).toLocaleString()} KC</div>
                                            
                                            <div style={{ 
                                                fontSize: '0.9rem', 
                                                color: 'var(--text-muted)', 
                                                marginTop: '12px',
                                                padding: '12px 20px',
                                                background: 'rgba(251, 191, 36, 0.1)',
                                                borderRadius: '16px',
                                                display: 'inline-block',
                                                border: '1px solid rgba(251, 191, 36, 0.2)',
                                                maxHeight: '150px',
                                                overflowY: 'auto'
                                            }}>
                                                {winningLines.length > 1 && (
                                                    <div style={{ fontSize: '0.75rem', marginBottom: '8px', color: '#fbbf24', fontWeight: 800 }}>
                                                        {winningLines.length} GEWINNLINIEN GEKNACKT!
                                                    </div>
                                                )}
                                                {winningLines.map((win, index) => (
                                                    <div key={index} style={{ marginBottom: index === winningLines.length - 1 ? 0 : '4px' }}>
                                                        3x <span style={{ color: 'white', fontWeight: 800 }}>{win.code}</span>
                                                    </div>
                                                ))}
                                                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', fontWeight: 800 }}>
                                                    Gesamt Multiplikator: <span style={{ color: '#fbbf24' }}>{(result.winAmount / (result.price || activeCard?.price || 1)).toFixed(1)}x</span>!
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ marginBottom: '24px', color: 'var(--text-muted)', fontSize: '1.25rem' }}>Niete! Viel Glück nächstes Mal.</div>
                                    )}
                                    <button className="btn-primary" onClick={() => { setShowGame(false); setActiveCard(null); }}>Fertig</button>
                                </div>
                            ) : (
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.1em' }} className="animate-pulse tracking-widest">
                                    RUBBELN ZUM ENTHÜLLEN...
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; } 
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                
                .win-glow {
                    animation: win-pulse 1.5s infinite alternate;
                }
                
                @keyframes win-pulse {
                    from { box-shadow: 0 0 10px var(--accent-primary); transform: scale(1.05); }
                    to { box-shadow: 0 0 25px var(--accent-primary); transform: scale(1.1); }
                }

                .reveal-pop {
                    animation: pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }

                @keyframes pop {
                    0% { transform: scale(0.9); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>

            {/* Info Modal */}
            {infoModal && (
                <div style={styles.modalOverlay} onClick={() => setInfoModal(null)}>
                    <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'white' }}>{infoModal.name} Info</h2>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Details & Gewinnchancen</div>
                            </div>
                            <button className="btn-ghost" onClick={() => setInfoModal(null)} style={{ width: '32px', height: '32px', padding: 0, fontSize: '1.5rem', lineHeight: '1' }}>&times;</button>
                        </div>
                        
                        <div style={{ padding: '24px', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                                <div style={{ flex: 1, padding: '16px', background: 'rgba(var(--accent-primary-rgb), 0.1)', borderRadius: '16px', border: '1px solid rgba(var(--accent-primary-rgb), 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Gewinnchance</div>
                                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{(infoModal.win_chance * 100).toFixed(1)}%</div>
                                    </div>
                                </div>
                                <div style={{ flex: 1, padding: '16px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '16px', border: '1px solid rgba(245, 158, 11, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Gewinnrichtungen</div>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase' }}>3 Richtungen</div>
                                    </div>
                                    <svg width="32" height="32" viewBox="0 0 40 40" style={{ opacity: 0.9 }}>
                                        <rect x="2" y="2" width="36" height="36" rx="4" fill="none" stroke="rgba(245, 158, 11, 0.3)" strokeWidth="1" />
                                        <line x1="5" y1="20" x2="35" y2="20" stroke="#f59e0b" strokeWidth="2" strokeDasharray="2 1" />
                                        <line x1="20" y1="5" x2="20" y2="35" stroke="#f59e0b" strokeWidth="2" strokeDasharray="2 1" />
                                        <line x1="8" y1="8" x2="32" y2="32" stroke="#f59e0b" strokeWidth="2" strokeDasharray="2 1" />
                                    </svg>
                                </div>
                            </div>

                            <div style={{ 
                                padding: '16px', 
                                background: 'rgba(59, 130, 246, 0.05)', 
                                borderRadius: '16px', 
                                border: '1px solid rgba(59, 130, 246, 0.15)',
                                marginBottom: '24px',
                                display: 'flex',
                                gap: '12px',
                                alignItems: 'center'
                            }}>
                                <div style={{ fontSize: '1.5rem' }}>🎉</div>
                                <div style={{ fontSize: '0.75rem', lineHeight: '1.4', color: '#94a3b8' }}>
                                    <strong style={{ color: 'white', display: 'block', marginBottom: '2px' }}>MEHRFACHGEWINNE MÖGLICH!</strong>
                                    Die 3 Gewinnrichtungen können sich kreuzen. Liegen mehrere Gewinnlinien gleichzeitig vor, werden deren Gewinne addiert und anschließend mit der Gesamtanzahl der getroffenen Linien multipliziert. (z.B. Ein "Blackout" mit 9 gleichen Symbolen entspricht 8 Gewinnlinien gleichzeitig).
                                </div>
                            </div>

                            <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em' }}>Enthaltene Teams & Quoten</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {(infoModal.teams || []).map((t, idx) => {
                                    const teamInfo = teams.find(team => team.code === t.team_code);
                                    const N = infoModal.teams.length;
                                    const rank = idx + 1;
                                    let multiplier = 2.0;
                                    if (infoModal.is_weighted) {
                                        if (N > 1) {
                                            multiplier = 2 + 18 * Math.pow((N - rank) / (N - 1), 4);
                                        } else {
                                            multiplier = 20.0;
                                        }
                                    }

                                    return (
                                        <div key={t.team_code} style={{ 
                                            display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', 
                                            background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'
                                        }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', width: '20px' }}>#{rank}</span>
                                            {teamInfo?.image && <img src={teamInfo.image.replace('http://', 'https://')} alt="" width="24" height="24" loading="lazy" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />}
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'white' }}>{teamInfo?.name || t.team_code}</div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                {infoModal.is_weighted ? (
                                                    <span style={{ fontWeight: 800, color: rank === 1 ? '#f59e0b' : 'var(--accent-primary)', fontSize: '0.9rem' }}>{multiplier.toFixed(1)}x</span>
                                                ) : (
                                                    <span style={{ fontWeight: 800, color: 'var(--accent-primary)', fontSize: '0.9rem' }}>{(infoModal.reward_amount/100).toLocaleString()} KC</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div style={{ padding: '24px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <button className="btn-primary" style={{ width: '100%' }} onClick={() => setInfoModal(null)}>Verstanden</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScratchcardShop;
