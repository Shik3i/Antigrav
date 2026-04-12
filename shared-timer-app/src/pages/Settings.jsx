import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Terminal, Volume2, BellRing, Palette, Trophy, Download, Star, Heart, Search, X, ChevronDown, ChevronUp, Dna, Sparkles, RefreshCw, Clock, Shield, User, Lock, Settings as SettingsIcon } from 'lucide-react';
import { getNextPokemon } from '../utils/pokemonUtils';
import { ALARM_SOUNDS, playAlarmSound } from '../utils/soundGenerator';
import Friends from './Friends';

const THEMES = [
    { id: 'neon', label: 'Neon', colors: ['#0d0f12', '#3b82f6', '#8b5cf6'] },
    { id: 'light', label: 'Light', colors: ['#f8f9fc', '#2563eb', '#7c3aed'] },
    { id: 'oled', label: 'OLED', colors: ['#000000', '#22d3ee', '#a855f7'] },
    { id: 'sakura', label: 'Sakura', colors: ['#1a0a1e', '#ec4899', '#f472b6'] },
    { id: 'cyberpunk', label: 'Cyber', colors: ['#1a0b2e', '#ff007f', '#00f0ff'] },
    { id: 'forest', label: 'Forest', colors: ['#1a231c', '#22c55e', '#84cc16'] },
    { id: 'ocean', label: 'Ocean', colors: ['#081229', '#0ea5e9', '#2dd4bf'] },
    { id: 'synthwave', label: 'Synth', colors: ['#160f29', '#d946ef', '#8b5cf6'] },
    { id: 'sunset', label: 'Sunset', colors: ['#271318', '#f97316', '#ef4444'] },
    { id: 'monochrome', label: 'Monochrome', colors: ['#121212', '#1e1e1e', '#ffffff'] },
];

const POKEMON_TYPES = [
    { id: 'normal', color: '#A8A878' },
    { id: 'fire', color: '#F08030' },
    { id: 'water', color: '#6890F0' },
    { id: 'grass', color: '#78C850' },
    { id: 'electric', color: '#F8D030' },
    { id: 'ice', color: '#98D8D8' },
    { id: 'fighting', color: '#C03028' },
    { id: 'poison', color: '#A040A0' },
    { id: 'ground', color: '#E0C068' },
    { id: 'flying', color: '#A890F0' },
    { id: 'psychic', color: '#F85888' },
    { id: 'bug', color: '#A8B820' },
    { id: 'rock', color: '#B8A038' },
    { id: 'ghost', color: '#705898' },
    { id: 'dragon', color: '#7038F8' },
    { id: 'dark', color: '#705848' },
    { id: 'steel', color: '#B8B8D0' },
    { id: 'fairy', color: '#EE99AC' }
];


const ESPORTS_LEAGUES = [
    { id: 'LCK', label: 'LCK (Korea)', color: '#ef4444' },
    { id: 'LEC', label: 'LEC (Europe)', color: '#3b82f6' },
    { id: 'LCS', label: 'LCS (North America)', color: '#10b981' },
    { id: 'LPL', label: 'LPL (China)', color: '#8b5cf6' },
    { id: 'Prime League', label: 'Prime League (DACH)', color: '#f59e0b' },
    { id: 'EMEA Masters', label: 'EMEA Masters', color: '#ec4899' },
    { id: 'International', label: 'International (MSI, Worlds)', color: '#14b8a6' },
];

