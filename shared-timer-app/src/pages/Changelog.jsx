import React, { useState, useEffect } from 'react';
import { History, Calendar, Github, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={index} style={{ color: 'var(--accent-primary)' }}>{part.substring(2, part.length - 2)}</strong>;
            }
            return part;
        });
    };

    return (
        <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 0', paddingBottom: '100px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <History size={32} color="var(--accent-primary)" />
                    <h1 style={{ margin: 0, fontSize: '2.5rem' }}>System Changelog</h1>
                </div>
                <a 
                    href="https://github.com/Shik3i/Antigrav" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="glass-card"
                    style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        padding: '8px 16px',
                        color: 'var(--text-muted)', 
                        textDecoration: 'none',
                        fontSize: '0.85rem',
                        transition: 'all 0.2s ease',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--accent-primary)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-muted)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                        e.currentTarget.style.transform = 'translateY(0)';
                    }}
                >
                    <Github size={16} />
                    <span>Private Repository</span>
                    <ExternalLink size={12} style={{ opacity: 0.5 }} />
                </a>
            </div>

            <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
                Track the latest updates, bug fixes, and improvements to the KoalaSync platform.
                This changelog is now automatically generated from system updates.
            </p>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>Loading changelog...</div>
            ) : entries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px' }} className="glass-card">
                    <p style={{ color: 'var(--text-muted)' }}>No changelog entries found yet.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {entries.map(entry => (
                        <div key={entry.id} className="glass-card slide-up" style={{ padding: '32px', position: 'relative' }}>
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                                    <div style={{ 
                                        background: 'var(--accent-gradient)', 
                                        color: 'white', 
                                        padding: '4px 12px', 
                                        borderRadius: '6px', 
                                        fontWeight: 800,
                                        fontSize: '0.9rem'
                                    }}>
                                        v{entry.version}
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Calendar size={14} />
                                        {new Date(entry.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                    </div>
                                </div>
                            </div>

                            <div style={{ 
                                background: 'rgba(255,255,255,0.02)', 
                                padding: '20px', 
                                borderRadius: '12px', 
                                border: '1px solid rgba(255,255,255,0.05)',
                                color: 'var(--text-main)',
                                fontSize: '1rem',
                                lineHeight: '1.7'
                            }}>
                                {entry.changes.split('\n').map((line, i) => {
                                    const trimmed = line.trim();
                                    const isBullet = trimmed.startsWith('-');
                                    const content = isBullet ? trimmed.substring(1).trim() : trimmed;
                                    
                                    return (
                                        <div key={i} style={{ 
                                            margin: '0 0 8px 0', 
                                            paddingLeft: isBullet ? '24px' : '0',
                                            position: 'relative'
                                        }}>
                                            {isBullet && (
                                                <span style={{ 
                                                    position: 'absolute', 
                                                    left: '4px', 
                                                    top: '0',
                                                    color: 'var(--accent-primary)',
                                                    fontWeight: 'bold'
                                                }}>•</span>
                                            )}
                                            {renderBoldText(content)}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Changelog;
