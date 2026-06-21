import { useEffect, useRef, useState } from 'react';
import { ALARM_SOUNDS, playAlarmSound } from '../utils/soundGenerator';
import { usePageVisibility } from './usePageVisibility';
import { usePersistentData } from '../context/PersistentDataContext';

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
 * Monitors esports schedule. 
 * Fires a browser notification + chime when a match goes live.
 * Avoids redundant fetching if context data is already fresh.
 */
const useEsportsNotifications = (selectedLeagues, socket, options = {}) => {
    const { enabled = true } = options;
    const notifiedRef = useRef(new Set());
    const isVisible = usePageVisibility();
    
    const { 
        esportsMatches: schedule, 
        esportsLoaded,
        esportsScheduleUpdatedAt,
        loadEsportsData 
    } = usePersistentData();

    // Background sync check — run on mount and then periodically
    // But ONLY fetch if data is missing or older than 55 minutes
    useEffect(() => {
        if (!enabled || !selectedLeagues || selectedLeagues.length === 0 || !socket) return;

        const checkAndFetch = () => {
            if (!socket.connected) return;

            const now = Date.now();
            const lastUpdate = esportsScheduleUpdatedAt ? new Date(esportsScheduleUpdatedAt).getTime() : 0;
            const ageMs = now - lastUpdate;
            const needsFetch = !esportsLoaded || ageMs > 55 * 60 * 1000;

            if (needsFetch) {
                console.log('[EsportsNotifications] Schedule stale or missing, requesting update...');
                loadEsportsData();
            }
        };

        // Initial check
        checkAndFetch();

        // Check every 5 minutes in background (passive)
        const fetchInterval = setInterval(checkAndFetch, 5 * 60 * 1000);
        
        return () => clearInterval(fetchInterval);
    }, [enabled, selectedLeagues, socket, esportsLoaded, esportsScheduleUpdatedAt, loadEsportsData]);

    // Local time check — every 60 seconds, compare startTime to now
    useEffect(() => {
        if (!enabled || !selectedLeagues || selectedLeagues.length === 0 || !schedule || schedule.length === 0) return;

        const checkMatches = () => {
            const now = Date.now();

            schedule.forEach(match => {
                if (notifiedRef.current.has(match.id)) return;
                if (!selectedLeagues.some(sl => matchesLeague(match.league, sl))) return;

                const matchTime = new Date(match.startTime).getTime();
                // Trigger if match should have started within the last 2 minutes
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
