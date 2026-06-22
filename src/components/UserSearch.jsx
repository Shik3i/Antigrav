import React, { useState, useEffect, useRef } from 'react';
import { Search, UserPlus, UserX, UserCheck, Loader2 } from 'lucide-react';

const UserSearch = ({ onSelectUser, excludedUserIds = [], showBlockOption = false }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const searchRef = useRef(null);

    const token = localStorage.getItem('timerToken');

    const searchUsers = async (searchQuery) => {
        if (!searchQuery || searchQuery.length < 2) {
            setResults([]);
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                const filtered = data.filter(user => !excludedUserIds.includes(user.id));
                setResults(filtered);
                setShowDropdown(true);
            } else {
                setError('Failed to search users');
            }
        } catch (err) {
            setError('Error searching users');
            console.error('Search error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectUser = (user) => {
        setSelectedUser(user);
        setQuery(`${user.displayName} (@${user.username})`);
        setShowDropdown(false);
        setResults([]);
        if (onSelectUser) {
            onSelectUser(user);
        }
    };

    const handleClearSelection = () => {
        setSelectedUser(null);
        setQuery('');
        if (onSelectUser) {
            onSelectUser(null);
        }
    };

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            searchUsers(query);
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div className="user-search-container" ref={searchRef}>
            <div className="search-input-wrapper" style={{ position: 'relative' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <input
                            type="text"
                            className="input-primary"
                            placeholder="Search for users..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onFocus={() => query.length >= 2 && setShowDropdown(true)}
                            style={{ paddingLeft: '36px' }}
                        />
                        <Search
                            size={16}
                            color="var(--text-muted)"
                            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                        />
                    </div>
                </div>

                {loading && (
                    <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                        <Loader2 size={16} className="spin" />
                    </div>
                )}

                {selectedUser && (
                    <button
                        onClick={handleClearSelection}
                        className="btn-secondary"
                        style={{ padding: '8px 12px' }}
                    >
                        <UserX size={16} />
                    </button>
                )}
            </div>

            {error && (
                <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '8px' }}>{error}</p>
            )}

            {showDropdown && results.length > 0 && (
                <div className="search-results-dropdown" style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    maxHeight: '300px',
                    overflowY: 'auto',
                    background: 'var(--card-bg)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    marginTop: '8px',
                    zIndex: 1000,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}>
                    {results.map(user => (
                        <div
                            key={user.id}
                            onClick={() => handleSelectUser(user)}
                            style={{
                                padding: '12px 16px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                borderBottom: '1px solid var(--border-color)',
                                background: selectedUser?.id === user.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                                ':hover': {
                                    background: 'rgba(255,255,255,0.03)'
                                }
                            }}
                        >
                            <div style={{ background: 'var(--accent-primary)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                                {user.displayName.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 500 }}>{user.displayName}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{user.username}</div>
                            </div>
                            {showBlockOption && (
                                <UserX size={16} color="#ef4444" />
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default UserSearch;