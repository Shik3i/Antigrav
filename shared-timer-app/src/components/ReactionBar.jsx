import React from 'react';

const ReactionBar = ({ activeReactions, sendReaction, isZenMode }) => {
    const emojis = ['👏', '🔥', '👀', '🎯', '💯', '🚀'];

    return (
        <>
            {/* Floating Reactions Overlay */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                {activeReactions.map(r => {
                    const randomX = (Math.random() - 0.5) * 60; // Spread x axis slightly

                    return (
                        <span
                            key={r.id}
                            className="floating-emoji"
                            style={{
                                position: 'absolute',
                                left: `calc(50% + ${randomX}px)`,
                                bottom: '80px',
                                fontSize: '2rem',
                                filter: 'drop-shadow(0px 4px 8px rgba(0,0,0,0.4))'
                            }}
                        >
                            {r.emoji}
                        </span>
                    );
                })}
            </div>

            {/* Reaction Bar */}
            <div style={{
                position: 'absolute',
                bottom: isZenMode ? '20px' : '40px',
                display: 'flex',
                gap: '12px',
                padding: '8px 16px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '50px',
                backdropFilter: 'blur(10px)',
                border: '1px solid var(--border-color)',
                opacity: isZenMode ? 0.3 : 1,
                transition: 'opacity 0.3s'
            }}
                onMouseEnter={(e) => isZenMode && (e.currentTarget.style.opacity = 1)}
                onMouseLeave={(e) => isZenMode && (e.currentTarget.style.opacity = 0.3)}
            >
                {emojis.map(emoji => (
                    <button
                        key={emoji}
                        onClick={() => sendReaction(emoji)}
                        style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', transition: 'transform 0.1s' }}
                        onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.8)'}
                        onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        {emoji}
                    </button>
                ))}
            </div>
        </>
    );
};

export default ReactionBar;
