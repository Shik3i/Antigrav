import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div style={{ 
      textAlign: 'center', 
      padding: '5rem', 
      color: 'var(--text-main)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1rem'
    }}>
      <h2 style={{ fontSize: '3rem', margin: 0, background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        404
      </h2>
      <h3 style={{ fontSize: '1.5rem', margin: 0 }}>Seite nicht gefunden</h3>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', maxWidth: '400px' }}>
        Die gesuchte Seite existiert nicht oder wurde verschoben.
      </p>
      <Link 
        to="/" 
        className="btn-primary"
        style={{ 
          padding: '0.75rem 1.5rem', 
          borderRadius: '8px', 
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        Zurück zur Startseite
      </Link>
    </div>
  );
};

export default NotFound;
