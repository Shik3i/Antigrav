import React, { useEffect, useRef, useState } from 'react';
import { Dices, Swords } from 'lucide-react';
import SlotReels from './SlotReels';

const getGlowTier = (currentMax) => {
    if (currentMax <= 1) {
        return {
            digitColor: '#f87171',
            textShadow: '0 0 8px rgba(248,113,113,0.6)',
            border: 'rgba(239, 68, 68, 0.55)',
            surface: 'linear-gradient(180deg, rgba(60, 18, 18, 0.78) 0%, rgba(28, 12, 14, 0.92) 100%)',
            halo: 'radial-gradient(circle at center, rgba(239, 68, 68, 0.28) 0%, rgba(239, 68, 68, 0.08) 45%, transparent 75%)',
            slotGlow: '0 0 0 1px rgba(239, 68, 68, 0.18), 0 8px 22px rgba(239, 68, 68, 0.22), inset 0 1px 0 rgba(255,255,255,0.06)',
            widgetBorder: 'rgba(239, 68, 68, 0.55)',
            widgetShadow: '0 12px 30px rgba(239, 68, 68, 0.18)',
            accentColor: '#f87171',
            headlineColor: '#fecaca',
            isCritical: true
        };
    }

    if (currentMax <= 10) {
        return {
            digitColor: '#fb923c',
            textShadow: '0 0 6px rgba(251,146,60,0.5)',
            border: 'rgba(251, 146, 60, 0.4)',
            surface: 'linear-gradient(180deg, rgba(42, 28, 18, 0.74) 0%, rgba(21, 17, 16, 0.92) 100%)',
            halo: 'radial-gradient(circle at center, rgba(251, 146, 60, 0.18) 0%, rgba(251, 146, 60, 0.05) 45%, transparent 75%)',
            slotGlow: '0 0 0 1px rgba(251, 146, 60, 0.1), 0 8px 22px rgba(251, 146, 60, 0.14), inset 0 1px 0 rgba(255,255,255,0.06)',
            widgetBorder: 'rgba(251, 146, 60, 0.45)',
            widgetShadow: '0 10px 30px rgba(239, 68, 68, 0.16)',
            accentColor: '#fb923c',
            headlineColor: '#fed7aa'
        };
    }

    if (currentMax <= 20) {
        return {
            digitColor: '#fde047',
            textShadow: '0 0 6px rgba(253,224,71,0.4)',
            border: 'rgba(250, 204, 21, 0.35)',
            surface: 'linear-gradient(180deg, rgba(39, 34, 18, 0.74) 0%, rgba(18, 18, 16, 0.92) 100%)',
            halo: 'radial-gradient(circle at center, rgba(250, 204, 21, 0.14) 0%, rgba(250, 204, 21, 0.04) 45%, transparent 75%)',
            slotGlow: '0 0 0 1px rgba(250, 204, 21, 0.08), 0 8px 20px rgba(250, 204, 21, 0.1), inset 0 1px 0 rgba(255,255,255,0.06)',
            widgetBorder: 'rgba(250, 204, 21, 0.4)',
            widgetShadow: '0 10px 28px rgba(239, 68, 68, 0.15)',
            accentColor: '#fde047',
            headlineColor: '#fef08a'
        };
    }

    if (currentMax <= 100) {
        return {
            digitColor: '#e0f2fe',
            textShadow: '0 0 6px rgba(125,211,252,0.4)',
            border: 'rgba(125, 211, 252, 0.25)',
            surface: 'linear-gradient(180deg, rgba(18, 28, 40, 0.72) 0%, rgba(15, 17, 22, 0.92) 100%)',
            halo: 'radial-gradient(circle at center, rgba(125, 211, 252, 0.12) 0%, rgba(125, 211, 252, 0.04) 45%, transparent 75%)',
            slotGlow: '0 0 0 1px rgba(125, 211, 252, 0.07), 0 8px 20px rgba(125, 211, 252, 0.1), inset 0 1px 0 rgba(255,255,255,0.06)',
            widgetBorder: 'rgba(125, 211, 252, 0.3)',
            widgetShadow: '0 10px 28px rgba(239, 68, 68, 0.14)',
            accentColor: '#7dd3fc',
            headlineColor: 'var(--text-main)'
        };
    }

    return {
        digitColor: '#4ade80',
        textShadow: '0 0 6px rgba(74,222,128,0.4)',
        border: 'rgba(22, 163, 74, 0.35)',
        surface: 'linear-gradient(180deg, rgba(12, 26, 12, 0.72) 0%, rgba(8, 16, 8, 0.92) 100%)',
        halo: 'radial-gradient(circle at center, rgba(74, 222, 128, 0.1) 0%, rgba(74, 222, 128, 0.03) 45%, transparent 75%)',
        slotGlow: '0 0 0 1px rgba(74, 222, 128, 0.08), 0 8px 18px rgba(74, 222, 128, 0.1), inset 0 1px 0 rgba(255,255,255,0.06)',
        widgetBorder: 'rgba(22, 163, 74, 0.4)',
        widgetShadow: '0 10px 26px rgba(22, 163, 74, 0.13)',
        accentColor: '#4ade80',
        headlineColor: 'var(--text-main)'
    };
};

