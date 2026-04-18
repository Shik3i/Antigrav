import React, { useState, useEffect, useMemo } from 'react';
import { History, Calendar, Github, ExternalLink, GitCommit, Info, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ChangelogActivityGraph = ({ entries }) => {
    const activityData = useMemo(() => {
        const counts = {};
        entries.forEach(entry => {
            const date = entry.date; // already YYYY-MM-DD
            counts[date] = (counts[date] || 0) + 1;
        });
        return counts;
    }, [entries]);

    const weeks = useMemo(() => {
        const result = [];
        const today = new Date();
        
        const currentDay = today.getDay(); 
        const lastSunday = new Date(today);
        lastSunday.setDate(today.getDate() + (currentDay === 0 ? 0 : 7 - currentDay));
        
        // Generate 4 weeks (28 days) moving backwards from lastSunday
        for (let w = 0; w < 4; w++) {
            const week = [];
            for (let d = 0; d < 7; d++) {
                const date = new Date(lastSunday);
                date.setDate(lastSunday.getDate() - (w * 7 + (6 - d)));
                const dateStr = date.toISOString().split('T')[0];
                week.push({
                    date: dateStr,
                    count: activityData[dateStr] || 0,
                    isToday: dateStr === today.toISOString().split('T')[0]
                });
            }
            result.unshift(week);
        }
        return result;
    }, [activityData]);

    const getColor = (count) => {
        if (count === 0) return 'rgba(255, 255, 255, 0.05)';
        if (count === 1) return 'rgba(59, 130, 246, 0.3)';
        if (count === 2) return 'rgba(59, 130, 246, 0.6)';
        return 'var(--accent-primary)';
    };

    return (
        <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center',
            width: 'auto',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--accent-primary)', fontSize: '0.6rem' }}>
                <TrendingUp size={10} />
                <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Recent Pulse</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {weeks.map((week, wIndex) => (
                    <div key={wIndex} style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                        {week.map((day, dIndex) => (
                            <div 
                                key={dIndex}
                                title={`${day.date}: ${day.count} changes`}
                                style={{ 
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '1.5px',
                                    background: getColor(day.count),
                                    border: day.isToday ? '1px solid white' : 'none',
                                    transition: 'transform 0.1s',
                                    cursor: 'pointer'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.3)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

const Changelog = () => {
    const { user } = useAuth();
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchChangelog();
    }, []);

    const fetchChangelog = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/changelog');
            const data = await res.json();
            if (res.ok) {
                // Entries are now fetched from the automated changelog.json file via API
                setEntries(data);
            } else {
                setError(data.error || 'Failed to fetch changelog');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    const renderBoldText = (text) => {
        if (!text) return '';
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, index) => {
            if (part && part.startsWith('**') && part.endsWith('**')) {
                return (
                    <strong key={index} style={{ 
                        color: 'var(--accent-primary)', 
                        fontWeight: 700,
                        textShadow: '0 0 10px rgba(59, 130, 246, 0.2)' 
                    }}>
                        {part.substring(2, part.length - 2)}
                    </strong>
                );
            }
            return part;
        });
    };

    return (
        <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 20px', paddingBottom: '100px' }}>
            <header style={{ marginBottom: '40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '20px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div className="glass-card" style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', background: 'var(--accent-gradient)', color: 'white' }}>
                            <History size={32} />
                        </div>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '2.5rem', lineHeight: 1.1 }}>System Changelog</h1>
                            <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                                Engineering log of the KoalaSync ecosystem.
                            </p>
                        </div>
                    </div>
                </div>

                {!loading && (
                    <div className="glass-card" style={{ 
                        padding: '16px 24px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        gap: '24px',
                        flexWrap: 'wrap',
                        border: '1px solid rgba(255,255,255,0.08)'
                    }}>
                            <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Total Logs</span>
                                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{entries.length}</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Latest Build</span>
                                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>v{entries[0]?.version}</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Vom</span>
                                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                        {entries[0]?.date ? new Date(entries[0].date).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' }) : '--.--'}
                                    </span>
                                </div>
                            </div>

                        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: '200px' }}>
                            <ChangelogActivityGraph entries={entries} />
                        </div>

                        <a 
                            href="https://github.com/Shik3i/Antigrav" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '10px', 
                                padding: '10px 16px',
                                color: 'var(--text-main)', 
                                textDecoration: 'none',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                transition: 'all 0.2s ease',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '10px',
                                background: 'rgba(255,255,255,0.02)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'var(--accent-primary)';
                                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                                e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                            }}
                        >
                            <Github size={16} />
                            <span>Source Code</span>
                            <ExternalLink size={12} style={{ opacity: 0.5 }} />
                        </a>
                    </div>
                )}
            </header>

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '60px' }}>
                    <div className="animate-spin" style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%' }} />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Retrieving logs...</span>
                </div>
            ) : entries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px' }} className="glass-card">
                    <History size={48} style={{ opacity: 0.1, marginBottom: '16px' }} />
                    <p style={{ color: 'var(--text-muted)' }}>The annals are empty. No logs found.</p>
                </div>
            ) : (
                <div style={{ position: 'relative' }}>
                    {/* Timeline Line */}
                    <div style={{ 
                        position: 'absolute', 
                        left: '40px', 
                        top: '0', 
                        bottom: '0', 
                        width: '2px', 
                        background: 'linear-gradient(to bottom, var(--accent-primary) 0%, rgba(255,255,255,0.05) 100%)',
                        opacity: 0.2,
                        zIndex: 0
                    }} />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                        {entries.map((entry, index) => {
                            const isFirstOfDate = index === 0 || entries[index - 1].date !== entry.date;
                            
                            return (
                                <div key={entry.id} className="slide-up" style={{ animationDelay: `${index * 50}ms`, position: 'relative', zIndex: 1 }}>
                                    <div style={{ display: 'flex', gap: '32px' }}>
                                        {/* Timeline Marker (Only for first entry of date) */}
                                        <div style={{ flexShrink: 0, width: '82px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            {isFirstOfDate ? (
                                                <>
                                                    <div style={{ 
                                                        width: '16px', 
                                                        height: '16px', 
                                                        borderRadius: '50%', 
                                                        background: 'var(--bg-color)',
                                                        border: '3px solid var(--accent-primary)',
                                                        boxShadow: '0 0 10px var(--accent-primary)',
                                                        marginBottom: '12px',
                                                        zIndex: 2
                                                    }} />
                                                    <div style={{ 
                                                        fontSize: '0.8rem', 
                                                        fontWeight: 700, 
                                                        color: 'var(--accent-primary)', 
                                                        textAlign: 'center',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.05em'
                                                    }}>
                                                        {new Date(entry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                    </div>
                                                </>
                                            ) : (
                                                <div style={{ 
                                                    width: '8px', 
                                                    height: '8px', 
                                                    borderRadius: '50%', 
                                                    background: 'rgba(255,255,255,0.1)',
                                                    marginTop: '16px',
                                                    zIndex: 1
                                                }} />
                                            )}
                                        </div>

                                        {/* Content Card */}
                                        <div className="glass-card" style={{ flex: 1, padding: '24px 32px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                                            <div style={{ 
                                                background: 'rgba(59, 130, 246, 0.1)', 
                                                color: 'var(--accent-primary)', 
                                                padding: '4px 12px', 
                                                borderRadius: '20px', 
                                                fontWeight: 800,
                                                fontSize: '0.8rem',
                                                border: '1px solid rgba(59, 130, 246, 0.2)'
                                            }}>
                                                VERSION {entry.version}
                                            </div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>
                                                {new Date(entry.date).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                            </div>
                                        </div>

                                        <div style={{ color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: '1.8' }}>
                                            {entry.changes.split('\n').map((line, i) => {
                                                const trimmed = line.trim();
                                                if (!trimmed) return null;
                                                const isBullet = trimmed.startsWith('-');
                                                const content = isBullet ? trimmed.substring(1).trim() : trimmed;
                                                
                                                return (
                                                    <div key={i} style={{ 
                                                        margin: '0 0 12px 0', 
                                                        paddingLeft: isBullet ? '28px' : '0',
                                                        position: 'relative'
                                                    }}>
                                                        {isBullet && (
                                                            <GitCommit size={14} style={{ 
                                                                position: 'absolute', 
                                                                left: '4px', 
                                                                top: '6px',
                                                                color: 'var(--accent-primary)',
                                                                opacity: 0.7
                                                            }} />
                                                        )}
                                                        {renderBoldText(content)}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Changelog;
