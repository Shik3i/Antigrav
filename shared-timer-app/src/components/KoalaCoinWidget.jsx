import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins } from 'lucide-react';

const KoalaCoinWidget = ({ balance }) => {
    const [isHovered, setIsHovered] = useState(false);
    const navigate = useNavigate();

    return (
        <div
            style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => navigate('/koala-dashboard')}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'var(--text-main)',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    background: isHovered ? 'rgba(16, 185, 129, 0.15)' : 'rgba(20, 24, 30, 0.4)',
                    backdropFilter: 'blur(12px)',
                    border: `1px solid ${isHovered ? '#10b981' : 'var(--border-color)'}`,
                    padding: '8px 16px',
                    borderRadius: '50px',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                }}
            >
                <Coins size={16} color="#10b981" />
                <span style={{ fontFamily: 'monospace', fontSize: '1.05rem', letterSpacing: '0.5px' }}>
                    {(balance / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KC
                </span>
            </div>

            {isHovered && (
                <div
                    className="animate-fade-in"
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        right: 0,
                        background: 'rgba(20, 24, 30, 0.95)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid var(--border-color)',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        color: 'var(--text-main)',
                        fontSize: '0.85rem',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                        zIndex: 1000,
                        pointerEvents: 'none'
                    }}
                >
                    KoalaCoins Balance
                </div>
            )}
        </div>
    );
};

export default KoalaCoinWidget;
