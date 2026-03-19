import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

// Get current week number
function getWeekNumber(d) {
    // Copy date so don't modify original
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    // Set to nearest Thursday: current date + 4 - current day number
    // Make Sunday's day number 7
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    // Get first day of year
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    // Calculate full weeks to nearest Thursday
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

const ClockWidget = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const [isHovered, setIsHovered] = useState(false);

    // Format strings
    const hhmm = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const fullTime = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const weekday = time.toLocaleDateString([], { weekday: 'long' });
    const weekNum = getWeekNumber(time);

    // Get Timezone string safely
    let tzString = '';
    try {
        tzString = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e) {
        tzString = 'Local Time';
    }

    const hoverText = `${fullTime} | ${weekday} | KW: ${weekNum} | ${tzString}`;

    return (
        <div
            style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'var(--text-main)',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    background: isHovered ? 'rgba(59, 130, 246, 0.15)' : 'rgba(20, 24, 30, 0.4)',
                    backdropFilter: 'blur(12px)',
                    border: `1px solid ${isHovered ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                    padding: '8px 16px',
                    borderRadius: '50px',
                    transition: 'all 0.3s ease',
                    cursor: 'default',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                }}
            >
                <Clock size={16} color="var(--accent-primary)" />
                <span style={{ fontFamily: 'monospace', fontSize: '1.05rem', letterSpacing: '0.5px' }}>{hhmm}</span>
            </div>

            {isHovered && (
                <div
                    className="animate-fade-in"
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        right: 0,
                        background: 'rgba(20, 24, 30, 0.95)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid var(--border-color)',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        color: 'var(--text-main)',
                        fontSize: '0.85rem',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                        zIndex: 1000,
                        pointerEvents: 'none'
                    }}
                >
                    {hoverText}
                </div>
            )}
        </div>
    );
};

export default ClockWidget;
