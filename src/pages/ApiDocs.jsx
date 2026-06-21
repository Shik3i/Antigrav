import React from 'react';
import { Terminal, Lock, Globe, Zap } from 'lucide-react';

const ApiDocs = () => {
    const endpoints = [
        {
            method: 'GET',
            path: '/api/rooms',
            desc: 'Get a list of active public rooms (JSON array)',
            example: 'fetch("/api/rooms").then(res => res.json())'
        },
        {
            method: 'POST',
            path: '/api/rooms',
            desc: 'Create a new room. Returns room ID and access tokens.',
            example: 'fetch("/api/rooms", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({\n    name: "My Room",\n    isPublic: true,\n    defaultRole: "read",\n    defaultDurationMinutes: 20\n  })\n})'
        },
        {
            method: 'GET',
            path: '/api/highscores',
            desc: 'Get global top 10 highscores list',
            example: 'fetch("/api/highscores").then(res => res.json())'
        },
        {
            method: 'POST',
            path: '/api/test/rooms/:id/action',
            desc: 'Server-side trigger for testing (START/PAUSE/RESET)',
            example: 'fetch("/api/test/rooms/room123/action", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({ action: "START" })\n})'
        }
    ];

    const socketActions = [
        { action: 'START', payload: 'None', desc: 'Starts or resumes the countdown' },
        { action: 'PAUSE', payload: 'None', desc: 'Pauses the active timer' },
        { action: 'RESET', payload: 'None', desc: 'Resets timer to default duration' },
        { action: 'SET_DURATION', payload: 'number (mins)', desc: 'Updates total duration and resets timer' },
        { action: 'TOGGLE_POMODORO', payload: 'None', desc: 'Toggles Pomodoro auto-sequence mode' }
    ];

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 0' }}>
            <div style={{ marginBottom: '48px' }}>
                <h1 style={{ fontSize: '2.5rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <Terminal size={32} color="var(--accent-primary)" />
                    API Documentation
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', lineHeight: '1.6' }}>
                    Expand your productivity by integrating the SyncTimer into your own tools and scripts.
                    All API endpoints are protected by rate limiting to ensure system stability.
                </p>
            </div>

            <div style={{ display: 'grid', gap: '32px' }}>
                <div className="glass-card" style={{ padding: '24px', borderLeft: '4px solid var(--accent-primary)' }}>
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Lock size={18} /> Rate Limiting
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        The API is limited to <strong>100 requests per 15 minutes</strong> per IP address.
                        Exceeding this limit will result in a 429 error response.
                    </p>
                </div>

                {endpoints.map((ep, i) => (
                    <div key={i} className="glass-card" style={{ padding: '32px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <span style={{
                                padding: '4px 12px',
                                borderRadius: '6px',
                                background: ep.method === 'GET' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                color: ep.method === 'GET' ? '#22c55e' : 'var(--accent-primary)',
                                fontWeight: 'bold',
                                fontSize: '0.8rem'
                            }}>
                                {ep.method}
                            </span>
                            <code style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>{ep.path}</code>
                        </div>

                        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>{ep.desc}</p>

                        <div style={{
                            background: 'rgba(0,0,0,0.3)',
                            padding: '20px',
                            borderRadius: '8px',
                            position: 'relative',
                            fontFamily: 'monospace',
                            fontSize: '0.9rem',
                            overflowX: 'auto',
                            whiteSpace: 'pre-wrap'
                        }}>
                            <span style={{ position: 'absolute', top: '10px', right: '15px', fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>Example</span>
                            {ep.example}
                        </div>
                    </div>
                ))}

                <div className="glass-card" style={{ padding: '32px', marginTop: '16px' }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Zap size={24} color="var(--accent-primary)" />
                        WebSocket Actions (timer_action)
                    </h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
                        When connected via Socket.io, emit a <code>timer_action</code> event with the following payload structure:
                        <br />
                        <code>{'{ roomId: string, action: string, payload?: any }'}</code>
                    </p>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ padding: '12px 8px' }}>Action</th>
                                    <th style={{ padding: '12px 8px' }}>Payload</th>
                                    <th style={{ padding: '12px 8px' }}>Description</th>
                                </tr>
                            </thead>
                            <tbody>
                                {socketActions.map((sa, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '12px 8px' }}><code style={{ color: 'var(--accent-primary)' }}>{sa.action}</code></td>
                                        <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>{sa.payload}</td>
                                        <td style={{ padding: '12px 8px' }}>{sa.desc}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '60px', opacity: 0.5, textAlign: 'center', fontSize: '0.8rem' }}>
                Built by Antigravity for the Shared Timer App
            </div>
        </div>
    );
};

export default ApiDocs;
