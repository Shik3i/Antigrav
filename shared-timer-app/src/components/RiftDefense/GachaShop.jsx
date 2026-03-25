import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useRiftDefense } from '../../context/RiftDefenseContext';
import { Package, Sparkles, Loader2 } from 'lucide-react';
import { playPurchaseSound } from '../../utils/soundGenerator';

const GachaShop = ({ onPurchase }) => {
    const { token, user, setUser } = useAuth();
    const { getRarityColor } = useRiftDefense();
    const [packs, setPacks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState(null);
    const [opening, setOpening] = useState(false);
    const [error, setError] = useState(null);
    const [lastDraw, setLastDraw] = useState(null); // { teamCode, rarityTier }

    const CAPSULE_PRICE = 1000; // 10 KC (1000 cents internally)
    const DISPLAY_PRICE = 10;

    useEffect(() => {
        const fetchPacks = async () => {
            try {
                const res = await axios.get('/api/rift-defense/shop-config', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                setPacks(res.data.packs || []);
            } catch (err) {
                setError('Konnte Shop-Daten nicht laden. Bitte versuche es später erneut.');
            } finally {
                setLoading(false);
            }
        };
        fetchPacks();
    }, [token]);

    const handleBuy = async (packId) => {
        setPurchasing(packId);
        setError(null);
        setLastDraw(null);
        setOpening(false);

        try {
            playPurchaseSound();
            const res = await axios.post('/api/rift-defense/buy-capsule', { packId }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            // Start animation
            setOpening(true);
            const drawData = { 
                teamCode: res.data.tower.teamCode, 
                rarityTier: res.data.tower.rarityTier,
                image: res.data.tower.image 
            };
            
            // Wait for tease
            setTimeout(() => {
                setOpening(false);
                setLastDraw(drawData);
                setUser(prev => ({ ...prev, koala_balance: res.data.newBalance }));
                if (onPurchase) onPurchase();
            }, 2200);

        } catch (err) {
            setError(err.response?.data?.error || 'Kauf fehlgeschlagen.');
            setPurchasing(null);
        } finally {
            setPurchasing(null);
        }
    };

    const styles = {
        container: {
            display: 'flex',
            flexDirection: 'column',
            gap: '32px',
            alignItems: 'center',
            padding: '48px 24px',
            minHeight: '600px'
        },
        card: {
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.95))',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '24px',
            padding: '40px',
            width: '320px',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5), inset 0 0 40px rgba(16, 185, 129, 0.05)',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            transition: 'transform 0.3s ease'
        },
        iconWrapper: {
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 0 30px rgba(16, 185, 129, 0.2)'
        },
        title: {
            fontSize: '1.4rem',
            fontWeight: 800,
            margin: '0 0 8px 0',
            color: '#f8fafc'
        },
        desc: {
            color: 'var(--text-muted)',
            fontSize: '0.9rem',
            margin: '0 0 24px 0',
            lineHeight: 1.5,
            flex: 1
        },
        priceTag: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255,255,255,0.05)',
            padding: '8px 16px',
            borderRadius: '12px',
            fontSize: '1.2rem',
            fontWeight: 800,
            marginBottom: '24px',
            alignSelf: 'center'
        },
        buyBtn: {
            width: '100%',
            padding: '16px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            border: 'none',
            borderRadius: '16px',
            color: 'white',
            fontSize: '1.1rem',
            fontWeight: 800,
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 10px 20px rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px'
        },
        // Animation Styles
        openingOverlay: {
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.95)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '32px'
        },
        capsulePulsing: (color) => ({
            width: '120px',
            height: '160px',
            background: `linear-gradient(to bottom, #f8fafc 50%, ${color} 50%)`,
            borderRadius: '60px',
            border: `4px solid ${color}`,
            boxShadow: `0 0 60px ${color}66`,
            animation: 'openingShake 0.4s infinite, openingPulse 1s infinite alternate',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }),
        drawResult: (rarityColor) => ({
            marginTop: '32px',
            padding: '40px',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98))',
            border: `2px solid ${rarityColor}`,
            borderRadius: '24px',
            textAlign: 'center',
            boxShadow: `0 0 40px ${rarityColor}33`,
            animation: 'revealEnthuse 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            maxWidth: '300px'
        }),
        resultLogo: {
            width: '120px',
            height: '120px',
            objectFit: 'contain',
            marginBottom: '12px'
        }
    };

    if (loading) return <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>Lade Kapseln...</div>;

    return (
        <div style={styles.container}>
            <style>{`
                @keyframes openingShake {
                    0% { transform: rotate(0deg); }
                    25% { transform: rotate(5deg); }
                    75% { transform: rotate(-5deg); }
                    100% { transform: rotate(0deg); }
                }
                @keyframes openingPulse {
                    from { transform: scale(1); box-shadow: 0 0 20px currentColor; }
                    to { transform: scale(1.15); box-shadow: 0 0 60px currentColor; }
                }
                @keyframes revealEnthuse {
                    0% { transform: scale(0.5) translateY(50px); opacity: 0; }
                    100% { transform: scale(1) translateY(0); opacity: 1; }
                }
                @keyframes flashWhite {
                    0% { background: white; opacity: 1; }
                    100% { background: transparent; opacity: 0; }
                }
            `}</style>

            {error && <div style={{ color: '#ef4444', marginBottom: '24px', fontWeight: 700, background: 'rgba(239, 68, 68, 0.1)', padding: '12px 24px', borderRadius: '12px' }}>{error}</div>}
            
            <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {packs.map(pack => (
                    <div key={pack.id} style={{...styles.card, opacity: opening ? 0.3 : 1}}>
                        <div style={styles.iconWrapper}>
                            <Package size={40} color="#10b981" />
                        </div>
                        <h2 style={styles.title}>{pack.name} Kapsel</h2>
                        <p style={styles.desc}>Zufälliger Turm aus dem <strong>{pack.name}</strong> Roster. Seltene Favoriten sind extrem wertvoll!</p>
                        
                        <div style={styles.priceTag}>
                            <span style={{ color: '#fbbf24' }}>{DISPLAY_PRICE} KC</span>
                        </div>

                        <button 
                            className="btn-primary"
                            style={{ ...styles.buyBtn, opacity: purchasing === pack.id ? 0.7 : 1 }}
                            onClick={() => handleBuy(pack.id)}
                            disabled={purchasing || opening || (user?.koala_balance || 0) < CAPSULE_PRICE}
                        >
                            {purchasing === pack.id ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                            {purchasing === pack.id ? 'Bestätige...' : 'Kapsel Kaufen'}
                        </button>
                    </div>
                ))}
            </div>

            {/* Opening Animation Overlay */}
            {opening && (
                <div style={styles.openingOverlay}>
                    <div style={styles.capsulePulsing(getRarityColor(lastDraw?.rarityTier || 1))}>
                        <Sparkles size={48} color="white" />
                    </div>
                    <div style={{ color: 'white', fontSize: '1.2rem', fontWeight: 800, letterSpacing: '2px' }}>ÖFFNE KAPSEL...</div>
                </div>
            )}

            {/* Result Display */}
            {lastDraw && !opening && (
                <div style={styles.drawResult(getRarityColor(lastDraw.rarityTier))}>
                    <div style={{ color: getRarityColor(lastDraw.rarityTier), textTransform: 'uppercase', fontWeight: 900, letterSpacing: '0.2em', fontSize: '0.75rem' }}>
                        {lastDraw.rarityTier >= 8 ? 'LEGENDÄR' : lastDraw.rarityTier >= 5 ? 'EPISCH' : 'SELTEN'} UNLOCKED
                    </div>
                    {lastDraw.image ? (
                        <img src={lastDraw.image} alt="" style={styles.resultLogo} />
                    ) : (
                        <div style={{ fontSize: '3rem', fontWeight: 900, margin: '20px 0' }}>{lastDraw.teamCode}</div>
                    )}
                    <div style={{ fontSize: '2rem', fontWeight: 900, color: '#f8fafc' }}>{lastDraw.teamCode} <span style={{ color: '#fbbf24' }}>⭐</span></div>
                    <button className="btn-primary" style={{ marginTop: '16px', width: '100%' }} onClick={() => setLastDraw(null)}>OKAY!</button>
                </div>
            )}
        </div>
    );
};

export default GachaShop;