const SettingsSection = ({ title, icon, defaultOpen = false, children }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px', marginTop: '12px' }}>
            <div onClick={() => setIsOpen(!isOpen)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {icon} {title}
                </h3>
                {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
            {isOpen && <div className="animate-fade-in" style={{ marginTop: '24px' }}>{children}</div>}
        </div>
    );
};

const Settings = ({ user, setUser, socket }) => {
    const [name, setName] = useState(user.displayName);
    const [saved, setSaved] = useState(false);
    const [hasGlobalAdmin, setHasGlobalAdmin] = useState(false);
    const [esportsTeams, setEsportsTeams] = useState([]);
    const [teamSearch, setTeamSearch] = useState('');
    const [showStreamWidget, setShowStreamWidget] = useState(() => {
        return localStorage.getItem('hideLiveStreamWidget') !== 'true';
    });

    const [pokemonList, setPokemonList] = useState([]);
    const [pokemonConfigs, setPokemonConfigs] = useState(null);
    const [pokemonSearch, setPokemonSearch] = useState('');
    const [isPokemonAccordionOpen, setIsPokemonAccordionOpen] = useState(false);

    useEffect(() => {
        fetch('/api/esports/teams')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setEsportsTeams(data);
            })
            .catch(console.error);

        fetch('/api/pokemon')
            .then(res => res.json())
            .then(data => setPokemonList(data))
            .catch(err => console.error('Failed to fetch pokemon list', err));

        fetch('/api/pokemon/configs')
            .then(res => res.json())
            .then(setPokemonConfigs)
            .catch(err => console.error('Failed to fetch pokemon configs', err));
    }, []);

    // Add password state
    const [newPassword, setNewPassword] = useState('');
    const [pwdMessage, setPwdMessage] = useState('');

    const navigate = useNavigate();

    // Attempt to read superadmin status from JWT if missing from direct state
    let isSuperAdmin = user.is_superadmin;
    if (isSuperAdmin === undefined) {
        const token = localStorage.getItem('timerToken');
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                isSuperAdmin = payload.is_superadmin;
            } catch (e) {
                // Ignore parse errors
            }
        }
    }

    const canManageUsers = isSuperAdmin || hasGlobalAdmin;

    const updatePref = (key, value) => {
        setUser(prev => ({
            ...prev,
            preferences: { ...prev.preferences, [key]: value }
        }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        try {
            await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: user.id,
                    displayName: name,
                    preferences: user.preferences
                }),
            });

            setUser({ ...user, displayName: name });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error(err);
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setPwdMessage('');
        if (!newPassword || newPassword.length < 3) return;

        try {
            const res = await fetch('/api/auth/me/password', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('timerToken')}`
                },
                body: JSON.stringify({ newPassword })
            });
            const data = await res.json();
            if (res.ok) {
                setPwdMessage('Password updated successfully!');
                setNewPassword('');
            } else {
                setPwdMessage(data.error || 'Failed to update password');
            }
        } catch (err) {
            setPwdMessage('Error updating password');
        }
    };

    const currentTheme = user.preferences?.theme || 'neon';
    const selectedLeagues = user.preferences?.esportsLeagues || ['LCK', 'LEC', 'Prime League'];

    const toggleLeague = (leagueId) => {
        const current = [...selectedLeagues];
        const idx = current.indexOf(leagueId);
        if (idx >= 0) {
            current.splice(idx, 1);
        } else {
            current.push(leagueId);
        }
        updatePref('esportsLeagues', current);
    };

    const favoriteTeams = user.preferences?.favoriteTeams || [];
    const fanTeam = user.preferences?.fanTeam || null;

    const toggleFavoriteTeam = (teamCode) => {
        const current = [...favoriteTeams];
        const idx = current.indexOf(teamCode);
        let newFanTeam = fanTeam;
        if (idx >= 0) {
            current.splice(idx, 1);
            if (fanTeam === teamCode) newFanTeam = null;
        } else {
            if (current.length >= 10) {
                alert("You can only have up to 10 favorite teams.");
                return;
            }
            current.push(teamCode);
        }
        setUser(prev => ({
            ...prev,
            preferences: { ...prev.preferences, favoriteTeams: current, fanTeam: newFanTeam }
        }));
    };

    const setFanTeam = (teamCode) => {
        const newFanTeam = fanTeam === teamCode ? null : teamCode;
        updatePref('fanTeam', newFanTeam);
    };

    const toggleStreamWidget = (val) => {
        setShowStreamWidget(val);
        localStorage.setItem('hideLiveStreamWidget', val ? 'false' : 'true');
        // Dispatch custom event to notify LiveStreamWidget in the same window
        window.dispatchEvent(new Event('settings_update'));
    };

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 0' }}>
            <h1 style={{ marginBottom: '32px' }}>Settings</h1>

            <div className="glass-card" style={{ padding: '32px' }}>
                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <SettingsSection title="Account & Social" icon={<User size={20} />} defaultOpen={true}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {/* Profile Identity */}
                            <div>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>
                                    Choose a name that other users will see when you join a room or appear on the highscores.
                                </p>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        className="input-primary"
                                        style={{ flex: 1 }}
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Enter your display name"
                                        maxLength={20}
                                    />
                                    <button type="submit" className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
                                        {saved ? 'Saved!' : 'Save Name'}
                                    </button>
                                </div>
                            </div>

                            {/* Password Change (Registered Users Only) */}
                            {!(user.username && user.username.startsWith('_guest')) && (
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '24px' }}>
                                    <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Lock size={18} /> Change Password
                                    </h4>
                                    <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
                                        Update your account password securely.
                                    </p>
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                        <input
                                            type="password"
                                            className="input-primary"
                                            style={{ flex: 1 }}
                                            placeholder="New Password (min 3 chars)"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                        />
                                        <button className="btn-primary" style={{ whiteSpace: 'nowrap' }} onClick={handlePasswordChange}>Update</button>
                                    </div>
                                    {pwdMessage && <p style={{ fontSize: '0.85rem', marginTop: '8px', color: pwdMessage.includes('success') ? '#10b981' : '#ef4444' }}>{pwdMessage}</p>}
                                </div>
                            )}

                            {/* Friends Management */}
                            {!(user.username && user.username.startsWith('_guest')) && (
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '24px' }}>
                                    <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Heart size={18} /> Friends & Social
                                    </h4>
                                    <Friends socket={socket} embedded={true} />
                                </div>
                            )}
                        </div>
                    </SettingsSection>

                    <SettingsSection title="Appearance & Timer" icon={<Palette size={20} />}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            {/* Color Theme */}
                            <div>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
                                    Choose a visual theme for the entire app.
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '12px' }}>
                                    {THEMES.map(t => (
                                        <label key={t.id} style={{ cursor: 'pointer' }}>
                                            <input
                                                type="radio"
                                                name="theme"
                                                className="hidden-radio"
                                                checked={currentTheme === t.id}
                                                onChange={() => updatePref('theme', t.id)}
                                            />
                                            <div className={`pref-card ${currentTheme === t.id ? 'active' : ''}`}
                                                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '16px 8px' }}>
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    {t.colors.map((c, i) => (
                                                        <div key={i} style={{ width: '16px', height: '16px', borderRadius: '50%', background: c, border: '1px solid rgba(255,255,255,0.2)' }} />
                                                    ))}
                                                </div>
                                                <span style={{ fontSize: '0.8rem' }}>{t.label}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Pokémon Themes */}
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '32px' }}>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Dna size={18} color="#ef4444" /> Pokémon Themes
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                        When a Pokémon background is active, it overrides your normal theme and syncs the accent color to the Pokémon's type.
                                    </p>

                                    {/* Search Pokémon */}
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
                                            Search Specific Pokémon (ID or Name)
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                            <input
                                                type="text"
                                                className="input-primary"
                                                placeholder="e.g. 025 or Pikachu"
                                                style={{ paddingLeft: '40px' }}
                                                value={pokemonSearch}
                                                onChange={(e) => setPokemonSearch(e.target.value)}
                                            />

                                            {Array.isArray(pokemonList) && pokemonSearch.length > 1 && (
                                                <div style={{
                                                    position: 'absolute', top: '100%', left: 0, right: 0,
                                                    background: '#1e242e', border: '1px solid var(--border-color)',
                                                    borderRadius: '8px', marginTop: '4px', maxHeight: '200px',
                                                    overflowY: 'auto', zIndex: 100, boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                                                }}>
                                                    {pokemonList
                                                        .filter(p => p.name.includes(pokemonSearch.toLowerCase()) || p.id.includes(pokemonSearch))
                                                        .slice(0, 10)
                                                        .map(p => (
                                                            <div
                                                                key={p.id}
                                                                onClick={() => {
                                                                    updatePref('pokemonTheme', {
                                                                        ...user.preferences.pokemonTheme,
                                                                        active: true,
                                                                        mode: 'specific',
                                                                        id: p.id,
                                                                        name: p.name,
                                                                        types: p.types,
                                                                        threshold: p.threshold,
                                                                        backgroundColor: p.backgroundColor
                                                                    });
                                                                    setPokemonSearch('');
                                                                }}
                                                                style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}
                                                                onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                                                                onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                                            >
                                                                <span>#{p.id} {p.name.charAt(0).toUpperCase() + p.name.slice(1)}</span>
                                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                                    {p.types.map(t => (
                                                                        <span key={t} style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: POKEMON_TYPES.find(pt => pt.id === t)?.color || '#333' }}>{t}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))
                                                    }
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Type Selection Grid */}
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
                                            Type-Based Theme (Random from Type)
                                        </label>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '8px' }}>
                                            {POKEMON_TYPES.map(type => (
                                                    <button
                                                    key={type.id}
                                                    type="button"
                                                    onClick={() => {
                                                            const randomP = getNextPokemon(pokemonList, { ...user.preferences.pokemonTheme, mode: 'type', selectedType: type.id });
                                                            if (randomP) {
                                                                updatePref('pokemonTheme', {
                                                                    ...user.preferences.pokemonTheme,
                                                                    active: true,
                                                                    mode: 'type',
                                                                    selectedType: type.id,
                                                                    id: randomP.id,
                                                                    name: randomP.name,
                                                                    types: randomP.types,
                                                                    threshold: randomP.threshold,
                                                                    backgroundColor: randomP.backgroundColor
                                                                });
                                                            }
                                                        }}
                                                    className={`btn-ghost ${user.preferences.pokemonTheme?.selectedType === type.id && user.preferences.pokemonTheme?.mode === 'type' ? 'active' : ''}`}
                                                    style={{
                                                        padding: '8px 4px', fontSize: '0.75rem', textTransform: 'capitalize',
                                                        border: `1px solid ${(pokemonConfigs?.colors?.[type.id] || type.color)}44`,
                                                        background: user.preferences.pokemonTheme?.selectedType === type.id && user.preferences.pokemonTheme?.mode === 'type' ? `${(pokemonConfigs?.colors?.[type.id] || type.color)}22` : 'transparent'
                                                    }}
                                                >
                                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: (pokemonConfigs?.colors?.[type.id] || type.color) }} /> {type.id}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Global Toggles */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        <button
                                            type="button"
                                            className={`btn-primary ${user.preferences.pokemonTheme?.mode === 'random' ? 'active' : ''}`}
                                            style={{ flex: 1, minWidth: '150px', background: user.preferences.pokemonTheme?.mode === 'random' ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.05)', color: user.preferences.pokemonTheme?.mode === 'random' ? 'white' : 'var(--text-main)', border: '1px solid var(--border-color)' }}
                                            onClick={() => {
                                                    const randomP = getNextPokemon(pokemonList, { ...user.preferences.pokemonTheme, mode: 'random' });
                                                    if (randomP) {
                                                        updatePref('pokemonTheme', {
                                                            ...user.preferences.pokemonTheme,
                                                            active: true,
                                                            mode: 'random',
                                                            id: randomP.id,
                                                            name: randomP.name,
                                                            types: randomP.types,
                                                            threshold: randomP.threshold,
                                                            backgroundColor: randomP.backgroundColor
                                                        });
                                                    }
                                                }}
                                        >
                                            <Sparkles size={16} /> Global Random
                                        </button>

                                        {user.preferences.pokemonTheme?.active && (
                                            <button
                                                type="button"
                                                className="btn-ghost"
                                                style={{ color: '#ef4444' }}
                                                onClick={() => updatePref('pokemonTheme', { ...user.preferences.pokemonTheme, active: false })}
                                            >
                                                <X size={16} /> Disable Pokémon Theme
                                            </button>
                                        )}
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                            <input
                                                type="checkbox"
                                                checked={user.preferences.pokemonTheme?.slideshow || false}
                                                onChange={(e) => updatePref('pokemonTheme', { ...user.preferences.pokemonTheme, slideshow: e.target.checked })}
                                                style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                                            />
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Slideshow Mode</span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rotate every 5 minutes</span>
                                            </div>
                                        </label>

                                        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                            <input
                                                type="checkbox"
                                                checked={user.preferences.pokemonTheme?.timerSync || false}
                                                onChange={(e) => updatePref('pokemonTheme', { ...user.preferences.pokemonTheme, timerSync: e.target.checked })}
                                                style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                                            />
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Timer Sync</span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rotate when timer hits 0</span>
                                            </div>
                                        </label>
                                    </div>

                                    {/* Brightness Filter */}
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '12px', fontSize: '0.85rem', fontWeight: 600 }}>
                                            Brightness Limit (for Random / Slideshow)
                                        </label>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            {['all', 'light', 'dark'].map(mode => (
                                                <button
                                                    key={mode}
                                                    type="button"
                                                    onClick={() => updatePref('pokemonTheme', { ...user.preferences.pokemonTheme, brightnessFilter: mode })}
                                                    className={`btn-ghost ${ (user.preferences.pokemonTheme?.brightnessFilter || 'all') === mode ? 'active' : ''}`}
                                                    style={{
                                                        flex: 1, padding: '8px', fontSize: '0.8rem', textTransform: 'capitalize',
                                                        background: (user.preferences.pokemonTheme?.brightnessFilter || 'all') === mode ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                                        border: (user.preferences.pokemonTheme?.brightnessFilter || 'all') === mode ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)'
                                                    }}
                                                >
                                                    {mode === 'all' ? 'Alle anzeigen' : mode === 'light' ? 'Nur helle Pokémon' : 'Nur dunkle Pokémon'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {user.preferences.pokemonTheme?.active && (
                                        <div style={{
                                            padding: '16px',
                                            background: user.preferences.pokemonTheme.types?.length > 1
                                                ? `linear-gradient(135deg, ${(pokemonConfigs?.colors?.[user.preferences.pokemonTheme.types[0]] || '#3b82f6')}22, ${(pokemonConfigs?.colors?.[user.preferences.pokemonTheme.types[1]] || '#3b82f6')}22)`
                                                : `${(pokemonConfigs?.colors?.[user.preferences.pokemonTheme.types[0]] || '#3b82f6')}22`,
                                            borderRadius: '12px',
                                            border: `1px solid ${(pokemonConfigs?.colors?.[user.preferences.pokemonTheme.types[0]] || '#3b82f6')}88`,
                                            display: 'flex', alignItems: 'center', gap: '16px'
                                        }}>
                                            <img
                                                src={`/assets/pokemon/${user.preferences.pokemonTheme.id}.jpg`}
                                                alt="Current Pokemon"
                                                style={{ width: '60px', height: '60px', objectFit: 'contain', borderRadius: '8px', background: 'rgba(0,0,0,0.2)' }}
                                            />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Currently Displaying:</div>
                                                <div style={{ fontWeight: 700, fontSize: '1.1rem', textTransform: 'capitalize' }}>
                                                    #{user.preferences.pokemonTheme.id} {user.preferences.pokemonTheme.name}
                                                </div>
                                                <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                                                    {user.preferences.pokemonTheme.types?.map(t => (
                                                        <span key={t} style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', background: pokemonConfigs?.colors?.[t] || POKEMON_TYPES.find(pt => pt.id === t)?.color || '#333' }}>{t}</span>
                                                    ))}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                className="btn-ghost"
                                                style={{ marginLeft: 'auto' }}
                                                onClick={() => {
                                                        const nextP = getNextPokemon(pokemonList, user.preferences.pokemonTheme);
                                                        if (nextP) updatePref('pokemonTheme', {
                                                            ...user.preferences.pokemonTheme,
                                                            id: nextP.id,
                                                            name: nextP.name,
                                                            types: nextP.types,
                                                            threshold: nextP.threshold,
                                                            backgroundColor: nextP.backgroundColor
                                                        });
                                                    }}
                                            >
                                                <RefreshCw size={18} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Timer Style */}
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '32px' }}>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Clock size={18} /> Timer Style
                                </h4>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
                                    Customize how the timer looks for you.
                                </p>
                                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                    <label style={{ flex: '1 1 calc(33.333% - 16px)', minWidth: '120px', cursor: 'pointer' }}>
                                        <input type="radio" name="timerVisual" className="hidden-radio"
                                            checked={user.preferences?.timerVisual === 'circle'}
                                            onChange={() => updatePref('timerVisual', 'circle')}
                                        />
                                        <div className={`pref-card ${user.preferences?.timerVisual === 'circle' ? 'active' : ''}`}>Circle Mode</div>
                                    </label>
                                    <label style={{ flex: '1 1 calc(33.333% - 16px)', minWidth: '120px', cursor: 'pointer' }}>
                                        <input type="radio" name="timerVisual" className="hidden-radio"
                                            checked={user.preferences?.timerVisual === 'bar'}
                                            onChange={() => updatePref('timerVisual', 'bar')}
                                        />
                                        <div className={`pref-card ${user.preferences?.timerVisual === 'bar' ? 'active' : ''}`}>Bar Mode</div>
                                    </label>
                                    <label style={{ flex: '1 1 calc(33.333% - 16px)', minWidth: '120px', cursor: 'pointer' }}>
                                        <input type="radio" name="timerVisual" className="hidden-radio"
                                            checked={user.preferences?.timerVisual === 'minimal'}
                                            onChange={() => updatePref('timerVisual', 'minimal')}
                                        />
                                        <div className={`pref-card ${user.preferences?.timerVisual === 'minimal' ? 'active' : ''}`}>Minimal (Text)</div>
                                    </label>
                                    <label style={{ flex: '1 1 calc(33.333% - 16px)', minWidth: '120px', cursor: 'pointer' }}>
                                        <input type="radio" name="timerVisual" className="hidden-radio"
                                            checked={user.preferences?.timerVisual === 'dots'}
                                            onChange={() => updatePref('timerVisual', 'dots')}
                                        />
                                        <div className={`pref-card ${user.preferences?.timerVisual === 'dots' ? 'active' : ''}`}>Dotted Ring</div>
                                    </label>
                                    <label style={{ flex: '1 1 calc(33.333% - 16px)', minWidth: '120px', cursor: 'pointer' }}>
                                        <input type="radio" name="timerVisual" className="hidden-radio"
                                            checked={user.preferences?.timerVisual === 'battery'}
                                            onChange={() => updatePref('timerVisual', 'battery')}
                                        />
                                        <div className={`pref-card ${user.preferences?.timerVisual === 'battery' ? 'active' : ''}`}>Battery Level</div>
                                    </label>
                                    <label style={{ flex: '1 1 calc(33.333% - 16px)', minWidth: '120px', cursor: 'pointer' }}>
                                        <input type="radio" name="timerVisual" className="hidden-radio"
                                            checked={user.preferences?.timerVisual === 'hourglass'}
                                            onChange={() => updatePref('timerVisual', 'hourglass')}
                                        />
                                        <div className={`pref-card ${user.preferences?.timerVisual === 'hourglass' ? 'active' : ''}`}>Hourglass</div>
                                    </label>
                                    <label style={{ flex: '1 1 calc(33.333% - 16px)', minWidth: '120px', cursor: 'pointer' }}>
                                        <input type="radio" name="timerVisual" className="hidden-radio"
                                            checked={user.preferences?.timerVisual === 'ring'}
                                            onChange={() => updatePref('timerVisual', 'ring')}
                                        />
                                        <div className={`pref-card ${user.preferences?.timerVisual === 'ring' ? 'active' : ''}`}>Thin Ring</div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </SettingsSection>

                    <SettingsSection title="Esports & Teams" icon={<Trophy size={20} />}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            {/* Favorite Teams & Global Avatar */}
                            <div>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Star size={18} /> Favorite Teams & Global Avatar
                                </h4>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
                                    Select up to 10 favorite teams. Choose one team as your <strong>Fan Team</strong> to use their logo as your global avatar.
                                </p>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
                                    Note: Teams selected as Favorites or as your Fan Team will ALWAYS be prioritized and displayed in your schedule and live notifications, regardless of whether you have selected their respective league below.
                                </p>

                                <div style={{
                                    background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)',
                                    borderRadius: '8px', padding: '12px', marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'center'
                                }}>
                                     <Shield size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
                                     <span style={{ fontSize: '0.85rem', color: '#f59e0b', fontStyle: 'italic' }}>
                                         <strong>Priorisierung:</strong> Globale Benachrichtigungen (Toast/Push) ignorieren die oben gewählten Ligen, wenn eines deiner Favoriten-Teams spielt. Deine Favoriten werden immer priorisiert!
                                     </span>
                                </div>
                                
                                {/* Search and Add */}
                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{ position: 'relative', maxWidth: '300px' }}>
                                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                        <input
                                            type="text"
                                            className="input-primary"
                                            placeholder="Search teams..."
                                            style={{ width: '100%', paddingLeft: '36px' }}
                                            value={teamSearch}
                                            onChange={(e) => setTeamSearch(e.target.value)}
                                        />
                                    </div>
                                    
                                    {teamSearch && (
                                        <div style={{ 
                                            marginTop: '8px', maxHeight: '150px', overflowY: 'auto', 
                                            background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px'
                                        }}>
                                            {esportsTeams
                                                .filter(t => t.name.toLowerCase().includes(teamSearch.toLowerCase()) || t.code.toLowerCase().includes(teamSearch.toLowerCase()))
                                                .slice(0, 20)
                                                .map(team => (
                                                    <div 
                                                        key={team.code} 
                                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', marginBottom: '4px' }}
                                                        onClick={() => {
                                                            toggleFavoriteTeam(team.code);
                                                            setTeamSearch('');
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            {team.image && <img src={team.image} alt={team.code} style={{ width: '24px', height: '24px', objectFit: 'contain' }} />}
                                                            <span>{team.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>({team.code})</span></span>
                                                        </div>
                                                        <div style={{ padding: '2px 8px', fontSize: '0.8rem', borderRadius: '4px', background: favoriteTeams.includes(team.code) ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: favoriteTeams.includes(team.code) ? '#ef4444' : '#10b981' }}>
                                                            {favoriteTeams.includes(team.code) ? 'Remove' : 'Add'}
                                                        </div>
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    )}
                                </div>

                                {/* Selected Favorites */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                    {favoriteTeams.map(code => {
                                        const team = esportsTeams.find(t => t.code === code) || { code, name: code };
                                        const isFan = fanTeam === code;
                                        return (
                                            <div key={code} style={{
                                                display: 'flex', alignItems: 'center', gap: '8px',
                                                padding: '8px 12px', background: isFan ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.03)', 
                                                borderRadius: '8px', border: isFan ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                                transition: 'all 0.2s ease', position: 'relative'
                                            }}>
                                                {team.image && <img src={team.image} alt={team.code} style={{ width: '24px', height: '24px', objectFit: 'contain' }} />}
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{team.code}</span>
                                                    <button 
                                                        type="button"
                                                        onClick={() => setFanTeam(code)}
                                                        style={{ background: 'none', border: 'none', color: isFan ? 'var(--accent-primary)' : 'var(--text-muted)', fontSize: '0.75rem', padding: 0, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                    >
                                                        <Heart size={12} fill={isFan ? 'currentColor' : 'none'} />
                                                        {isFan ? 'Fan Team' : 'Make Fan Team'}
                                                    </button>
                                                </div>
                                                <button 
                                                    type="button"
                                                    onClick={() => toggleFavoriteTeam(code)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginLeft: '4px', padding: '4px' }}
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                    {favoriteTeams.length === 0 && (
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>No favorite teams selected.</div>
                                    )}
                                </div>
                            </div>

                            {/* Esports Notifications */}
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '32px' }}>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <BellRing size={18} /> Esports Notifications
                                </h4>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
                                    Get notified when matches from your selected leagues start. This also affects which matches appear in your betting dashboard.
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {ESPORTS_LEAGUES.map(league => (
                                        <label key={league.id} style={{
                                            display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer',
                                            padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px',
                                            border: selectedLeagues.includes(league.id) ? `1px solid ${league.color}` : '1px solid var(--border-color)',
                                            transition: 'all 0.2s ease'
                                        }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedLeagues.includes(league.id)}
                                                onChange={() => toggleLeague(league.id)}
                                                style={{ width: '18px', height: '18px', accentColor: league.color }}
                                            />
                                            <span style={{
                                                width: '10px', height: '10px', borderRadius: '50%', background: league.color, flexShrink: 0
                                            }} />
                                            <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>{league.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </SettingsSection>

                    <SettingsSection title="Audio & System" icon={<SettingsIcon size={20} />}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            {/* Audio Preferences */}
                            <div>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Volume2 size={18} /> Audio Preferences
                                </h4>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
                                    Choose the sound that plays when the timer hits zero.
                                </p>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                    <select
                                        className="input-primary"
                                        style={{ flex: 1, cursor: 'pointer', maxWidth: '300px' }}
                                        value={user.preferences?.alarmSound || ALARM_SOUNDS.CLASSIC_BEEP}
                                        onChange={(e) => updatePref('alarmSound', e.target.value)}
                                    >
                                        {Object.values(ALARM_SOUNDS).map(sound => (
                                            <option key={sound} value={sound}>{sound}</option>
                                        ))}
                                    </select>
                                    
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Volume2 size={16} color="var(--text-muted)" />
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.05"
                                            value={user.preferences?.alarmVolume !== undefined ? user.preferences.alarmVolume : 0.5}
                                            onChange={(e) => updatePref('alarmVolume', parseFloat(e.target.value))}
                                            style={{ width: '100px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                                            title="Volume"
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        className="btn-ghost"
                                        style={{ padding: '10px 16px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)', display: 'flex', gap: '8px', alignItems: 'center' }}
                                        onClick={() => {
                                            const vol = user.preferences?.alarmVolume !== undefined ? user.preferences.alarmVolume : 0.5;
                                            playAlarmSound(user.preferences?.alarmSound || ALARM_SOUNDS.CLASSIC_BEEP, vol);
                                            if (Notification.permission === 'default') {
                                                Notification.requestPermission().then(perm => {
                                                    if (perm === 'granted') {
                                                        new Notification('Testing 1, 2, 3!', { body: 'Notifications are working.' });
                                                    }
                                                });
                                            } else if (Notification.permission === 'granted') {
                                                new Notification('Testing 1, 2, 3!', { body: 'Notifications are working.' });
                                            }
                                        }}
                                    >
                                        <BellRing size={16} /> Test Alarm
                                    </button>
                                </div>

                                <div style={{ marginTop: '20px' }}>
                                    <p style={{ color: 'var(--text-muted)', marginBottom: '8px', fontSize: '0.9rem' }}>
                                        <strong>Pre-Timer Ping:</strong> Get a ping sound X seconds before the timer ends. Set to 0 to disable.
                                    </p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <input
                                            type="number"
                                            className="input-primary"
                                            style={{ maxWidth: '120px' }}
                                            min="0"
                                            step="10"
                                            value={user.preferences?.preTimerPingSeconds || 0}
                                            onChange={(e) => updatePref('preTimerPingSeconds', parseInt(e.target.value) || 0)}
                                        />
                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>seconds before end</span>
                                    </div>
                                </div>
                            </div>

                            {/* Other Features */}
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '32px' }}>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Terminal size={18} /> System & Other Features
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                        <input
                                            type="checkbox"
                                            checked={user.preferences?.showNewsTicker ?? (window.innerWidth > 768)}
                                            onChange={(e) => updatePref('showNewsTicker', e.target.checked)}
                                            style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                                        />
                                        <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Show Live News Ticker (Tagesschau)</span>
                                    </label>

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                        <input
                                            type="checkbox"
                                            checked={user.preferences?.showReactions ?? false}
                                            onChange={(e) => updatePref('showReactions', e.target.checked)}
                                            style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                                        />
                                        <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Show Emote / Reaction Bar</span>
                                    </label>

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                        <input
                                            type="checkbox"
                                            checked={user.preferences?.showClock ?? true}
                                            onChange={(e) => updatePref('showClock', e.target.checked)}
                                            style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                                        />
                                        <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Show Local Clock</span>
                                    </label>

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                        <input
                                            type="checkbox"
                                            checked={user.preferences?.showKoalaCoins ?? true}
                                            onChange={(e) => updatePref('showKoalaCoins', e.target.checked)}
                                            style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                                        />
                                        <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Show KoalaCoins Global Widget</span>
                                    </label>

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                        <input
                                            type="checkbox"
                                            checked={showStreamWidget}
                                            onChange={(e) => toggleStreamWidget(e.target.checked)}
                                            style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                                        />
                                        <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Show Floating Twitch Widget</span>
                                    </label>

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                        <input
                                            type="checkbox"
                                            checked={user.preferences?.showWeather ?? false}
                                            onChange={(e) => updatePref('showWeather', e.target.checked)}
                                            style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                                        />
                                        <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Show Local Weather Widget</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </SettingsSection>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px' }}>
                        <button type="submit" className="btn-primary">
                            Save Profile
                        </button>
                        {saved && <span style={{ color: '#10b981', fontSize: '0.85rem' }}>Successfully saved!</span>}
                    </div>
                </form>

                <SettingsSection title="Server Admin Panel" icon={<Shield size={20} />}>
                    {canManageUsers ? (
                        <div>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
                                You have full access to Server Settings and User Management.
                            </p>
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={async () => {
                                    if (isSuperAdmin) {
                                        try {
                                            // Securely fetch admin token even if already superadmin
                                            const token = localStorage.getItem('timerToken');
                                            sessionStorage.setItem('admin_token', token);
                                        } catch (e) {}
                                    }
                                    navigate('/admin');
                                }}
                            >
                                Open Server Admin Panel
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <input
                                type="password"
                                placeholder="Enter Admin Code"
                                className="input-primary"
                                style={{ maxWidth: '200px' }}
                                id="admin-password-input"
                            />
                            <button
                                type="button"
                                className="btn-ghost"
                                onClick={async () => {
                                    const pwd = document.getElementById('admin-password-input').value;
                                    try {
                                        const res = await axios.post('/api/admin/unlock', { password: pwd });
                                        sessionStorage.setItem('admin_token', res.data.token);
                                        setHasGlobalAdmin(true);
                                    } catch (err) {
                                        alert(err.response?.data?.error || 'Incorrect password');
                                    }
                                }}
                            >
                                Unlock Admin
                            </button>
                        </div>
                    )}
                </SettingsSection>
            </div>

            <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <Link to="/api-docs" style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        color: 'var(--text-muted)', textDecoration: 'none',
                        fontSize: '0.9rem', padding: '8px', borderRadius: '8px', transition: 'all 0.2s ease', border: '1px solid transparent'
                    }}>
                        <Terminal size={16} />
                        <span>View API Docs</span>
                    </Link>
                    <Link to="/extension-info" style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        color: 'var(--accent-primary)', textDecoration: 'none',
                        fontSize: '0.9rem', padding: '8px 12px', borderRadius: '8px', transition: 'all 0.2s ease', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid var(--border-focus)'
                    }}>
                        <Download size={16} />
                        <span>Get Browser Extension</span>
                    </Link>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', opacity: 0.7 }}>
                    Version 2.17.0
                </div>
            </div>
        </div>
    );
};

export default Settings;
