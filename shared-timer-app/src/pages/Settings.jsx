import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Terminal } from 'lucide-react';

const Settings = ({ user, setUser }) => {
    const [name, setName] = useState(user.displayName);
    const [saved, setSaved] = useState(false);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        // Optional: push update to backend immediately if you implemented a user API route,
        // which we did in phase 2! Let's do it.
        try {
            await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: user.id, displayName: name }),
            });

            setUser({ ...user, displayName: name });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error(err);
        }
    };

    const pageStyle = {
        maxWidth: '600px',
        margin: '0 auto',
        padding: '24px 0',
    };

    return (
        <div style={pageStyle}>
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
                        <input
                            type="text"
                            className="input-primary"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter your display name"
                            maxLength={20}
                        />
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                        <h3 style={{ marginBottom: '8px', fontSize: '1.2rem' }}>Visual Preferences</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
                            Customize how the timer looks for you.
                        </p>
                        <div style={{ display: 'flex', gap: '16px' }}>
                            <label style={{ flex: 1, cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="timerVisual"
                                    className="hidden-radio"
                                    checked={user.preferences?.timerVisual === 'circle'}
                                    onChange={() => setUser({ ...user, preferences: { ...user.preferences, timerVisual: 'circle' } })}
                                />
                                <div className={`pref-card ${user.preferences?.timerVisual === 'circle' ? 'active' : ''}`}>
                                    Circle Mode
                                </div>
                            </label>
                            <label style={{ flex: 1, cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="timerVisual"
                                    className="hidden-radio"
                                    checked={user.preferences?.timerVisual === 'bar'}
                                    onChange={() => setUser({ ...user, preferences: { ...user.preferences, timerVisual: 'bar' } })}
                                />
                                <div className={`pref-card ${user.preferences?.timerVisual === 'bar' ? 'active' : ''}`}>
                                    Bar Mode
                                </div>
                            </label>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
                        <button type="submit" className="btn-primary">
                            Save Profile
                        </button>
                        {saved && <span style={{ color: '#10b981', fontSize: '0.85rem' }}>Successfully saved!</span>}
                    </div>
                </form>
            </div>

            <div style={{ marginTop: '32px' }}>
                <Link to="/api-docs" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    color: 'var(--text-muted)',
                    textDecoration: 'none',
                    fontSize: '0.9rem',
                    padding: '12px',
                    borderRadius: '8px',
                    transition: 'all 0.2s ease'
                }}>
                    <Terminal size={18} />
                    <span>View API Documentation</span>
                </Link>
            </div>
        </div>
    );
};

export default Settings;
