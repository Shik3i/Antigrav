import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchJson } from '../utils/apiClient';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { getStoredValue, setStoredValue } from '../utils/clientStorage';

const NewsContext = createContext();

export const useNews = () => {
    const context = useContext(NewsContext);
    if (!context) {
        throw new Error('useNews must be used within a NewsProvider');
    }
    return context;
};

export const NewsProvider = ({ children }) => {
    const { token, user } = useAuth();
    const { showToast } = useToast();
    const [feeds, setFeeds] = useState([]);
    const [rssPrefs, setRssPrefs] = useState({});
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
        return getStoredValue('rss_sidebar_collapsed', false);
    });
    const [loading, setLoading] = useState(true);

    // Initial load
    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            try {
                // 1. Load feeds list (public)
                const feedsData = await fetchJson('/api/rss/feeds');
                setFeeds(feedsData);

                // 2. Load preferences
                let initialPrefs = {};
                
                // Try LocalStorage first (for guest consistency)
                const localPrefs = getStoredValue('rss_user_prefs', {});
                initialPrefs = localPrefs;

                // If logged in, fetch from server and sync
                if (token) {
                    try {
                        const serverPrefsArray = await fetchJson('/api/rss/preferences', { token });
                        const serverPrefs = {};
                        serverPrefsArray.forEach(p => {
                            // ESSENTIAL: Convert feedId to String for consistent state mapping
                            serverPrefs[String(p.feedId)] = {
                                showOnSite: p.showOnSite === 1 || p.showOnSite === true,
                                showInTicker: p.showInTicker === 1 || p.showInTicker === true
                            };
                        });
                        
                        // For logged in users, server is truth.
                        initialPrefs = { ...serverPrefs };
                        setStoredValue('rss_user_prefs', initialPrefs);
                    } catch (err) {
                        console.error('[NewsContext] Failed to fetch server prefs:', err);
                    }
                }

                setRssPrefs(initialPrefs);
            } catch (err) {
                console.error('[NewsContext] Failed to load news data:', err);
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
    }, [token]);

    // Save sidebar state
    useEffect(() => {
        setStoredValue('rss_sidebar_collapsed', isSidebarCollapsed);
    }, [isSidebarCollapsed]);

    /**
     * Update a specific preference. 
     * Handles Optimistic UI + Background Sync + LocalStorage
     */
    const updateRssPreference = useCallback(async (feedId, type, value) => {
        const key = type === 'site' ? 'showOnSite' : 'showInTicker';
        
        // 1. Optimistic UI update (Functional to avoid race conditions)
        setRssPrefs(prev => {
            const newPrefs = {
                ...prev,
                [feedId]: {
                    ...(prev[feedId] || { showOnSite: true, showInTicker: false }),
                    [key]: value
                }
            };
            setStoredValue('rss_user_prefs', newPrefs);
            return newPrefs;
        });

        // 2. Background Sync if logged in
        if (token) {
            try {
                await fetchJson('/api/rss/preferences', {
                    method: 'POST',
                    token,
                    body: JSON.stringify({
                        feedId,
                        [key]: value
                    })
                });
            } catch (err) {
                console.error('[NewsContext] Failed to sync preference to server:', err);
                showToast('Fehler beim Speichern der News-Präferenz', 'error');
                // Note: We don't roll back here to maintain "snappiness", 
                // but a more robust system might implement a retry or temporary error state.
            }
        }
    }, [token]);

    const toggleSidebar = () => setIsSidebarCollapsed(prev => !prev);

    // Optimized context value to prevent unnecessary re-renders
    const contextValue = React.useMemo(() => ({
        feeds,
        rssPrefs,
        isSidebarCollapsed,
        loading,
        updateRssPreference,
        toggleSidebar,
        setIsSidebarCollapsed
    }), [feeds, rssPrefs, isSidebarCollapsed, loading, updateRssPreference]);

    return (
        <NewsContext.Provider value={contextValue}>
            {children}
        </NewsContext.Provider>
    );
};
