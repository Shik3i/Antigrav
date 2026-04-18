import React, { useState, useEffect, useMemo } from 'react';
import { Rss, Filter, Settings, ExternalLink, RefreshCw, AlertCircle, CheckCircle2, Circle } from 'lucide-react';
import { fetchJson } from '../utils/apiClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const News = () => {
    const { token } = useAuth();
    const { showToast } = useToast();
    const [feeds, setFeeds] = useState([]);
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        loadData();
    }, [token]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [feedsData, articlesData] = await Promise.all([
                fetchJson('/api/rss/feeds'),
                fetchJson('/api/rss/articles', { token })
            ]);
            
            setFeeds(feedsData);
            setArticles(articlesData);
        } catch (err) {
            console.error('Failed to load news:', err);
            showToast('Fehler beim Laden der Nachrichten', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        try {
            await loadData();
            showToast('Nachrichten aktualisiert', 'success');
        } finally {
            setIsRefreshing(false);
        }
    };

    const toggleFeed = async (feedId) => {
        if (!token) {
            showToast('Bitte einloggen, um Filter zu speichern', 'info');
            return;
        }

        const isCurrentlyVisible = articles.some(a => a.feedId === feedId);
        const newIsHidden = isCurrentlyVisible;

        try {
            await fetchJson('/api/rss/preferences', {
                method: 'POST',
                token,
                body: JSON.stringify({ feedId, isHidden: newIsHidden })
            });

            const updatedArticles = await fetchJson('/api/rss/articles', { token });
            setArticles(updatedArticles);
            
            showToast(newIsHidden ? 'Feed ausgeblendet' : 'Feed eingeblendet', 'success');
        } catch (err) {
            showToast('Fehler beim Speichern der Präferenz', 'error');
        }
    };

    // Performance Optimization: Memoize the grouping and sorting logic
    const groupedArticles = useMemo(() => {
        if (!Array.isArray(articles)) return [];
        
        const grouped = articles.reduce((groups, art) => {
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
    }, [articles]);

    return (
        <div className="news-page-container">
            <header className="news-header">
                <div className="news-header-title">
                    <div className="rss-icon-glow">
                        <Rss size={32} />
                    </div>
                    <div>
                        <h1>Global News Reader</h1>
                        <p>Bleibe auf dem Laufenden mit deinen favorisierten Quellen</p>
                    </div>
                </div>
                <div className="news-header-actions">
                    <button 
                        className={`refresh-btn ${isRefreshing ? 'spinning' : ''}`}
                        onClick={handleManualRefresh}
                        disabled={loading}
                        title="Neu laden"
                    >
                        <RefreshCw size={20} />
                    </button>
                </div>
            </header>

            <div className="news-layout-main">
                <aside className="news-filters-sidebar glass-card">
                    <div className="sidebar-group">
                        <h3 className="flex-between">
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Filter size={18} /> Feed Quellen
                            </span>
                        </h3>
                        <div className="feeds-list">
                            {Array.isArray(feeds) && feeds.map(feed => {
                                const isVisible = Array.isArray(articles) && articles.some(a => a?.feedId === feed?.id);
                                return (
                                    <div 
                                        key={feed.id} 
                                        className={`feed-source-item ${isVisible ? 'active' : 'hidden'}`}
                                        onClick={() => toggleFeed(feed.id)}
                                    >
                                        <div className="feed-source-icon">
                                            {feed.icon ? (
                                                <img src={feed.icon} alt="" />
                                            ) : (
                                                <Rss size={16} />
                                            )}
                                        </div>
                                        <span className="feed-source-name">{feed.name}</span>
                                        <div className="feed-source-toggle">
                                            {isVisible ? <CheckCircle2 size={16} color="var(--accent-primary)" /> : <Circle size={16} color="var(--text-muted)" />}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="sidebar-hint">
                        <AlertCircle size={14} />
                        Klicke auf eine Quelle, um sie ein- oder auszublenden.
                    </div>
                </aside>

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
                            <p>Entweder sind alle Feeds ausgeblendet oder es gibt derzeit keine neuen Meldungen für deine Auswahl.</p>
                            <button className="btn-primary" onClick={loadData} style={{ marginTop: '24px' }}>
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
                                                    <div className="article-footer-info">
                                                        <span className="read-more">Bericht lesen</span>
                                                        <ExternalLink size={14} />
                                                    </div>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default News;
