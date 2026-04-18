import React, { useEffect, useState, useRef } from 'react';
import { Rss } from 'lucide-react';
import { usePageVisibility } from '../hooks/usePageVisibility';
import { useNews } from '../context/NewsContext';
import RssNewsModal from './RssNewsModal';

const NewsTicker = ({ socket }) => {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const isVisible = usePageVisibility();
    const { rssPrefs } = useNews();
    const lastTickerPrefsRef = useRef('');

    useEffect(() => {
        if (!socket) return;

        const handleNews = (data) => {
            if (Array.isArray(data)) {
                setNews(data);
            }
            setLoading(false);
        };

        socket.on('api_news_data', handleNews);

        const fetchNews = () => {
            if (socket.connected) socket.emit('get_api_news');
        };

        // Trigger fetch on mount, connect, or when prefs change
        fetchNews();
        socket.on('connect', fetchNews);

        // Refresh every 10 minutes
        const interval = setInterval(fetchNews, isVisible ? 10 * 60 * 1000 : 30 * 60 * 1000);
        
        return () => {
            socket.off('api_news_data', handleNews);
            socket.off('connect', fetchNews);
            clearInterval(interval);
        };
    }, [isVisible, socket]);

    // Detect changes in ticker-specific preferences to trigger immediate refresh
    useEffect(() => {
        const tickerPrefsString = Object.entries(rssPrefs)
            .filter(([_, p]) => p.showInTicker)
            .map(([id]) => id)
            .sort()
            .join(',');
        
        if (tickerPrefsString !== lastTickerPrefsRef.current) {
            lastTickerPrefsRef.current = tickerPrefsString;
            if (socket && socket.connected) {
                socket.emit('get_api_news');
            }
        }
    }, [rssPrefs, socket]);

    if (loading || news.length === 0) return null;

    return (
        <>
            <div className="news-ticker-wrapper">
                <div 
                    className="news-ticker-label clickable" 
                    onClick={() => setIsModalOpen(true)}
                    title="Quick-News öffnen"
                >
                    News
                </div>

                <div className="news-ticker-content">
                    <div className="news-ticker-track">
                        {/* Double the array for seamless infinite scrolling */}
                        {[...news, ...news].map((item, i) => (
                            <a
                                key={i}
                                href={item.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="news-item"
                                title={item.feedName || 'News'}
                            >
                                {item.title}
                            </a>
                        ))}
                    </div>
                </div>
            </div>

            <RssNewsModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                news={news} 
            />
        </>
    );
};

export default NewsTicker;
