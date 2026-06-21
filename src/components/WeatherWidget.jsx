import React, { useEffect, useState } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Loader2, MapPinOff } from 'lucide-react';
import { usePageVisibility } from '../hooks/usePageVisibility';

const WeatherWidget = () => {
    const [weather, setWeather] = useState(null);
    const [coords, setCoords] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const isVisible = usePageVisibility();

    useEffect(() => {
        // Simple client-side fetch using Open-Meteo (No API key needed)
        const fetchWeather = async (lat, lon) => {
            try {
                const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
                if (!res.ok) throw new Error('Weather API error');
                const data = await res.json();
                setWeather(data.current_weather);
                setCoords({ lat, lon });
                setError(false);
            } catch (err) {
                console.error('Failed to fetch weather', err);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        // Try to get user location, default to central Europe (Berlin) if denied
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
                () => fetchWeather(52.52, 13.41), // Fallback: Berlin
                { timeout: 5000 }
            );
        } else {
            fetchWeather(52.52, 13.41);
        }

        // Refresh every 30 minutes
        const interval = setInterval(() => {
            if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
                    () => fetchWeather(52.52, 13.41)
                );
            }
        }, isVisible ? 30 * 60 * 1000 : 2 * 60 * 60 * 1000);

        return () => clearInterval(interval);
    }, [isVisible]);

    const getWeatherIcon = (code) => {
        // WMO Weather interpretation codes
        if (code === 0 || code === 1) return <Sun size={20} color="#fbbf24" />;
        if (code === 2 || code === 3) return <Cloud size={20} color="#9ca3af" />;
        if (code >= 51 && code <= 67) return <CloudRain size={20} color="#60a5fa" />;
        if (code >= 71 && code <= 77) return <CloudSnow size={20} color="#f3f4f6" />;
        if (code >= 80 && code <= 82) return <CloudRain size={20} color="#3b82f6" />; // Showers
        if (code >= 95 && code <= 99) return <CloudLightning size={20} color="#a78bfa" />;
        return <Cloud size={20} color="#9ca3af" />;
    };

    if (error) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.9rem', background: 'rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: '50px' }}>
                <MapPinOff size={16} /> <span style={{ opacity: 0.7 }}>Weather unavailable</span>
            </div>
        );
    }

    if (loading || !weather || !coords) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.9rem', background: 'rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: '50px' }}>
                <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 2s linear infinite' }} />
            </div>
        );
    }

    return (
        <a
            href="https://www.google.com/search?q=wetter"
            target="_blank"
            rel="noopener noreferrer"
            title="Local Weather - Click for full forecast"
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--text-main)',
                textDecoration: 'none',
                fontSize: '0.95rem',
                fontWeight: 600,
                background: 'rgba(20, 24, 30, 0.4)',
                backdropFilter: 'blur(12px)',
                border: '1px solid var(--border-color)',
                padding: '8px 16px',
                borderRadius: '50px',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(20, 24, 30, 0.4)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
        >
            {getWeatherIcon(weather.weathercode)}
            <span>{Math.round(weather.temperature)}°C</span>
        </a>
    );
};

export default WeatherWidget;
