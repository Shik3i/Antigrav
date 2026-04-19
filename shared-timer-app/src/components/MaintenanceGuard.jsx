import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePersistentData } from '../context/PersistentDataContext';
import MaintenanceScreen from './MaintenanceScreen';
import * as LucideIcons from 'lucide-react';

/**
 * MaintenanceGuard HOC
 * 
 * Intercepts navigation to locked pages and displays a maintenance screen for normal users.
 * Superadmins can bypass the lock but will see a warning banner.
 */
const MaintenanceGuard = ({ children }) => {
    const { user } = useAuth();
    const { navbarSettings, navbarLoaded } = usePersistentData();
    const location = useLocation();

    // Find if the current path is locked in navbar settings
    const currentPathSetting = useMemo(() => {
        if (!navbarLoaded) return null;

        const path = location.pathname;

        // Try exact match first
        let match = navbarSettings.find(n => n.path === path);

        // Try prefix match for sub-routes (e.g. /games/rift-defense)
        if (!match) {
            // Sort by length descending to match most specific path first
            const sortedSettings = [...navbarSettings].sort((a, b) => b.path.length - a.path.length);
            match = sortedSettings.find(n => n.path !== '/' && path.startsWith(n.path));
        }

        return match;
    }, [navbarSettings, navbarLoaded, location.pathname]);

    const isLocked = currentPathSetting?.isLocked;
    const isSuperadmin = user?.is_superadmin;

    // Case 1: Not locked -> Transparently return children (restores original layout chain)
    // [WICHTIG: NICHT ENTFERNEN / NICHT UMWICKELN]
    // Wir geben 'children' hier absolut direkt zurück, ohne umschließende <div> oder Wrapper.
    // Jedes zusätzliche Element an dieser Stelle bricht den Flexbox-Fluss von App.jsx 
    // und verhindert korrektes Scrolling auf Unterseiten (z.B. Esports-Seite).
    // Der Check Number(isLocked) === 0 ist kritisch, da SQLite-Werte oft als String ("0") kommen.
    if (!isLocked || Number(isLocked) === 0) {
        return children;
    }

    // Case 2: Locked and NOT a superadmin -> Show maintenance screen
    if (!isSuperadmin) {
        return <MaintenanceScreen />;
    }

    // Case 3: Locked and Superadmin -> Show page with warning banner
    return (
        <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            position: 'relative'
        }}>
            {/* Optimized Admin Banner (High Visibility) */}
            <div style={{
                background: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)',
                color: '#000',
                padding: '14px 20px',
                textAlign: 'center',
                fontWeight: 800,
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                zIndex: 1000,
                boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                borderBottom: '3px solid rgba(0,0,0,0.15)',
                borderRadius: '8px',
                marginBottom: '24px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
            }}>
                <span style={{ fontSize: '20px' }}>🛡️</span>
                <span>Wartungsmodus aktiv: Diese Seite ist aktuell für normale User gesperrt.</span>
                <span style={{
                    background: 'rgba(0,0,0,0.15)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    marginLeft: '8px'
                }}>
                    ADMIN ONLY
                </span>
            </div>
            
            <div style={{ flex: 1, width: '100%', height: '100%', position: 'relative' }}>
                {children}
            </div>
        </div>
    );
};

export default MaintenanceGuard;
