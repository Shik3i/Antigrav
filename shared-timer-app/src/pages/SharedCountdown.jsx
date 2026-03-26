import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

const SharedCountdown = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const query = new URLSearchParams(location.search);
    const title = query.get('title') || 'Countdown';
    const target = query.get('target') ? parseInt(query.get('target')) : null;
    
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false });

    useEffect(() => {
        if (!target) return;

        const calculateTime = () => {
            const now = new Date().getTime();
            const diff = target - now;

            if (diff <= 0) {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            setTimeLeft({ days, hours, minutes, seconds, expired: false });
        };

        calculateTime();
        const interval = setInterval(calculateTime, 1000);
        return () => clearInterval(interval);
    }, [target]);

    if (!target) {
        return (
            <div 
                style={{ 
                    position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--bg-color)', color: 'var(--text-main)', fontFamily: 'Inter, system-ui, sans-serif', zIndex: 9999
                }}
            >
                <h1 style={{ fontWeight: 300, opacity: 0.6 }}>Invalid Countdown</h1>
            </div>
        );
    }

    return (
        <div 
            style={{
                position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                background: 'var(--bg-color)', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', 
                alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', padding: '20px',
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif', zIndex: 9999, overflow: 'hidden'
            }}
        >
            {/* Close Button */}
            <button 
                onClick={() => navigate('/')}
                style={{
                    position: 'absolute', top: '2rem', right: '2rem', cursor: 'pointer', opacity: 0.5, 
                    transition: 'opacity 0.22s cubic-bezier(0.4, 0, 0.2, 1)', color: 'var(--text-main)', 
                    background: 'transparent', border: 'none', padding: '8px', zIndex: 10000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}
            >
                <X size={32} strokeWidth={1} />
            </button>

            {/* Title */}
            <h1 style={{ 
                fontSize: 'clamp(1rem, 3vw, 1.8rem)', fontWeight: 300, letterSpacing: '3px',
                margin: '0 0 40px 0', textAlign: 'center', maxWidth: '90%', color: 'var(--text-muted)', textTransform: 'uppercase'
            }}>
                {title}
            </h1>

            {/* Main Timer Display */}
            <div style={{ display: 'flex', gap: 'clamp(10px, 4vw, 40px)', alignItems: 'baseline', flexWrap: 'wrap', justifyContent: 'center' }}>
                {timeLeft.expired ? (
                    <div style={{ 
                        fontSize: 'clamp(2.5rem, 12vw, 7rem)', fontWeight: 200, letterSpacing: '4px',
                        color: 'var(--text-main)', textTransform: 'uppercase', textAlign: 'center'
                    }}>
                        Time's up
                    </div>
                ) : (
                    <>
                        <TimeUnit value={timeLeft.days} label="TAGE" />
                        <TimeUnit value={timeLeft.hours} label="STUNDEN" />
                        <TimeUnit value={timeLeft.minutes} label="MINUTEN" />
                        <TimeUnit value={timeLeft.seconds} label="SEKUNDEN" />
                    </>
                )}
            </div>
        </div>
    );
};

const TimeUnit = ({ value, label }) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 'clamp(4px, 1vw, 10px)' }}>
        <div style={{ 
            fontSize: 'clamp(3rem, 10vw, 8rem)', fontWeight: 200, 
            fontVariantNumeric: 'tabular-nums', lineHeight: 1, color: 'var(--text-main)'
        }}>
            {String(value).padStart(2, '0')}
        </div>
        <div style={{ 
            fontSize: 'clamp(0.6rem, 1.5vw, 0.9rem)', fontWeight: 500, 
            textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)',
            alignSelf: 'flex-end', marginBottom: 'clamp(5px, 2vw, 20px)'
        }}>
            {label}
        </div>
    </div>
);

export default SharedCountdown;
