import React from 'react';

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
