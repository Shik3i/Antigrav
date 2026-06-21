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

const Impressum = () => (
    <div className="animate-fade-in" style={{ width: '100%', minHeight: '100%', display: 'flex', flexDirection: 'column', padding: '40px 20px', overflowY: 'auto' }}>
        <div className="glass-card" style={{ maxWidth: '700px', width: '100%', padding: '40px', textAlign: 'center', margin: 'auto' }}>
            <h1 style={{ fontSize: '2.5rem', margin: '0 0 8px 0', color: 'var(--text-main)' }}>Impressum</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '32px', borderBottom: '1px solid var(--border-color)', paddingBottom: '24px' }}>
                Transparenz & Identifikation
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', color: 'var(--text-main)' }}>
                <section>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px' }}>Betreiber & Kontakt</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Administrator KoalaWeb (Privatperson)</p>
                    <p style={{ color: 'var(--text-muted)' }}>E-Mail: <ProtectedEmail user="koalaweb" domain="koalamail.rocks" /></p>
                </section>

                <section style={{ opacity: 0.8 }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '12px' }}>Privatprojekt-Hinweis</h2>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                        Diese Website ist ein rein privates Hobby-Projekt und dient keinen geschäftsmäßigen Zwecken. 
                        Eine Impressumspflicht nach § 5 DDG (ehemals TMG) besteht daher nicht. 
                        Diese Angaben erfolgen rein freiwillig zur Transparenz gegenüber der Community.
                    </p>
                </section>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', textAlign: 'left' }}>
                    <section style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '10px' }}>Haftung für Inhalte</h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                            Gemäß § 7 Abs.1 DDG sind wir für eigene Inhalte verantwortlich. Nach §§ 8 bis 10 DDG sind wir jedoch nicht verpflichtet, 
                            übermittelte oder gespeicherte fremde Informationen zu überwachen.
                        </p>
                    </section>

                    <section style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '10px' }}>Haftung für Links</h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                            Unser Angebot enthält Links zu externen Websites Dritter. Auf deren Inhalte haben wir keinen Einfluss und 
                            können daher keine Gewähr für diese fremden Inhalte übernehmen.
                        </p>
                    </section>
                </div>

                <section style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '12px' }}>Urheberrecht</h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                        Die durch die Seitenbetreiber erstellten Inhalte auf diesen Seiten unterliegen dem deutschen Urheberrecht. 
                        Beiträge Dritter sind als solche gekennzeichnet. Vervielfältigung, Bearbeitung und jede Art der Verwertung 
                        außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung.
                    </p>
                </section>
            </div>
        </div>
    </div>
);

export default Impressum;
