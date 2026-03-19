import React, { useEffect, useState } from 'react';
import { Rss } from 'lucide-react';

const NewsTicker = ({ socket }) => {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!socket) return;

        const handleNews = (data) => {
            if (Array.isArray(data)) setNews(data);
            setLoading(false);
        };

        socket.on('api_news_data', handleNews);

        const fetchNews = () => {
            if (socket.connected) socket.emit('get_api_news');
        };

        fetchNews();
        socket.once('connect', fetchNews);

        // Refresh every 10 minutes
        const interval = setInterval(fetchNews, 10 * 60 * 1000);
        return () => {
            socket.off('api_news_data', handleNews);
            socket.off('connect', fetchNews);
            clearInterval(interval);
        };
    }, [socket]);

    if (loading || news.length === 0) return null;

    return (
        <div className="news-ticker-wrapper">
            <div className="news-ticker-label">
                <Rss size={14} /> Tagesschau
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
                        >
                            {item.title}
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default NewsTicker;
