import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import EVENTS from '../../socketEvents.json';
import { useAuth } from './AuthContext';

const PersistentDataContext = createContext();

export const usePersistentData = () => {
    const context = useContext(PersistentDataContext);
    if (!context) {
        throw new Error('usePersistentData must be used within a PersistentDataProvider');
    }
    return context;
};

export const PersistentDataProvider = ({ children, socket }) => {
    const { token, isGuest, user } = useAuth();
    const [esportsMatches, setEsportsMatches] = useState([]);
    const [esportsOdds, setEsportsOdds] = useState([]);
    const [generalBets, setGeneralBets] = useState([]);
    const [navbarSettings, setNavbarSettings] = useState([]);
    const [navbarLoaded, setNavbarLoaded] = useState(false);
    const [loadingNavbar, setLoadingNavbar] = useState(false);
    
    // Lotto Data
    const [lottoData, setLottoData] = useState({
        config: null,
        stats: { totalPayout: 0, totalWins: 0, totalPlayed: 0 },
        lastDraw: null,
        userHistory: [],
        userTicketsToday: 0,
        userTicketsTomorrow: 0,
        today: null,
        serverTime: null,
        nextDrawTime: null,
        nextCutoffTime: null,
        clockOffset: 0
    });
    const [lottoLoaded, setLottoLoaded] = useState(false);
    const [loadingLotto, setLoadingLotto] = useState(false);
    
    const [esportsScheduleUpdatedAt, setEsportsScheduleUpdatedAt] = useState(null);
    const [esportsOddsUpdatedAt, setEsportsOddsUpdatedAt] = useState(null);

    const [esportsLoaded, setEsportsLoaded] = useState(false);
    const [generalBetsLoaded, setGeneralBetsLoaded] = useState(false);
    const [loadingEsports, setLoadingEsports] = useState(false);
    const [loadingGeneral, setLoadingGeneral] = useState(false);
    const [esportsError, setEsportsError] = useState(null);

    // Refs to avoid stale closures in timeouts and detect actual data arrival
    const esportsLoadedRef = useRef(false);
    const timeoutsRef = useRef({});

    // Keep ref in sync with state
    useEffect(() => {
        esportsLoadedRef.current = esportsLoaded;
    }, [esportsLoaded]);

    // Esports Data Fetching (via Socket)
    const loadEsportsData = useCallback((force = false) => {
        if (!socket) {
            console.warn('[PersistentData] Socket not available for loadEsportsData');
            return;
        }
        
        // If already loaded and not forcing, do nothing
        if (esportsLoadedRef.current && !force) {
            console.log('[PersistentData] Esports already loaded, skipping request');
            return;
        }

        console.log('[PersistentData] Requesting esports data via socket...');
        setLoadingEsports(true);
        setEsportsError(null);
        
        // Clear any existing timeout
        if (timeoutsRef.current.esports) {
            clearTimeout(timeoutsRef.current.esports);
        }

        socket.emit(EVENTS.GET_API_ESPORTS);
        socket.emit(EVENTS.GET_API_ODDS);

        // Timeout fallback: if no data arrives in 15s, show error
        timeoutsRef.current.esports = setTimeout(() => {
            if (!esportsLoadedRef.current) {
                console.error('[PersistentData] Esports data request timed out (15s)');
                setLoadingEsports(false);
                setEsportsError('Could not load esports data. Please try refreshing.');
            }
        }, 15000);
    }, [socket]); // Removed esportsLoaded from deps to avoid re-creating unnecessarily

    // Polymarket General Bets (via REST)
    const loadGeneralBets = useCallback(async (force = false) => {
        if (generalBetsLoaded && !force) return;

        setLoadingGeneral(true);
        try {
            const res = await axios.get('/api/polymarket/general');
            setGeneralBets(res.data);
            setGeneralBetsLoaded(true);
        } catch (err) {
            console.error('Failed to fetch general bets in context:', err);
        } finally {
            setLoadingGeneral(false);
        }
    }, [generalBetsLoaded]);
    
    // Lotto Data (via REST)
    const loadLottoData = useCallback(async (force = false) => {
        if (lottoLoaded && !force) return;

        setLoadingLotto(true);
        try {
            // Config is mostly public or handles guest internally (optionalAuthenticateToken)
            const configReq = axios.get('/api/lotto/config', {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });

            // History ONLY if logged in and not guest
            const historyReq = (token && !isGuest) 
                ? axios.get('/api/lotto/history', { headers: { 'Authorization': `Bearer ${token}` } })
                : Promise.resolve({ data: { draws: [] } });

            const [configRes, historyRes] = await Promise.all([configReq, historyReq]);

            setLottoData({
                config: {
                    ...configRes.data.config,
                    ticketPrice: configRes.data.config.ticketPriceCents,
                    maxTicketsPerDay: configRes.data.config.maxDailyTickets
                },
                stats: configRes.data.stats,
                lastDraw: configRes.data.lastDraw,
                userHistory: historyRes.data.draws || [],
                userTicketsToday: configRes.data.userTicketsToday || 0,
                userTicketsTomorrow: configRes.data.userTicketsTomorrow || 0,
                today: configRes.data.today || new Date().toISOString().split('T')[0],
                serverTime: configRes.data.serverTime,
                nextDrawTime: configRes.data.nextDrawTime,
                nextCutoffTime: configRes.data.nextCutoffTime,
                clockOffset: configRes.data.serverTime ? (configRes.data.serverTime - Date.now()) : 0
            });
            setLottoLoaded(true);
        } catch (err) {
            console.error('[PersistentData] Failed to fetch lotto data:', err);
        } finally {
            setLoadingLotto(false);
        }
    }, [lottoLoaded, token, isGuest]);

    // Navbar Settings (via REST)
    const loadNavbarSettings = useCallback(async (force = false) => {
        if (navbarLoaded && !force) return;
        setLoadingNavbar(true);
        try {
            const res = await axios.get('/api/navbar-settings');
            setNavbarSettings(Array.isArray(res.data) ? res.data : []);
            setNavbarLoaded(true);
        } catch (err) {
            console.error('[PersistentData] Failed to fetch navbar settings:', err);
        } finally {
            setLoadingNavbar(false);
        }
    }, [navbarLoaded]);

    // Initial Load
    useEffect(() => {
        loadNavbarSettings();
    }, [loadNavbarSettings]);

    // Re-fetch lotto history when user logs in
    useEffect(() => {
        if (lottoLoaded) {
            loadLottoData(true);
        }
    }, [token, isGuest]);

    const updateEsportsOdds = useCallback((newOdds) => {
        setEsportsOdds(newOdds);
        setEsportsOddsUpdatedAt(new Date());
    }, []);

    // Socket Listeners (Global)
    useEffect(() => {
        if (!socket) return;

        const handleEsportsData = (payload) => {
            const { data, timestamp } = payload || {};
            console.log('[PersistentData] API_ESPORTS_DATA received:', data?.length, 'items');
            
            // Bulletproof type checking
            const safeData = Array.isArray(data) ? data : [];
            setEsportsMatches(safeData);

            if (timestamp) setEsportsScheduleUpdatedAt(new Date(timestamp));
            setEsportsLoaded(true);
            setLoadingEsports(false);
            setEsportsError(null);
            
            if (timeoutsRef.current.esports) {
                clearTimeout(timeoutsRef.current.esports);
                delete timeoutsRef.current.esports;
            }
        };

        const handleOddsData = (payload) => {
            const { data, timestamp } = payload || {};
            console.log('[PersistentData] API_ODDS_DATA received');
            
            // Bulletproof type checking
            const safeData = Array.isArray(data) ? data : [];
            setEsportsOdds(safeData);

            if (timestamp) setEsportsOddsUpdatedAt(new Date(timestamp));
            // Odds don't set loadingEsports to false because matches are usually what we wait for
        };

        socket.on(EVENTS.API_ESPORTS_DATA, handleEsportsData);
        socket.on(EVENTS.API_ODDS_DATA, handleOddsData);

        const handleLottoDrawResult = (payload) => {
            console.log('[PersistentData] LOTTO_DRAW_RESULT received:', payload);
            setLottoData(prev => {
                // Update stats and lastDraw from payload
                const newLastDraw = {
                    drawDate: payload.drawDate,
                    numbers: payload.numbers,
                    superzahl: payload.superzahl,
                    totalWinners: payload.totalWinners,
                    totalPayout: payload.totalPayout
                };
                
                // We don't have the user's updated history here yet (who won what specifically),
                // but we can at least update the global stats and last draw.
                // The user's individual win/loss for this specific draw will be visible on next history fetch
                // OR we could trigger a history fetch now.
                return {
                    ...prev,
                    stats: payload.stats || prev.stats,
                    lastDraw: newLastDraw,
                    // We reset userTicketsToday because the draw happened.
                    // We flip userTicketsTomorrow to userTicketsToday if we want, 
                    // but it's simpler to just force a full refresh on draw for accuracy.
                    userTicketsToday: 0,
                    userTicketsTomorrow: 0
                };
            });
            
            // Trigger a silent history refresh to get final results for user's tickets (only for logged in users)
            if (token && !isGuest) {
                axios.get('/api/lotto/history', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }).then(res => {
                    setLottoData(prev => ({ ...prev, userHistory: res.data.draws }));
                }).catch(e => console.error('[PersistentData] Silent lotto history refresh failed:', e));
            }
        };

        socket.on(EVENTS.LOTTO_DRAW_RESULT, handleLottoDrawResult);

        // Debug: Listen for a generic error
        socket.on(EVENTS.ERROR, (msg) => {
            console.error('[PersistentData] Socket Error:', msg);
        });

        return () => {
            socket.off(EVENTS.API_ESPORTS_DATA, handleEsportsData);
            socket.off(EVENTS.API_ODDS_DATA, handleOddsData);
            socket.off(EVENTS.LOTTO_DRAW_RESULT, handleLottoDrawResult);
            socket.off(EVENTS.ERROR);
            
            // Cleanup timeouts
            if (timeoutsRef.current.esports) {
                clearTimeout(timeoutsRef.current.esports);
            }
        };
    }, [socket]);

    const value = {
        esportsMatches,
        esportsOdds,
        esportsScheduleUpdatedAt,
        esportsOddsUpdatedAt,
        generalBets,
        esportsLoaded,
        generalBetsLoaded,
        loadingEsports,
        loadingGeneral,
        esportsError,
        loadEsportsData,
        loadGeneralBets,
        updateEsportsOdds,
        setGeneralBets,
        // Lotto
        lottoData,
        lottoLoaded,
        loadingLotto,
        loadLottoData,
        setLottoData,
        // Navbar
        navbarSettings,
        navbarLoaded,
        loadingNavbar,
        loadNavbarSettings,
        setNavbarSettings
    };

    return (
        <PersistentDataContext.Provider value={value}>
            {children}
        </PersistentDataContext.Provider>
    );
};
