import React from 'react';

const Impressum = () => (
    <div className="animate-fade-in" style={{ width: '100%', minHeight: '100%', display: 'flex', padding: '40px 20px', overflowY: 'auto' }}>
        <title>Legal Notice | KoalaWeb</title>
        <meta name="description" content="The KoalaWeb legal notice has moved to the central KoalaStuff legal notice." />
        <link rel="canonical" href="https://koalastuff.net/legal" />
        <div className="glass-card" style={{ maxWidth: '700px', width: '100%', padding: '40px', textAlign: 'center', margin: 'auto' }}>
            <h1 style={{ color: 'var(--text-main)' }}>Impressum umgezogen</h1>
            <p style={{ color: 'var(--text-muted)' }}>Das KoalaWeb-Impressum ist jetzt unter der zentralen KoalaStuff-Adresse verfügbar.</p>
            <p><a href="https://koalastuff.net/legal" style={{ color: 'var(--accent-primary)' }}>Zentrales Impressum öffnen</a></p>
        </div>
    </div>
);

export default Impressum;
