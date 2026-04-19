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
    if (!isLocked) {
        return children;
    }

    // Case 2: Locked and NOT a superadmin -> Show maintenance screen
    if (!isSuperadmin) {
        return <MaintenanceScreen />;
    }

    // Case 3: Locked and Superadmin -> Show page with warning banner
    return (
        <div style={{ 
            position: 'relative', 
            width: '100%', 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column',
            overflow: 'hidden' // Only hide overflow in admin-debug view
        }}>
            <div style={{
                position: 'sticky',
                top: '-2rem', // Adjusted for padding in App.jsx
                zIndex: 99,
                background: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)',
                color: '#000',
                padding: '12px 24px',
                textAlign: 'center',
                fontWeight: 700,
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                borderBottom: '1px solid rgba(0,0,0,0.1)',
                margin: '-2rem -2rem 1.5rem -2rem',
                backdropFilter: 'blur(8px)',
            }}>
                <LucideIcons.ShieldAlert size={20} />
                <span>⚠️ Wartungsmodus aktiv: Diese Seite ist aktuell für normale User gesperrt.</span>
                <div style={{
                    background: 'rgba(0,0,0,0.1)',
                    padding: '4px 12px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    letterSpacing: '0.05em'
                }}>
                    ADMIN VIEW
                </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
                {children}
            </div>
        </div>
    );
};

export default MaintenanceGuard;
