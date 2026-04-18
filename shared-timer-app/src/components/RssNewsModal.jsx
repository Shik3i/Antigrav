import React from 'react';
import { X, ExternalLink, Rss, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const RssNewsModal = ({ isOpen, onClose, news }) => {
    if (!isOpen) return null;

    // Handle background click to close
    const handleOverlayClick = (e) => {
        if (e.target.className === 'rss-modal-overlay') {
            onClose();
        }
    };

    return (
        <div className="rss-modal-overlay" onClick={handleOverlayClick}>
            <div className="rss-modal-content">
                <div className="rss-modal-header">
                    <h3>
                        <Rss size={20} style={{ color: 'var(--accent-primary)' }} />
                        Aktuelle News (Tagesschau)
                    </h3>
                    <button className="rss-modal-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="rss-modal-body">
                    {news.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            Lade Nachrichten...
                        </div>
                    ) : (
                        news.map((item, idx) => (
                            <a 
                                key={idx}
                                href={item.link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="rss-article-card"
                            >
                                {item.imageUrl ? (
                                    <img src={item.imageUrl} alt="" className="rss-article-img" />
                                ) : (
                                    <div className="rss-article-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)' }}>
                                        <Rss size={20} style={{ opacity: 0.3 }} />
                                    </div>
                                )}
                                <div className="rss-article-info">
                                    <span className="rss-article-title">{item.title}</span>
                                    <span className="rss-article-date">
                                        {new Date(item.pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Uhr
                                    </span>
                                </div>
                                <ExternalLink size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '4px' }} />
                            </a>
                        ))
                    )}
                </div>

                <Link to="/news" className="rss-full-news-btn" onClick={onClose}>
                    Alle Feeds anzeigen <ArrowRight size={14} style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
                </Link>
            </div>
        </div>
    );
};

export default RssNewsModal;
