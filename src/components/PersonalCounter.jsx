import React, { useState, useEffect, useRef } from 'react';
import { Plus, RotateCcw, Clock, Target } from 'lucide-react';

const PersonalCounter = ({ totalCompletions }) => {
    const [count, setCount] = useState(() => parseInt(localStorage.getItem('anti_counter_val') || '0', 10));
    const [lastClickTime, setLastClickTime] = useState(() => parseInt(localStorage.getItem('anti_counter_time') || '0', 10));
    const [timersSinceClick, setTimersSinceClick] = useState(() => parseInt(localStorage.getItem('anti_counter_timers') || '0', 10));
    const [elapsedStr, setElapsedStr] = useState('--:--');

    const prevCompletionsRef = useRef(totalCompletions);

    useEffect(() => {
        localStorage.setItem('anti_counter_val', count.toString());
        localStorage.setItem('anti_counter_time', lastClickTime.toString());
        localStorage.setItem('anti_counter_timers', timersSinceClick.toString());
    }, [count, lastClickTime, timersSinceClick]);

    useEffect(() => {
        if (totalCompletions !== undefined && prevCompletionsRef.current !== undefined) {
            if (totalCompletions > prevCompletionsRef.current) {
                if (lastClickTime > 0) {
                    setTimersSinceClick(prev => prev + 1);
                }
            }
        }
        prevCompletionsRef.current = totalCompletions;
    }, [totalCompletions, lastClickTime]);

    useEffect(() => {
        if (!lastClickTime) {
            setElapsedStr('--:--');
            return;
        }

        const updateTick = () => {
            const diff = Date.now() - lastClickTime;
            const m = Math.floor(diff / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            const h = Math.floor(m / 60);
            const displayM = m % 60;
            if (h > 0) {
                setElapsedStr(`${h}h ${displayM}m`);
            } else {
                setElapsedStr(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
            }
        };

        updateTick();
        const int = setInterval(updateTick, 1000);
        return () => clearInterval(int);
    }, [lastClickTime]);

    const handleIncrement = () => {
        setCount(c => c + 1);
        setLastClickTime(Date.now());
        setTimersSinceClick(0);
    };

    const handleReset = () => {
        if (window.confirm('Reset personal counter?')) {
            setCount(0);
            setLastClickTime(0);
            setTimersSinceClick(0);
        }
    };

    return (
        <div className="glass-card animate-fade-in" style={{
            position: 'absolute',
            bottom: '24px',
            left: '24px',
            padding: '16px',
            borderRadius: '16px',
            width: '240px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            zIndex: 50,
            border: '1px solid rgba(255,255,255,0.1)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Counter</span>
                <button className="btn-ghost" style={{ padding: '4px', height: 'auto' }} onClick={handleReset} title="Reset Counter">
                    <RotateCcw size={14} />
                </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--accent-primary)', lineHeight: 1 }}>
                    {count}
                </div>
                <button
                    className="btn-primary"
                    style={{ width: '48px', height: '48px', borderRadius: '50%', padding: 0, justifyContent: 'center' }}
                    onClick={handleIncrement}
                >
                    <Plus size={24} />
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> Time since last</span>
                    <span style={{ color: 'var(--text-main)', fontFamily: 'monospace', fontSize: '0.85rem' }}>{elapsedStr}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Target size={12} /> Timers since last</span>
                    <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{timersSinceClick}</span>
                </div>
            </div>
        </div>
    );
};

export default PersonalCounter;
