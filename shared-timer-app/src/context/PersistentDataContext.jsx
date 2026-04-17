import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import EVENTS from '../../socketEvents.json';

const PersistentDataContext = createContext();

export const usePersistentData = () => {
    const context = useContext(PersistentDataContext);
    if (!context) {
        throw new Error('usePersistentData must be used within a PersistentDataProvider');
    }
    return context;
};

export const PersistentDataProvider = ({ children, socket }) => {
    const [esportsMatches, setEsportsMatches] = useState([]);
    const [esportsOdds, setEsportsOdds] = useState([]);
    const [generalBets, setGeneralBets] = useState([]);
    
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

        // Debug: Listen for a generic error
        socket.on(EVENTS.ERROR, (msg) => {
            console.error('[PersistentData] Socket Error:', msg);
        });

        return () => {
            socket.off(EVENTS.API_ESPORTS_DATA, handleEsportsData);
            socket.off(EVENTS.API_ODDS_DATA, handleOddsData);
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
        setGeneralBets
    };

    return (
        <PersistentDataContext.Provider value={value}>
            {children}
        </PersistentDataContext.Provider>
    );
};
