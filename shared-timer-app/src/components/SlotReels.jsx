import React, { useEffect, useRef, useState } from 'react';

const REEL_HEIGHT = 74;
const STRIP_DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const LOCK_START = 1400;
const LOCK_INTERVAL = 160;
const FLASH_DURATION = 320;

const targetY = (digit) => -((digit + 10) * 74);

const clearTimers = (ref) => {
    ref.current.forEach(clearTimeout);
    ref.current = [];
};

const SlotReels = ({ value, tier, isRolling }) => {
    const paddedValue = String(value).padStart(4, '0');
    const digits = paddedValue.split('').map(Number);
    const [reelStates, setReelStates] = useState(['idle', 'idle', 'idle', 'idle']);
    const timersRef = useRef([]);

    useEffect(() => {
        if (isRolling) {
            clearTimers(timersRef);
            setReelStates(['spinning', 'spinning', 'spinning', 'spinning']);

            digits.forEach((_, i) => {
                const t1 = setTimeout(() => {
                    setReelStates(prev => {
                        const next = [...prev];
                        next[i] = 'locking';
                        return next;
                    });
                    const t2 = setTimeout(() => {
                        setReelStates(prev => {
                            const next = [...prev];
                            next[i] = 'locked';
                            return next;
                        });
                    }, FLASH_DURATION);
                    timersRef.current.push(t2);
                }, LOCK_START + i * LOCK_INTERVAL);
                timersRef.current.push(t1);
            });
        } else {
            clearTimers(timersRef);
            setReelStates(['locked', 'locked', 'locked', 'locked']);
        }

        return () => clearTimers(timersRef);
    // digits.forEach uses only the index i, not the digit values — stale closure is safe here
    }, [isRolling]); // eslint-disable-line react-hooks/exhaustive-deps

    // -1 when value is 0000 — all reels show as inactive (dimmed)
    const firstActiveIndex = paddedValue.search(/[1-9]/);

    return (
        <div style={{ display: 'flex', gap: '4px', position: 'relative' }}>
            {digits.map((digit, i) => {
                const state = reelStates[i];
                const active = firstActiveIndex === -1 ? false : i >= firstActiveIndex;
                const isSpinning = state === 'spinning';
                const isLocking = state === 'locking';

                return (
                    <div
                        key={i}
                        className={isLocking ? 'reel-column--locking' : undefined}
                        style={{
                            width: 52,
                            height: REEL_HEIGHT,
                            overflow: 'hidden',
                            borderRadius: 4,
                            border: `1px solid ${active ? tier.border : 'rgba(255,255,255,0.06)'}`,
                            background: active
                                ? tier.surface
                                : 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.015) 100%)',
                            boxShadow: active ? tier.slotGlow : 'inset 0 1px 0 rgba(255,255,255,0.03)',
                            position: 'relative',
                        }}
                    >
                        <div
                            className={isSpinning ? 'reel-strip--spinning' : undefined}
                            style={{
                                position: 'absolute',
                                top: 0,
                                width: '100%',
                                transform: !isSpinning ? `translateY(${targetY(digit)}px)` : undefined,
                                transition: isLocking ? 'none' : undefined,
                            }}
                        >
                            {STRIP_DIGITS.map((d, j) => (
                                <div
                                    key={j}
                                    style={{
                                        height: REEL_HEIGHT,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontFamily: "'Black Ops One', serif",
                                        fontSize: '2.8rem',
                                        color: active ? tier.digitColor : 'rgba(255,255,255,0.22)',
                                        textShadow: active ? tier.textShadow : 'none',
                                        WebkitFontSmoothing: 'antialiased',
                                    }}
                                >
                                    {d}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default SlotReels;
