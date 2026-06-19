import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldAlert, Wrench } from 'lucide-react';

const MaintenanceScreen = () => {
    const navigate = useNavigate();

    return (
        <div style={{
            minHeight: '80vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Animated Background Blobs */}
            <div style={{
                position: 'absolute',
                top: '20%',
                left: '10%',
                width: '300px',
                height: '300px',
                background: 'rgba(59, 130, 246, 0.2)',
                filter: 'blur(80px)',
                borderRadius: '50%',
                animation: 'blobFloat 15s infinite alternate',
                zIndex: -1
            }} />
            <div style={{
                position: 'absolute',
                bottom: '20%',
                right: '10%',
                width: '250px',
                height: '250px',
                background: 'rgba(168, 85, 247, 0.2)',
                filter: 'blur(60px)',
                borderRadius: '50%',
                animation: 'blobFloat 12s infinite alternate-reverse',
                zIndex: -1
            }} />

            <div className="glass-panel" style={{
                maxWidth: '600px',
                width: '100%',
                padding: '48px',
                borderRadius: '32px',
                textAlign: 'center',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(16px) saturate(180%)',
                background: 'rgba(15, 23, 42, 0.65)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '24px'
            }}>
                <div style={{
                    width: '80px',
                    height: '80px',
                    background: 'rgba(59, 130, 246, 0.15)',
                    borderRadius: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '8px',
                    color: 'var(--accent-primary)',
                    boxShadow: '0 0 20px rgba(59, 130, 246, 0.2)'
                }}>
                    <Wrench size={40} style={{ animation: 'pulse 3s infinite' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <h1 style={{ 
                        fontSize: '2rem', 
                        fontWeight: 800, 
                        margin: 0,
                        background: 'linear-gradient(135deg, #fff 0%, #94a3b8 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        letterSpacing: '-0.02em'
                    }}>
                        Wartungsmodus
                    </h1>
                    <p style={{ 
                        fontSize: '1.1rem', 
                        color: 'var(--text-muted)', 
                        lineHeight: 1.6,
                        margin: 0
                    }}>
                        Diese Seite wird gerade für dich optimiert. Wir sind in Kürze wieder für dich da!
                    </p>
                </div>

                <div style={{
                    width: '100%',
                    height: '1px',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)'
                }} />

                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    width: '100%'
                }}>
                    <button 
                        className="btn-primary" 
                        onClick={() => navigate('/')}
                        style={{
                            padding: '14px 28px',
                            fontSize: '1rem',
                            fontWeight: 600,
                            borderRadius: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            width: '100%',
                            transition: 'transform 0.2s'
                        }}
                    >
                        <ArrowLeft size={18} /> Zurück zum Dashboard
                    </button>
                    
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        color: 'rgba(255,255,255,0.4)',
                        fontSize: '0.85rem'
                    }}>
                        <ShieldAlert size={14} />
                        <span>Professionelle Wartung aktiv</span>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes blobFloat {
                    0% { transform: translate(0, 0) scale(1); }
                    33% { transform: translate(30px, -50px) scale(1.1); }
                    66% { transform: translate(-20px, 20px) scale(0.9); }
                    100% { transform: translate(0, 0) scale(1); }
                }
            `}} />
        </div>
    );
};

export default MaintenanceScreen;
