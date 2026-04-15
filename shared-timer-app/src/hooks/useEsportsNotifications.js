import { useEffect, useRef, useState } from 'react';
import { ALARM_SOUNDS, playAlarmSound } from '../utils/soundGenerator';
import { usePageVisibility } from './usePageVisibility';

const LEAGUE_COLORS = {
    'LCK': '#ef4444',
    'LEC': '#3b82f6',
    'LCS': '#10b981',
    'LPL': '#8b5cf6',
    'Prime League': '#f59e0b',
};

const LEAGUE_KEYWORDS = {
    'International': ['msi', 'mid-season', 'worlds', 'world championship', 'first stand'],
    'EMEA Masters': ['emea masters'],
    'Prime League': ['prime league'],
};

const matchesLeague = (leagueName, toggleId) => {
    if (!leagueName) return false;
    const ln = leagueName.toLowerCase();
    if (ln === toggleId.toLowerCase()) return true;
    const keywords = LEAGUE_KEYWORDS[toggleId];
    if (keywords) return keywords.some(kw => ln.includes(kw));
    return false;
};

/**
 * Fetches /api/esports once on mount and then every hour to get the schedule.
 * Locally checks every 60 seconds if a match from a selected league
 * has started (by comparing startTime to Date.now()).
 * Fires a browser notification + chime when a match goes live.
 */
const useEsportsNotifications = (selectedLeagues, socket, options = {}) => {
    const { enabled = true } = options;
    const notifiedRef = useRef(new Set());
    const [schedule, setSchedule] = useState([]);
    const isVisible = usePageVisibility();

    // Fetch schedule from API — once on mount, then hourly
    useEffect(() => {
        if (!enabled || !selectedLeagues || selectedLeagues.length === 0 || !socket) return;

        const handleData = (data) => setSchedule(data || []);
        socket.on('api_esports_data', handleData);

        const fetchSchedule = () => {
            if (socket.connected) socket.emit('get_api_esports');
        };

        fetchSchedule();
        const fetchInterval = setInterval(fetchSchedule, isVisible ? 60 * 60 * 1000 : 3 * 60 * 60 * 1000);
        return () => {
            socket.off('api_esports_data', handleData);
            clearInterval(fetchInterval);
        };
    }, [enabled, isVisible, selectedLeagues, socket]);

    // Local time check — every 60 seconds, compare startTime to now
    useEffect(() => {
        if (!enabled || !selectedLeagues || selectedLeagues.length === 0 || schedule.length === 0) return;

        const checkMatches = () => {
            const now = Date.now();

            schedule.forEach(match => {
                if (notifiedRef.current.has(match.id)) return;
                if (!selectedLeagues.some(sl => matchesLeague(match.league, sl))) return;

                const matchTime = new Date(match.startTime).getTime();
                // Trigger if match should have started within the last 2 minutes
                // (covers the 60s polling window + some buffer)
                if (matchTime <= now && matchTime > now - 2 * 60 * 1000) {
                    notifiedRef.current.add(match.id);

                    const title = `🎮 ${match.league} Match Starting!`;
                    const body = `${match.team1?.name || 'TBD'} vs ${match.team2?.name || 'TBD'}`;

                    if (Notification.permission === 'granted') {
                        new Notification(title, { body, icon: '/favicon.ico' });
                    }

                    playAlarmSound(ALARM_SOUNDS.SOFT_CHIME);
                }
            });
        };

        checkMatches(); // Immediate check
        const checkInterval = setInterval(checkMatches, isVisible ? 60 * 1000 : 5 * 60 * 1000);
        return () => clearInterval(checkInterval);
    }, [enabled, isVisible, selectedLeagues, schedule]);
};

export { LEAGUE_COLORS };
export default useEsportsNotifications;
