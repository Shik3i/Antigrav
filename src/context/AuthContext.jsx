import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { clearStoredAuth, notifyInvalidSession } from '../utils/clientStorage';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(() => localStorage.getItem('timerToken') || null);
    const [authUser, setAuthUser] = useState(() => {
        const saved = localStorage.getItem('timerAuthUser');
        return saved ? JSON.parse(saved) : null;
    });

    const [guestUser, setGuestUser] = useState(() => {
        const saved = localStorage.getItem('timerUser');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (!parsed.preferences) parsed.preferences = { timerVisual: 'circle' };
            return parsed;
        }

        const verbs = [
            'Jumping', 'Flying', 'Sneaky', 'Happy', 'Focusing', 'Running', 'Sleeping', 'Dancing', 'Coding', 'Singing',
            'Thinking', 'Dreaming', 'Reading', 'Writing', 'Cooking', 'Baking', 'Laughing', 'Smiling', 'Crying', 'Sighing',
            'Walking', 'Hiking', 'Climbing', 'Swimming', 'Diving', 'Surfing', 'Skating', 'Skiing', 'Snowboarding', 'Sledding',
            'Chasing', 'Hiding', 'Seeking', 'Finding', 'Losing', 'Winning', 'Playing', 'Working', 'Resting', 'Relaxing',
            'Exploring', 'Discovering', 'Inventing', 'Creating', 'Building', 'Destroying', 'Fixing', 'Breaking', 'Healing', 'Hurting'
        ];
        const nouns = [
            'Panda', 'Koala', 'Tiger', 'Lion', 'Eagle', 'Shark', 'Wolf', 'Bear', 'Fox', 'Owl',
            'Dolphin', 'Whale', 'Penguin', 'Seal', 'Walrus', 'PolarBear', 'Grizzly', 'Panther', 'Leopard', 'Cheetah',
            'Hawk', 'Falcon', 'Osprey', 'Raven', 'Crow', 'Magpie', 'Jay', 'Robin', 'Sparrow', 'Finch',
            'Dragon', 'Unicorn', 'Phoenix', 'Griffin', 'Sphinx', 'Kraken', 'Leviathan', 'Hydra', 'Pegasus', 'Chimera',
            'Wizard', 'Witch', 'Mage', 'Sorcerer', 'Warlock', 'Druid', 'Shaman', 'Cleric', 'Priest', 'Paladin'
        ];
        const randomVerb = verbs[Math.floor(Math.random() * verbs.length)];
        const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];

        return {
            id: 'user_' + Math.random().toString(36).substr(2, 9),
            displayName: `${randomVerb} ${randomNoun}`,
            preferences: { timerVisual: 'circle' }
        };
    });

    const user = authUser || guestUser;

    const setUser = useCallback((newValueOrUpdater) => {
        if (authUser) {
            setAuthUser(prev => {
                const updated = typeof newValueOrUpdater === 'function' ? newValueOrUpdater(prev) : newValueOrUpdater;
                localStorage.setItem('timerAuthUser', JSON.stringify(updated));
                return updated;
            });
        } else {
            setGuestUser(prev => {
                const updated = typeof newValueOrUpdater === 'function' ? newValueOrUpdater(prev) : newValueOrUpdater;
                localStorage.setItem('timerUser', JSON.stringify(updated));
                return updated;
            });
        }
    }, [authUser]);

    const login = useCallback((newToken, newAuthUser) => {
        setToken(newToken);

        // Ensure preferences exist
        if (!newAuthUser.preferences) newAuthUser.preferences = { timerVisual: 'circle' };

        setAuthUser(newAuthUser);
        localStorage.setItem('timerToken', newToken);
        localStorage.setItem('timerAuthUser', JSON.stringify(newAuthUser));
    }, []);

    const logout = useCallback(() => {
        setToken(null);
        setAuthUser(null);
        clearStoredAuth();
    }, []);

    useEffect(() => {
        if (!authUser) {
            localStorage.setItem('timerUser', JSON.stringify(guestUser));
        } else {
            localStorage.setItem('timerAuthUser', JSON.stringify(authUser));
        }
    }, [guestUser, authUser]);

    useEffect(() => {
        if (token && authUser) {
            // Re-fetch user to get latest superadmin status and details
            fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
                .then(async (res) => {
                    const data = await res.json().catch(() => null);
                    if (!res.ok) {
                        if (res.status === 401) {
                            setToken(null);
                            setAuthUser(null);
                            clearStoredAuth();
                            notifyInvalidSession();
                        }
                        throw new Error(data?.error || `Request failed: ${res.status}`);
                    }
                    return data;
                })
                .then(data => {
                    if (data.id) {
                        setAuthUser(prev => {
                            // Preserve local preferences if needed, but merge backend overrides
                            const updated = {
                                ...prev,
                                ...data,
                                preferences: {
                                    ...(prev?.preferences || {}),
                                    ...(data.preferences || {})
                                }
                            };
                            localStorage.setItem('timerAuthUser', JSON.stringify(updated));
                            return updated;
                        });
                    }
                })
                .catch(error => {
                    console.error('Auth bootstrap failed:', error);
                });
        }
    }, []); // Run once on mount to silently update state

    const contextValue = useMemo(() => ({
        user,
        setUser,
        token,
        login,
        logout,
        isGuest: !authUser
    }), [user, setUser, token, login, logout, authUser]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};
