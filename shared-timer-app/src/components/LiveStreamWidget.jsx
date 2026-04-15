import React, { useState, useEffect, useRef } from 'react';
import { Tv, X, Minimize2, Maximize2, Move, Settings, Play } from 'lucide-react';
import { fetchJson } from '../utils/apiClient';
import { isLiveStreamWidgetVisible } from '../utils/clientStorage';
import { usePageVisibility } from '../hooks/usePageVisibility';

const LiveStreamWidget = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isPlayerOpen, setIsPlayerOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [activeChannel, setActiveChannel] = useState(null);
    const [channelStatus, setChannelStatus] = useState([]);
    const [showWidget, setShowWidget] = useState(() => {
        return isLiveStreamWidgetVisible();
    });
    const isVisible = usePageVisibility();
    
    const [position, setPosition] = useState({ x: window.innerWidth - 420, y: window.innerHeight - 300 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const widgetRef = useRef(null);
    const menuRef = useRef(null);

    const channels = [
        { id: 'handofblood', name: 'HandOfBlood' },
        { id: 'eintrachtspandau', name: 'Eintracht Spandau' },
        { id: 'tolkin', name: 'Tolkin' },
        { id: 'lec', name: 'LEC' },
        { id: 'lck', name: 'LCK' },
        { id: 'riotgames', name: 'Riot Games' },
        { id: 'primeleague', name: 'Prime League' }
    ];

    const fetchStatus = async () => {
        try {
            const data = await fetchJson('/api/twitch/status', { token: '' });
            setChannelStatus(data);
        } catch (e) {
            console.error('Failed to fetch Twitch status', e);
        }
    };

    useEffect(() => {
        if (!showWidget) return undefined;
        fetchStatus();
        const interval = setInterval(fetchStatus, isVisible ? 60000 : 5 * 60000);
        return () => clearInterval(interval);
    }, [isVisible, showWidget]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target) && !e.target.closest('.stream-trigger')) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const handleStorageChange = () => {
            setShowWidget(isLiveStreamWidgetVisible());
        };
        window.addEventListener('storage', handleStorageChange);
        // Custom event for same-window updates from Settings
        window.addEventListener('settings_update', handleStorageChange);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('settings_update', handleStorageChange);
        };
    }, []);

    const handleMouseDown = (e) => {
        if (e.target.closest('.drag-handle')) {
            setIsDragging(true);
            dragStartPos.current = {
                x: e.clientX - position.x,
                y: e.clientY - position.y
            };
            e.preventDefault();
        }
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isDragging) {
                const newX = e.clientX - dragStartPos.current.x;
                const newY = e.clientY - dragStartPos.current.y;
                
                // Keep within bounds
                const maxX = window.innerWidth - (isMinimized ? 60 : 400);
                const maxY = window.innerHeight - (isMinimized ? 60 : 250);
                
                setPosition({
                    x: Math.max(0, Math.min(newX, maxX)),
                    y: Math.max(0, Math.min(newY, maxY))
                });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isMinimized]);

    const getEmbedUrl = (url) => {
        if (!url) return '';
        
        // Twitch
        if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
            const channel = url.includes('twitch.tv/') ? url.split('twitch.tv/')[1].split('/')[0] : url;
            return `https://player.twitch.tv/?channel=${channel.trim()}&parent=${window.location.hostname}&muted=true`;
        }
        
        // YouTube
        let videoId = '';
        if (url.includes('v=')) videoId = url.split('v=')[1].split('&')[0];
        else if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].split('?')[0];
        
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`;
    };

    const handleSelectChannel = (channel) => {
        setActiveChannel(channel);
        setIsPlayerOpen(true);
        setIsMenuOpen(false);
        setIsMinimized(false);
    };

    const getStatusFor = (id) => channelStatus.find(s => s.user_login.toLowerCase() === id.toLowerCase());
    const liveCount = channels.filter(ch => {
        const s = getStatusFor(ch.id);
        return s && s.is_live;
    }).length;

    if (!showWidget) return null;

    return (
        <div style={{ zIndex: 1000 }}>
            {/* Floating Trigger Button */}
            <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="glass-card animate-fade-in stream-trigger"
                aria-label="Stream umschalten"
                style={{
                    position: 'fixed',
                    bottom: '80px',
                    right: '24px',
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isPlayerOpen ? 'var(--accent-gradient)' : 'rgba(15, 23, 42, 0.8)',
                    color: 'white',
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    cursor: 'pointer',
                    zIndex: 1001,
                    transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => {
                    setIsMenuOpen(true);
                    e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={e => {
                    e.currentTarget.style.transform = 'scale(1)';
                }}
            >
                <Tv size={24} color={isPlayerOpen ? 'white' : 'var(--accent-primary)'} />
                
                {liveCount > 0 && (
                    <div style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        background: '#ef4444',
                        color: 'white',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)',
                        border: '2px solid var(--bg-main)',
                        zIndex: 1002
                    }}>
                        {liveCount}
                    </div>
                )}
            </button>

            {/* Channel Selection Menu */}
            {isMenuOpen && (
                <div 
                    ref={menuRef}
                    className="glass-card animate-scale-in"
                    style={{
                        position: 'fixed',
                        bottom: '145px',
                        right: '24px',
                        width: '240px',
                        padding: '12px',
                        zIndex: 1002,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        border: '1px solid var(--border-color)',
                        boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
                        backgroundColor: 'rgba(15, 23, 42, 0.95)'
                    }}
                >
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em' }}>
                        Live Channels
                    </div>
                    {channels.map(ch => {
                        const status = getStatusFor(ch.id);
                        const isLive = status?.is_live;
                        return (
                            <button
                                key={ch.id}
                                disabled={!isLive}
                                onClick={() => handleSelectChannel(ch.id)}
                                className="btn-ghost"
                                style={{ 
                                    justifyContent: 'space-between', 
                                    padding: '10px 12px', 
                                    opacity: isLive ? 1 : 0.5,
                                    cursor: isLive ? 'pointer' : 'not-allowed',
                                    borderRadius: '8px',
                                    backgroundColor: activeChannel === ch.id && isPlayerOpen ? 'rgba(59, 130, 246, 0.1)' : 'transparent'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isLive ? '#10b981' : '#64748b' }} />
                                    <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{ch.name}</span>
                                </div>
                                {isLive && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{Math.round(status.viewer_count / 100) / 10}k</span>}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Video Player Widget */}
            {isPlayerOpen && (
                <div 
                    ref={widgetRef}
                    className="glass-card animate-scale-in"
                    style={{
                        position: 'fixed',
                        left: `${position.x}px`,
                        top: `${position.y}px`,
                        width: isMinimized ? '60px' : '400px',
                        height: isMinimized ? '60px' : '260px',
                        zIndex: 1000,
                        overflow: 'hidden',
                        borderRadius: '16px',
                        border: '1px solid var(--border-color)',
                        boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
                        display: 'flex',
                        flexDirection: 'column',
                        transition: isDragging ? 'none' : 'width 0.3s ease, height 0.3s ease',
                        backgroundColor: 'rgba(15, 23, 42, 0.9)'
                    }}
                >
                    {/* Header / Drag Handle */}
                    <div 
                        className="drag-handle"
                        onMouseDown={handleMouseDown}
                        style={{
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0 12px',
                            background: 'rgba(255,255,255,0.05)',
                            cursor: 'move',
                            userSelect: 'none'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Move size={14} color="var(--text-muted)" />
                            {!isMinimized && <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{activeChannel}</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button 
                                className="btn-ghost" 
                                style={{ padding: '4px' }} 
                                onClick={() => setIsMinimized(!isMinimized)}
                                aria-label={isMinimized ? "Fenster vergrößern" : "Fenster minimieren"}
                            >
                                {isMinimized ? <Maximize2 size={14} color="var(--text-muted)" /> : <Minimize2 size={14} color="var(--text-muted)" />}
                            </button>
                            <button 
                                className="btn-ghost" 
                                style={{ padding: '4px' }} 
                                onClick={() => setIsPlayerOpen(false)}
                                aria-label="Stream schließen"
                            >
                                <X size={14} color="#ef4444" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    {!isMinimized && (
                        <div style={{ flex: 1, position: 'relative', background: 'black' }}>
                            <iframe
                                src={getEmbedUrl(activeChannel)}
                                height="100%"
                                width="100%"
                                frameBorder="0"
                                scrolling="no"
                                allowFullScreen={true}
                                title="Live Stream"
                            />
                        </div>
                    )}
                    
                    {isMinimized && (
                        <div 
                            onClick={() => setIsMinimized(false)}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        >
                            <Tv size={24} color="var(--accent-primary)" className="animate-pulse" />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default LiveStreamWidget;
