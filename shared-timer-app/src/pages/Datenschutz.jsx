import React from 'react';

const ProtectedEmail = ({ user, domain }) => {
    const [revealed, setRevealed] = React.useState(false);
    if (!revealed) {
        return (
            <span 
                onClick={() => setRevealed(true)}
                style={{ 
                    color: 'var(--accent-primary)', 
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    textDecoration: 'underline',
                    textDecorationStyle: 'dotted',
                    userSelect: 'none'
                }}
                title="Klicken zum Anzeigen"
            >
                [E-Mail anzeigen]
            </span>
        );
    }
    return (
        <a 
            href={`mailto:${user}@${domain}`}
            style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}
        >
            {user}<span style={{ display: 'none' }}>-nospam-</span>@{domain}
        </a>
    );
};

const Datenschutz = () => (
    <div className="animate-fade-in" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
        <div className="glass-card" style={{ maxWidth: '700px', width: '100%', padding: '40px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '2.5rem', margin: '0 0 8px 0', color: 'var(--text-main)' }}>Datenschutz</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '32px', borderBottom: '1px solid var(--border-color)', paddingBottom: '24px' }}>
                Sicherheit & Privatsphäre
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', color: 'var(--text-main)', textAlign: 'left' }}>
                <section>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px', textAlign: 'center' }}>1. Hosting & Logfiles</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.6', textAlign: 'center' }}>
                        Diese Seite wird auf einem privaten Server in Deutschland gehostet. Zur Gewährleistung der Stabilität werden standardmäßige Server-Logs (IP, Browser, Zeit) erhoben, aber nicht mit Personen verknüpft.
                    </p>
                </section>

                <section>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px', textAlign: 'center' }}>2. Einbindung von Drittanbietern & APIs</h2>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.6', textAlign: 'center' }}>
                        <p style={{ marginBottom: '12px' }}>
                            Obwohl dieses Projekt werbefrei ist und keine Tracking-Tools (wie Google Analytics) nutzt, greifen wir für bestimmte Live-Funktionen auf externe Dienste zu. Dabei wird technisch bedingt Ihre IP-Adresse an diese Anbieter übermittelt:
                        </p>
                        <ul style={{ listStyle: 'none', padding: 0, display: 'inline-block', textAlign: 'left' }}>
                            <li style={{ marginBottom: '8px' }}>
                                <strong style={{ color: 'var(--text-main)' }}>• Wetter-Widget:</strong> Für die lokalen Wetterdaten rufen wir Daten einer externen Wetter-API ab. Wenn Sie die automatische Standortermittlung nutzen, werden nach Ihrer expliziten Browser-Freigabe Ihre Koordinaten an diesen Dienst gesendet.
                            </li>
                            <li>
                                <strong style={{ color: 'var(--text-main)' }}>• Esports-Ressourcen:</strong> Zur Darstellung von Team-Logos (z. B. League of Legends) werden Bilder teilweise direkt von den Servern der Rechteinhaber (Riot Games / lolesports) geladen.
                            </li>
                        </ul>
                    </div>
                </section>

                <section style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '12px', textAlign: 'center' }}>3. Datenschutzbeauftragter</h2>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.6', textAlign: 'center' }}>
                        Bei Fragen zum Datenschutz oder zur Ausübung Ihrer Betroffenenrechte wenden Sie sich bitte an unseren Datenschutzbeauftragten:<br />
                        <span style={{ display: 'inline-block', marginTop: '8px' }}>
                            <ProtectedEmail user="koalasync_datenschutz" domain="koalamail.rocks" />
                        </span>
                    </p>
                </section>

                <section>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px', textAlign: 'center' }}>4. Spieldaten & User</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.6', textAlign: 'center' }}>
                        Für die Leaderboards und Timer werden lediglich die von dir eingegebenen Nutzernamen, sowie Spielstände und Timings in unserer Datenbank gespeichert.
                    </p>
                </section>
            </div>
        </div>
    </div>
);

export default Datenschutz;
