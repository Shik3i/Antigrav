import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Rss, Filter, Settings, ExternalLink, RefreshCw, AlertCircle, CheckCircle2, Circle, Layout, Zap, ChevronDown, ChevronRight, Monitor, X } from 'lucide-react';
import { fetchJson } from '../utils/apiClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNews } from '../context/NewsContext';

const News = () => {
    const { token } = useAuth();
    const { showToast } = useToast();
    const { feeds, rssPrefs, updateRssPreference, isSidebarCollapsed, toggleSidebar } = useNews();
    
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const loadArticles = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const articlesData = await fetchJson('/api/rss/articles', { token });
            setArticles(articlesData);
        } catch (err) {
            console.error('Failed to load news articles:', err);
            if (!isSilent) showToast('Fehler beim Laden der Nachrichten', 'error');
        } finally {
            if (!isSilent) setLoading(false);
        }
    }, [token, showToast]);

    useEffect(() => {
        loadArticles();
    }, [loadArticles]);

    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        try {
            await loadArticles();
            showToast('Nachrichten aktualisiert', 'success');
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleToggle = async (feedId, type, currentValue) => {
        const newValue = !currentValue;
        
        // Optimistic Update in Context
        updateRssPreference(feedId, type, newValue);

        // If we toggled 'site' to TRUE, we should re-fetch articles to get the new ones
        if (type === 'site' && newValue === true) {
            loadArticles(true); // silent refresh
        }
        
        showToast(newValue ? 'Feed aktiviert' : 'Feed deaktiviert', 'success');
    };

    // Performance Optimization: Memoize the grouping and sorting logic 
    // AND filter by showOnSite (for true optimistic feel)
    const filteredArticles = useMemo(() => {
        if (!Array.isArray(articles)) return [];
        return articles.filter(art => {
            const pref = rssPrefs[String(art.feedId)];
            if (pref) return pref.showOnSite;
            return true; // Default to visible
        });
    }, [articles, rssPrefs]);

    const groupedArticles = useMemo(() => {
        const grouped = filteredArticles.reduce((groups, art) => {
            const date = new Date(art.pubDate || art.cachedAt);
            const dateStr = date.toDateString();
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(art);
            return groups;
        }, {});

        return Object.entries(grouped)
            .sort((a, b) => new Date(b[0]) - new Date(a[0]))
            .map(([dateStr, groupArticles]) => {
                const date = new Date(dateStr);
                const today = new Date().toDateString();
                const yesterday = new Date(Date.now() - 86400000).toDateString();
                
                let label = dateStr;
                if (dateStr === today) label = "Heute";
                else if (dateStr === yesterday) label = "Gestern";
                else label = date.toLocaleDateString([], { day: '2-digit', month: 'long', year: 'numeric' });

                return {
                    dateStr,
                    label,
                    articles: groupArticles
                };
            });
    }, [filteredArticles]);

    return (
        <div className="news-page-container">
            <header className="news-header">
                <div className="news-header-title">
                    <div className="rss-icon-glow">
                        <Rss size={28} />
                    </div>
                    <div>
                        <h1>NEWS READER</h1>
                        <p>Deine personalisierten News-Feeds auf einen Blick</p>
                    </div>
                </div>

                <div className="news-header-meta">
                    <div className="news-header-actions">
                        <button 
                            className={`manage-feeds-btn ${!isSidebarCollapsed ? 'active' : ''}`}
                            onClick={toggleSidebar}
                            title="Feeds verwalten"
                        >
                            <Settings size={20} />
                            <span>Feeds</span>
                        </button>

                        <button 
                            className={`refresh-btn ${isRefreshing || loading ? 'spinning' : ''}`}
                            onClick={handleManualRefresh}
                            disabled={loading || isRefreshing}
                            title="Neu laden"
                        >
                            <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            </header>

            <div className={`news-layout-standard ${!isSidebarCollapsed ? 'sidebar-open' : ''}`}>
                <main className="news-articles-wall">
                    {loading ? (
                        <div className="news-loading-state">
                            <RefreshCw className="spinning" size={32} color="var(--accent-primary)" />
                            <p>Lade Nachrichten...</p>
                        </div>
                    ) : groupedArticles.length === 0 ? (
                        <div className="news-empty-state glass-card">
                            <Rss size={48} style={{ opacity: 0.2, marginBottom: '20px' }} />
                            <h3>Keine Nachrichten gefunden</h3>
                            <p>Entweder sind alle Feeds deaktiviert oder es gibt derzeit keine neuen Meldungen für deine Auswahl.</p>
                            <button className="btn-primary" onClick={() => loadArticles()} style={{ marginTop: '24px' }}>
                                Erneut versuchen
                            </button>
                        </div>
                    ) : (
                        <div className="news-articles-container">
                            {groupedArticles.map((group, groupIdx) => (
                                <div key={group.dateStr} className="news-date-group">
                                    <div className="news-date-separator">
                                        <div className="separator-line"></div>
                                        <span className="separator-label">{group.label}</span>
                                        <div className="separator-line"></div>
                                    </div>
                                    <div className="articles-masonry">
                                        {group.articles.map((art, i) => (
                                            <a 
                                                key={`${art?.id || i}-${groupIdx}-${i}`} 
                                                href={art?.link || '#'}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="news-article-card-full glass-card-premium animate-fade-in"
                                                style={{ animationDelay: `${i * 0.05}s` }}
                                            >
                                                {art?.imageUrl && (
                                                    <div className="article-hero-wrap">
                                                        <img src={art.imageUrl} alt="" className="article-hero" />
                                                        <div className="feed-badge-overlay">{art?.feedName || 'News'}</div>
                                                    </div>
                                                )}
                                                <div className="article-content">
                                                    {!art?.imageUrl && <div className="feed-name-tag">{art?.feedName || 'News'}</div>}
                                                    <div className="article-timestamp">
                                                        {art?.pubDate ? new Date(art.pubDate).toLocaleTimeString([], { 
                                                            hour: '2-digit', minute: '2-digit' 
                                                        }) : 'Unbekannt'} Uhr
                                                    </div>
                                                    <h2 className="article-title">{art?.title || 'Kein Titel'}</h2>
                                                    <p className="article-snippet">{art?.snippet || ''}</p>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </main>

                <aside className={`news-sidebar-drawer glass-card ${isSidebarCollapsed ? 'collapsed' : ''}`}>
                    <div className="drawer-header">
                        <h3><Filter size={18} /> Quellen</h3>
                        <button className="close-drawer" onClick={toggleSidebar}><X size={18} /></button>
                    </div>
                    
                    <div className="drawer-content">
                        <div className="feeds-list-vertical">
                            {Array.isArray(feeds) && feeds.map(feed => {
                                const pref = rssPrefs[String(feed.id)] || { showOnSite: true, showInTicker: feed.is_default };
                                const { showOnSite, showInTicker } = pref;
                                
                                return (
                                    <div key={feed.id} className={`feed-item-vertical ${showOnSite ? 'active' : ''}`}>
                                        <div className="feed-info-box" onClick={() => handleToggle(feed.id, 'site', showOnSite)}>
                                            <div className="feed-icon-small">
                                                {(() => {
                                                    const iconUrl = feed.icon || (feed.url ? `https://www.google.com/s2/favicons?domain=${new URL(feed.url).hostname}&sz=64` : null);
                                                    return iconUrl ? (
                                                        <img src={iconUrl} alt="" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
                                                    ) : (
                                                        <Rss size={14} />
                                                    );
                                                })()}
                                                <Rss size={14} style={{ display: 'none' }} />
                                            </div>
                                            <span className="feed-name-text">{feed.name}</span>
                                        </div>
                                        <div className="feed-actions-vertical">
                                            <button 
                                                className={`toggle-action site ${showOnSite ? 'active' : ''}`}
                                                onClick={() => handleToggle(feed.id, 'site', showOnSite)}
                                                title="Auf Seite"
                                            >
                                                <Layout size={14} />
                                            </button>
                                            <button 
                                                className={`toggle-action ticker ${showInTicker ? 'active' : ''}`}
                                                onClick={() => handleToggle(feed.id, 'ticker', showInTicker)}
                                                title="Im Ticker"
                                            >
                                                <Zap size={14} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="sidebar-hint" style={{ marginTop: '32px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-main)', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                <AlertCircle size={14} /> Hilfe & Symbole
                            </div>
                            <p style={{ margin: '4px 0', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                <Layout size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> 
                                <b>Blau:</b> Feed auf dieser Seite anzeigen.
                            </p>
                            <p style={{ margin: '4px 0', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                <Zap size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> 
                                <b>Gelb:</b> Feed in den unteren News-Ticker einspeisen.
                            </p>
                        </div>
                    </div>
                </aside>
            </div>

        </div>
    );
};

export default News;

