import React from 'react';
import * as LucideIcons from 'lucide-react';

const RSSFeedsTab = ({
    rssFeeds,
    rssStats,
    rssArticles,
    refreshingRss,
    onAddFeed,
    onUpdateFeed,
    onDeleteFeed,
    onManualRefresh,
    onPurgeCache,
    onDeleteArticle
}) => {
    return (
        <div className="glass-card animate-fade-in" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h3 style={{ margin: 0 }}>RSS Feed Quellen</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>Verwalte die globalen News-Quellen für alle User.</p>
                </div>
                <button className="btn-primary" onClick={() => {
                    const name = prompt("Name des Feeds (z.B. BBC News):");
                    const url = prompt("RSS URL:");
                    const icon = prompt("Icon URL (optional):");
                    if (name && url) onAddFeed(name, url, icon);
                }}>
                   <LucideIcons.Plus size={18} /> Feed hinzufügen
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '48px' }}>
                {!Array.isArray(rssFeeds) || rssFeeds.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Keine RSS-Feeds konfiguriert oder Fehler beim Laden.</div>
                ) : (
                    rssFeeds.map((feed, index) => (
                        <div key={feed?.id || index} className="glass-card" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <div style={{ width: '48px', height: '48px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                    {(() => {
                                        const iconUrl = feed?.icon || (feed?.url ? `https://www.google.com/s2/favicons?domain=${new URL(feed.url).hostname}&sz=64` : null);
                                        return iconUrl ? (
                                            <img 
                                                src={iconUrl} 
                                                alt="" 
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                                onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.querySelector('.fallback-rss-icon').style.display = 'block'; }}
                                            />
                                        ) : null;
                                    })()}
                                    <div className="fallback-rss-icon" style={{ display: feed?.icon || feed?.url ? 'none' : 'block' }}>
                                        <LucideIcons.Rss size={24} color="var(--text-muted)" />
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{feed?.name || 'Unbenannter Feed'} {feed?.is_default ? <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>DEFAULT</span> : null}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '4px' }}>{feed?.url || 'Keine URL'}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '4px' }}>
                                        {rssStats.find(s => s.id === feed.id)?.articleCount || 0} Artikel im Cache
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button className="btn-secondary" style={{ padding: '8px 16px' }} onClick={() => {
                                    const name = prompt("Name:", feed?.name || '');
                                    const url = prompt("URL:", feed?.url || '');
                                    const icon = prompt("Icon URL:", feed?.icon || '');
                                    if (name && url) onUpdateFeed(feed?.id, name, url, icon);
                                }}>Edit</button>
                                {!feed?.is_default && (
                                    <button className="btn-ghost" style={{ padding: '8px 16px', color: '#ef4444' }} onClick={() => onDeleteFeed(feed?.id)}>
                                        <LucideIcons.Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '48px', marginTop: '48px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                        <h3 style={{ margin: 0 }}>News Artikel-Datenbank</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                            Hier werden alle geladenen Artikel persistiert. Automatischer Cleanup erfolgt alle 7 Tage.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="btn-secondary" onClick={onManualRefresh} disabled={refreshingRss}>
                            <LucideIcons.RefreshCw className={refreshingRss ? "spinning" : ""} size={16} style={{ marginRight: '8px' }} />
                            {refreshingRss ? "Aktualisiere..." : "Vollständiger Feed-Refresh"}
                        </button>
                        <button className="btn-ghost" style={{ color: '#ef4444', border: '1px solid #ef444420' }} onClick={() => onPurgeCache()}>
                            Alles leeren (Purge)
                        </button>
                        <button className="btn-ghost" style={{ color: '#f59e0b', border: '1px solid #f59e0b20' }} onClick={() => onPurgeCache(24)}>
                            Alles &gt; 24h löschen
                        </button>
                    </div>
                </div>

                <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.1)', borderRadius: '12px', padding: '4px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: '16px', color: 'var(--text-muted)' }}>Quelle</th>
                                <th style={{ padding: '16px', color: 'var(--text-muted)' }}>Titel</th>
                                <th style={{ padding: '16px', color: 'var(--text-muted)' }}>Cached am</th>
                                <th style={{ padding: '16px', textAlign: 'right', color: 'var(--text-muted)' }}>Aktion</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rssArticles.length === 0 ? (
                                <tr><td colSpan="4" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Keine Artikel in der Datenbank.</td></tr>
                            ) : (
                                rssArticles.map(art => (
                                    <tr key={art.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                        <td style={{ padding: '16px' }}>
                                            <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>{art.feedName}</span>
                                        </td>
                                        <td style={{ padding: '16px', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            <a href={art.link} target="_blank" rel="noreferrer" style={{ color: 'var(--text-main)', textDecoration: 'none' }}>{art.title}</a>
                                        </td>
                                        <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{new Date(art.cachedAt).toLocaleString()}</td>
                                        <td style={{ padding: '16px', textAlign: 'right' }}>
                                            <button className="btn-ghost" style={{ color: '#ef4444', padding: '4px' }} onClick={() => onDeleteArticle(art.id)}>
                                                <LucideIcons.Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default RSSFeedsTab;