const DeathrollWidget = ({ deathroll, user, roomId, socket, rollEvent }) => {
    const currentMax = Number(deathroll?.currentMax) || 0;
    const [isRolling, setIsRolling] = useState(false);
    const isFirstRenderRef = useRef(true);
    const rollTimerRef = useRef(null);
    const glowTier = getGlowTier(currentMax);
    const isWaitingForOthers = deathroll?.lastRoller === user?.displayName || deathroll?.lastRoller === user?.username;

    useEffect(() => {
        if (isFirstRenderRef.current) {
            isFirstRenderRef.current = false;
            return undefined;
        }

        if (rollTimerRef.current) {
            window.clearTimeout(rollTimerRef.current);
        }

        setIsRolling(true);
        rollTimerRef.current = window.setTimeout(() => {
            setIsRolling(false);
        }, 2200);

        return () => {
            if (rollTimerRef.current) {
                window.clearTimeout(rollTimerRef.current);
            }
        };
    }, [currentMax]);

    useEffect(() => () => {
        if (rollTimerRef.current) {
            window.clearTimeout(rollTimerRef.current);
        }
    }, []);

    return (
        <div className={`glass-card animate-fade-in${glowTier.isCritical ? ' deathroll-cabinet--critical' : ''}`} style={{
            marginTop: '24px',
            padding: '18px 16px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            border: `1px solid ${glowTier.widgetBorder}`,
            background: 'rgba(20, 24, 30, 0.8)',
            boxShadow: glowTier.widgetShadow,
            maxWidth: '400px',
            width: '100%',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <div style={{
                position: 'absolute',
                inset: 0,
                background: deathroll?.isComplete
                    ? 'radial-gradient(circle at center, rgba(239, 68, 68, 0.14) 0%, rgba(239, 68, 68, 0.04) 42%, transparent 72%)'
                    : 'radial-gradient(circle at center, rgba(239, 68, 68, 0.1) 0%, transparent 70%)',
                zIndex: 0
            }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', zIndex: 1 }}>
                <Swords size={22} color={glowTier.accentColor} />
                <span style={{
                    fontFamily: "'Black Ops One', serif",
                    fontSize: '1.1rem',
                    letterSpacing: '0.18em',
                    color: glowTier.headlineColor,
                    textShadow: glowTier.isCritical ? `0 0 12px ${glowTier.accentColor}` : 'none'
                }}>
                    ☠ DEATHROLL ☠
                </span>
                <Swords size={22} color={glowTier.accentColor} />
            </div>

            <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)', zIndex: 1 }}>
                <strong style={{ color: glowTier.accentColor }}>{deathroll?.lastRoller}</strong> hat gewürfelt:
            </div>

            <div style={{ position: 'relative', zIndex: 1 }}>
                <SlotReels value={currentMax} tier={glowTier} isRolling={isRolling} />
                <div style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: '50%',
                    height: '2px',
                    background: 'rgba(250, 204, 21, 0.55)',
                    boxShadow: '0 0 6px rgba(250, 204, 21, 0.45)',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    zIndex: 2
                }} />
            </div>

            {deathroll?.isComplete ? (
                <div style={{
                    fontSize: '1.2rem',
                    fontWeight: 800,
                    color: '#fecaca',
                    textAlign: 'center',
                    marginTop: '4px',
                    zIndex: 1,
                    padding: '10px 16px',
                    background: 'rgba(239,68,68,0.14)',
                    border: '1px solid rgba(239,68,68,0.22)',
                    borderRadius: '10px',
                    width: '100%'
                }}>
                    {deathroll?.lastRoller} hat verloren!
                </div>
            ) : (
                <button
                    type="button"
                    className="btn-primary"
                    style={{
                        width: '100%',
                        justifyContent: 'center',
                        fontSize: '1.1rem',
                        padding: '16px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-main)',
                        zIndex: 1
                    }}
                    disabled={isWaitingForOthers}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        socket.emit(rollEvent, { roomId: String(roomId) });
                    }}
                >
                    <Dices size={20} /> {isWaitingForOthers ? 'Warten auf andere...' : `Antworten (1 - ${currentMax})`}
                </button>
            )}
        </div>
    );
};

export default DeathrollWidget;
