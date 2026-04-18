import React, { useEffect, useRef, useState } from 'react';
import { Dices, Swords } from 'lucide-react';

const getGlowTier = (currentMax) => {
    if (currentMax <= 1) {
        return {
            digitColor: '#fff3f3',
            textShadow: 'none',
            digitGlow: '0 0 0 rgba(0,0,0,0)',
            border: 'rgba(239, 68, 68, 0.42)',
            surface: 'linear-gradient(180deg, rgba(60, 18, 18, 0.78) 0%, rgba(28, 12, 14, 0.92) 100%)',
            halo: 'radial-gradient(circle at center, rgba(239, 68, 68, 0.28) 0%, rgba(239, 68, 68, 0.08) 45%, transparent 75%)',
            slotGlow: '0 0 0 1px rgba(239, 68, 68, 0.12), 0 8px 22px rgba(239, 68, 68, 0.16), inset 0 1px 0 rgba(255,255,255,0.06)',
            widgetBorder: 'rgba(239, 68, 68, 0.42)',
            widgetShadow: '0 12px 30px rgba(239, 68, 68, 0.18)',
            accentColor: '#fca5a5',
            headlineColor: '#fecaca'
        };
    }

    if (currentMax <= 10) {
        return {
            digitColor: '#fff7ed',
            textShadow: 'none',
            digitGlow: '0 0 0 rgba(0,0,0,0)',
            border: 'rgba(251, 146, 60, 0.3)',
            surface: 'linear-gradient(180deg, rgba(42, 28, 18, 0.74) 0%, rgba(21, 17, 16, 0.92) 100%)',
            halo: 'radial-gradient(circle at center, rgba(251, 146, 60, 0.18) 0%, rgba(251, 146, 60, 0.05) 45%, transparent 75%)',
            slotGlow: '0 0 0 1px rgba(251, 146, 60, 0.08), 0 8px 22px rgba(251, 146, 60, 0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
            widgetBorder: 'rgba(239, 68, 68, 0.4)',
            widgetShadow: '0 10px 30px rgba(239, 68, 68, 0.16)',
            accentColor: '#fdba74',
            headlineColor: 'var(--text-main)'
        };
    }

    if (currentMax <= 20) {
        return {
            digitColor: '#fffbea',
            textShadow: 'none',
            digitGlow: '0 0 0 rgba(0,0,0,0)',
            border: 'rgba(250, 204, 21, 0.24)',
            surface: 'linear-gradient(180deg, rgba(39, 34, 18, 0.74) 0%, rgba(18, 18, 16, 0.92) 100%)',
            halo: 'radial-gradient(circle at center, rgba(250, 204, 21, 0.14) 0%, rgba(250, 204, 21, 0.04) 45%, transparent 75%)',
            slotGlow: '0 0 0 1px rgba(250, 204, 21, 0.07), 0 8px 20px rgba(250, 204, 21, 0.1), inset 0 1px 0 rgba(255,255,255,0.06)',
            widgetBorder: 'rgba(239, 68, 68, 0.38)',
            widgetShadow: '0 10px 28px rgba(239, 68, 68, 0.15)',
            accentColor: '#fde68a',
            headlineColor: 'var(--text-main)'
        };
    }

    if (currentMax <= 100) {
        return {
            digitColor: '#f8fbff',
            textShadow: 'none',
            digitGlow: '0 0 0 rgba(0,0,0,0)',
            border: 'rgba(125, 211, 252, 0.18)',
            surface: 'linear-gradient(180deg, rgba(18, 28, 40, 0.72) 0%, rgba(15, 17, 22, 0.92) 100%)',
            halo: 'radial-gradient(circle at center, rgba(125, 211, 252, 0.12) 0%, rgba(125, 211, 252, 0.04) 45%, transparent 75%)',
            slotGlow: '0 0 0 1px rgba(125, 211, 252, 0.06), 0 8px 20px rgba(125, 211, 252, 0.08), inset 0 1px 0 rgba(255,255,255,0.06)',
            widgetBorder: 'rgba(239, 68, 68, 0.36)',
            widgetShadow: '0 10px 28px rgba(239, 68, 68, 0.14)',
            accentColor: 'var(--accent-primary)',
            headlineColor: 'var(--text-main)'
        };
    }

    return {
        digitColor: '#f8fbff',
        textShadow: 'none',
        digitGlow: '0 0 0 rgba(0,0,0,0)',
        border: 'rgba(148, 163, 184, 0.14)',
        surface: 'linear-gradient(180deg, rgba(18, 24, 34, 0.7) 0%, rgba(12, 16, 22, 0.9) 100%)',
        halo: 'radial-gradient(circle at center, rgba(148, 163, 184, 0.09) 0%, rgba(148, 163, 184, 0.03) 45%, transparent 75%)',
        slotGlow: '0 0 0 1px rgba(148, 163, 184, 0.05), 0 8px 18px rgba(148, 163, 184, 0.07), inset 0 1px 0 rgba(255,255,255,0.06)',
        widgetBorder: 'rgba(239, 68, 68, 0.34)',
        widgetShadow: '0 10px 26px rgba(239, 68, 68, 0.13)',
        accentColor: 'var(--accent-primary)',
        headlineColor: 'var(--text-main)'
    };
};

