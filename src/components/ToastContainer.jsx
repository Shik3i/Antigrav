import React from 'react';
import { useToast } from '../context/ToastContext';
import { CheckCircle, AlertCircle, Info, XCircle, X } from 'lucide-react';

const ToastContainer = () => {
    const { toasts, removeToast } = useToast();

    if (toasts.length === 0) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            pointerEvents: 'none',
            maxWidth: '100%',
            width: '380px',
        }}>
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
            ))}
        </div>
    );
};

const ToastItem = ({ toast, onRemove }) => {
    const { message, type } = toast;

    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle size={20} color="#10b981" />;
            case 'error': return <XCircle size={20} color="#ef4444" />;
            case 'warning': return <AlertCircle size={20} color="#f59e0b" />;
            default: return <Info size={20} color="#3b82f6" />;
        }
    };

    const getBorderColor = () => {
        switch (type) {
            case 'success': return 'rgba(16, 185, 129, 0.4)';
            case 'error': return 'rgba(239, 68, 68, 0.4)';
            case 'warning': return 'rgba(245, 158, 11, 0.4)';
            default: return 'rgba(59, 130, 246, 0.4)';
        }
    };

    return (
        <div 
            className="glass-card animate-slide-in-right"
            style={{
                pointerEvents: 'auto',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: 'rgba(15, 23, 42, 0.9)',
                borderLeft: `4px solid ${getBorderColor()}`,
                boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            <div style={{ flexShrink: 0 }}>
                {getIcon()}
            </div>
            <div style={{ 
                flex: 1, 
                fontSize: '0.9rem', 
                fontWeight: 500, 
                color: 'var(--text-main)',
                lineHeight: 1.4
            }}>
                {message}
            </div>
            <button 
                onClick={onRemove}
                className="btn-ghost"
                style={{ 
                    padding: '4px', 
                    marginLeft: '8px',
                    opacity: 0.6,
                    transition: 'opacity 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                onMouseLeave={e => e.currentTarget.style.opacity = 0.6}
            >
                <X size={16} />
            </button>
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                height: '2px',
                background: 'var(--accent-primary)',
                opacity: 0.3,
                width: '100%',
                transformOrigin: 'left',
                animation: `toastProgress ${toast.duration}ms linear forwards`
            }} />
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes toastProgress {
                    from { transform: scaleX(1); }
                    to { transform: scaleX(0); }
                }
            `}} />
        </div>
    );
};

export default ToastContainer;
