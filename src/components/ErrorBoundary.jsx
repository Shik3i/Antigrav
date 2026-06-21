import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { RefreshCw, Home, AlertTriangle } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-wrapper tab-content-transition" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: '2rem',
          width: '100%'
        }}>
          <div className="glass-card" style={{
            maxWidth: '600px',
            width: '100%',
            padding: '3rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.5rem',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            background: 'rgba(30, 20, 20, 0.4)'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              <AlertTriangle size={40} color="#ef4444" className="animate-glow" />
            </div>

            <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>
              Sorry, aber es gab einen Fehler
            </h1>
            
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', lineHeight: '1.6' }}>
              Die Seite konnte nicht geladen werden. Wir haben den Fehler protokolliert. 
              Du kannst versuchen, die Seite neu zu laden oder zur Startseite zurückzukehren.
            </p>

            <div style={{
              background: 'rgba(0,0,0,0.2)',
              padding: '12px 20px',
              borderRadius: '8px',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              color: '#fca5a5',
              border: '1px solid rgba(239, 68, 68, 0.1)',
              width: '100%',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              margin: '1rem 0'
            }}>
              Fehlercode: {this.state.error?.message || 'Unknown Error'}
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', width: '100%' }}>
              <button 
                className="btn-primary" 
                onClick={() => window.location.reload()}
                style={{ flex: 1, gap: '10px' }}
              >
                <RefreshCw size={18} />
                Seite neu laden
              </button>
              <button 
                className="btn-ghost" 
                onClick={() => this.props.navigate('/')}
                style={{ 
                    flex: 1, 
                    gap: '10px', 
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-color)'
                }}
              >
                <Home size={18} />
                Zur Startseite
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Wrapper component to provide routing context and automatic reset on navigation
 */
const RouteErrorBoundary = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Using location.key or location.pathname as a key forces a fresh ErrorBoundary state
  // when the user navigates to a new page.
  return (
    <ErrorBoundary key={location.pathname} navigate={navigate}>
      {children}
    </ErrorBoundary>
  );
};

export default RouteErrorBoundary;