const DeathrollWidget = ({ deathroll, user, roomId, socket, rollEvent }) => {
    const currentMax = Number(deathroll?.currentMax) || 0;
    const [displayValue, setDisplayValue] = useState(currentMax);
    const [isRolling, setIsRolling] = useState(false);
    const scrambleIntervalRef = useRef(null);
    const rollTimeoutRef = useRef(null);
    const settleTimeoutRef = useRef(null);
    const isFirstRenderRef = useRef(true);
    const paddedValue = String(displayValue).padStart(4, '0');
    const firstActiveIndex = paddedValue.search(/[1-9]/);
    const glowTier = getGlowTier(currentMax);
    const isWaitingForOthers = deathroll?.lastRoller === user?.displayName || deathroll?.lastRoller === user?.username;
    const restingDigitOffsetY = '-2px';

    useEffect(() => {
        if (isFirstRenderRef.current) {
            isFirstRenderRef.current = false;
            setDisplayValue(currentMax);
            return undefined;
        }

        if (currentMax === displayValue) {
            return undefined;
        }

        if (rollTimeoutRef.current) {
            window.clearTimeout(rollTimeoutRef.current);
        }

        if (scrambleIntervalRef.current) {
            window.clearInterval(scrambleIntervalRef.current);
        }

        if (settleTimeoutRef.current) {
            window.clearTimeout(settleTimeoutRef.current);
        }

        setIsRolling(true);

        const startValue = displayValue;
        const scrambleCeiling = Math.max(startValue, currentMax, 1000);
        let lastScramble = startValue;

        scrambleIntervalRef.current = window.setInterval(() => {
            const nextValue = Math.max(
                currentMax,
                Math.floor(Math.random() * scrambleCeiling) + 1
            );
            lastScramble = nextValue;
            setDisplayValue(nextValue);
        }, 72);

        rollTimeoutRef.current = window.setTimeout(() => {
            if (scrambleIntervalRef.current) {
                window.clearInterval(scrambleIntervalRef.current);
                scrambleIntervalRef.current = null;
            }

            if (lastScramble !== currentMax) {
                setDisplayValue(currentMax);
            }
        }, 620);

        settleTimeoutRef.current = window.setTimeout(() => {
            setDisplayValue(currentMax);
            setIsRolling(false);
        }, 1180);

        return () => {
            if (rollTimeoutRef.current) {
                window.clearTimeout(rollTimeoutRef.current);
                rollTimeoutRef.current = null;
            }

            if (scrambleIntervalRef.current) {
                window.clearInterval(scrambleIntervalRef.current);
                scrambleIntervalRef.current = null;
            }

            if (settleTimeoutRef.current) {
                window.clearTimeout(settleTimeoutRef.current);
                settleTimeoutRef.current = null;
            }
        };
    }, [currentMax, displayValue]);

    useEffect(() => () => {
        if (rollTimeoutRef.current) {
            window.clearTimeout(rollTimeoutRef.current);
        }

        if (scrambleIntervalRef.current) {
            window.clearInterval(scrambleIntervalRef.current);
        }

        if (settleTimeoutRef.current) {
            window.clearTimeout(settleTimeoutRef.current);
        }
    }, []);

    return (
        <div className="glass-card animate-fade-in" style={{
            marginTop: '24px',
            padding: '22px 20px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px',
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', zIndex: 1 }}>
                <Swords size={28} color={currentMax <= 1 ? '#f87171' : '#ef4444'} />
                <h3 style={{ fontSize: '1.4rem', color: glowTier.headlineColor, margin: 0 }}>Deathroll</h3>
            </div>

            <div style={{ textAlign: 'center', zIndex: 1, width: '100%' }}>
                <div style={{ fontSize: '1.05rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    <strong style={{ color: glowTier.accentColor }}>{deathroll?.lastRoller}</strong> hat gewürfelt:
                </div>

                <div
                    className={isRolling ? 'deathroll-roll' : undefined}
                    aria-label={`Deathroll Stand ${paddedValue}`}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                        gap: '8px',
                        width: '100%',
                        maxWidth: '300px',
                        margin: '0 auto',
                        fontVariantNumeric: 'tabular-nums',
                        fontFeatureSettings: '"tnum" 1',
                        transformOrigin: 'center center'
                    }}
                >
                    {paddedValue.split('').map((digit, index) => {
                        const isActive = firstActiveIndex === -1 ? false : index >= firstActiveIndex;

                        return (
                            <div
                                key={`${digit}-${index}`}
                                style={{
                                    position: 'relative',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minWidth: 0,
                                    minHeight: '78px',
                                    borderRadius: '16px',
                                    border: `1px solid ${isActive ? glowTier.border : 'rgba(255,255,255,0.06)'}`,
                                    background: isActive
                                        ? glowTier.surface
                                        : 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.015) 100%)',
                                    boxShadow: isActive ? glowTier.slotGlow : 'inset 0 1px 0 rgba(255,255,255,0.03)',
                                    overflow: 'hidden',
                                    transform: isRolling ? 'translateY(-2px) scale(1.015)' : 'translateY(0) scale(1)',
                                    transition: 'transform 240ms ease, border-color 180ms ease, box-shadow 180ms ease'
                                }}
                            >
                                {isActive && (
                                    <div style={{
                                        position: 'absolute',
                                        inset: '-18%',
                                        background: glowTier.halo,
                                        opacity: deathroll?.isComplete ? 1 : 0.92
                                    }} />
                                )}
                                <span style={{
                                    position: 'relative',
                                    zIndex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '100%',
                                    height: '100%',
                                    fontSize: '3rem',
                                    lineHeight: 1,
                                    fontWeight: 900,
                                    letterSpacing: '0.02em',
                                    color: isActive ? glowTier.digitColor : 'rgba(255,255,255,0.22)',
                                    textShadow: isActive ? glowTier.textShadow : 'none',
                                    WebkitFontSmoothing: 'antialiased',
                                    MozOsxFontSmoothing: 'grayscale',
                                    opacity: isActive ? 1 : 0.72,
                                    filter: isRolling ? 'none' : 'none',
                                    transform: isRolling ? 'translateY(3px) scale(0.972)' : `translateY(${restingDigitOffsetY}) scale(1)`,
                                    transition: 'transform 280ms ease, opacity 180ms ease',
                                    animation: !isRolling ? 'deathrollDigitReveal 360ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none'
                                }}>
                                    {digit}
                                </span>
                            </div>
                        );
                    })}
                </div>
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
