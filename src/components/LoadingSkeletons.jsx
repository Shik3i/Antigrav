import React from 'react';
import { Loader2 } from 'lucide-react';

export const WidgetPillSkeleton = ({ width = 120 }) => (
    <div
        aria-hidden="true"
        style={{
            width,
            height: '40px',
            borderRadius: '999px',
            background: 'linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.12), rgba(255,255,255,0.06))',
            backgroundSize: '200% 100%',
            animation: 'pulse 1.8s ease-in-out infinite'
        }}
    />
);

export const FloatingWidgetSkeleton = () => (
    <div
        aria-hidden="true"
        style={{
            position: 'fixed',
            bottom: '80px',
            right: '24px',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.12), rgba(255,255,255,0.06))',
            backgroundSize: '200% 100%',
            animation: 'pulse 1.8s ease-in-out infinite',
            zIndex: 1000
        }}
    />
);

export const RouteSkeleton = ({ title = 'Lade Ansicht...' }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '980px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ width: '220px', height: '18px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)' }} />
            <div style={{ width: '320px', height: '42px', borderRadius: '16px', background: 'rgba(255,255,255,0.12)' }} />
            <div style={{ width: '420px', maxWidth: '100%', height: '14px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)' }} />
        </div>
        <div className="glass-card" style={{ padding: '24px', borderRadius: '20px' }}>
            <div style={{ color: 'var(--text-muted)', marginBottom: '18px' }}>{title}</div>
            <div style={{ display: 'grid', gap: '12px' }}>
                {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} style={{ height: '54px', borderRadius: '14px', background: 'rgba(255,255,255,0.06)' }} />
                ))}
            </div>
        </div>
    </div>
);

export const ViewLoader = ({ title = 'Vorbereiten...' }) => (
    <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '60vh', 
        gap: '24px',
        color: 'var(--text-main)',
        animation: 'fadeIn 0.5s ease-out'
    }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Loader2 
                size={48} 
                className="animate-spin" 
                style={{ 
                    animation: 'spin 1.5s linear infinite',
                    color: 'var(--accent-primary)',
                    filter: 'drop-shadow(0 0 8px var(--accent-primary))'
                }} 
            />
            <div style={{
                position: 'absolute',
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                border: '2px solid var(--accent-primary)',
                borderTopColor: 'transparent',
                animation: 'spin 3s linear infinite',
                opacity: 0.3
            }} />
        </div>
        <div style={{ 
            fontSize: '1.2rem', 
            fontWeight: 600, 
            letterSpacing: '0.05em',
            background: 'var(--accent-gradient)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            opacity: 0.8
        }}>
            {title}
        </div>
    </div>
);

