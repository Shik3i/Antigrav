import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Terminal, Volume2, BellRing, Palette, Trophy, Download, Star, Heart, Search, X } from 'lucide-react';
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

const Settings = ({ user, setUser, socket }) => {
    const [name, setName] = useState(user.displayName);
    const [saved, setSaved] = useState(false);
    const [hasGlobalAdmin, setHasGlobalAdmin] = useState(false);
    const [esportsTeams, setEsportsTeams] = useState([]);
    const [teamSearch, setTeamSearch] = useState('');
    const [showStreamWidget, setShowStreamWidget] = useState(() => {
        return localStorage.getItem('hideLiveStreamWidget') !== 'true';
    });

    useEffect(() => {
        fetch('/api/esports/teams')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setEsportsTeams(data);
            })
            .catch(console.error);
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
                <h3 style={{ marginBottom: '8px' }}>Profile Identity</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>
                    Choose a name that other users will see when you join a room or appear on the highscores.
                </p>

                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 500 }}>
                            Display Name
                        </label>
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

                    {/* ─── Password Change (Registered Users Only) ─── */}
                    {!(user.username && user.username.startsWith('_guest')) && (
                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                            <h3 style={{ marginBottom: '8px', fontSize: '1.2rem' }}>Change Password</h3>
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

                    {/* ─── Friends Management ─── */}
                    {!(user.username && user.username.startsWith('_guest')) && (
                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                            {console.log('[Settings] Rendering Friends...')}
                            <Friends socket={socket} embedded={true} />
                        </div>
                    )}

                    {/* ─── Theme Picker ─── */}
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                        <h3 style={{ marginBottom: '8px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Palette size={20} /> Color Theme
                        </h3>
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

                    {/* ─── Timer Visual ─── */}
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                        <h3 style={{ marginBottom: '8px', fontSize: '1.2rem' }}>Timer Style</h3>
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

                    {/* ─── Audio ─── */}
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                        <h3 style={{ marginBottom: '8px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Volume2 size={20} /> Audio Preferences
                        </h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
                            Choose the sound that plays when the timer hits zero.
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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

                            <button
                                type="button"
                                className="btn-ghost"
                                style={{ padding: '10px 16px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)', display: 'flex', gap: '8px', alignItems: 'center' }}
                                onClick={() => {
                                    playAlarmSound(user.preferences?.alarmSound || ALARM_SOUNDS.CLASSIC_BEEP);
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

                        {/* Pre-Timer Ping */}
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

                    {/* ─── Esports Notifications ─── */}
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                        <h3 style={{ marginBottom: '8px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Trophy size={20} /> Esports Notifications
                        </h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
                            Get a toast and push notification when matches from your selected leagues start.
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

                    {/* ─── Favorite Teams & Fan Team ─── */}
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                        <h3 style={{ marginBottom: '8px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Star size={20} /> Favorite Teams & Global Avatar
                        </h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
                            Select up to 10 favorite teams. Choose one team as your <strong>Fan Team</strong> to use their logo as your global avatar.
                        </p>
                        
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
                                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginLeft: '4px', padding: '4px', ':hover': { color: 'var(--text-primary)' } }}
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

                    {/* ─── Other Features ─── */}
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                        <h3 style={{ marginBottom: '8px', fontSize: '1.2rem' }}>Other Features</h3>
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

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px' }}>
                        <button type="submit" className="btn-primary">
                            Save Profile
                        </button>
                        {saved && <span style={{ color: '#10b981', fontSize: '0.85rem' }}>Successfully saved!</span>}
                    </div>
                </form>

                {/* ─── Admin Access ─── */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px', marginTop: '32px' }}>
                    <h3 style={{ marginBottom: '8px', fontSize: '1.2rem', color: 'var(--text-muted)' }}>Admin Access & User Management</h3>

                    {canManageUsers ? (
                        <div>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
                                You have full access to Server Settings and User Management.
                            </p>
                            <button
                                className="btn-primary"
                                onClick={() => {
                                    if (isSuperAdmin) {
                                        // Auto-grant access to /admin
                                        sessionStorage.setItem('admin_token', 'Bearer Entangled-Napping7-Custodian');
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
                                className="btn-ghost"
                                onClick={() => {
                                    const pwd = document.getElementById('admin-password-input').value;
                                    if (pwd === 'Entangled-Napping7-Custodian') {
                                        sessionStorage.setItem('admin_token', 'Bearer ' + pwd);
                                        setHasGlobalAdmin(true);
                                    } else {
                                        alert('Incorrect password');
                                    }
                                }}
                            >
                                Unlock Admin
                            </button>
                        </div>
                    )}
                </div>
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
                    Version 2.4.0
                </div>
            </div>
        </div>
    );
};

export default Settings;
