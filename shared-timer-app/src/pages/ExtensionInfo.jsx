import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, ArrowLeft, Download, Github, Globe, Zap, CheckCircle } from 'lucide-react';

const ExtensionInfo = () => {
    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 0' }}>
            <Link to="/settings" className="btn-ghost" style={{ marginBottom: '24px', display: 'inline-flex' }}>
                <ArrowLeft size={20} /> Back to Settings
            </Link>

            <h1 style={{ marginBottom: '8px' }}>KoalaSync Media Extension</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '32px' }}>
                Synchronize video playback seamlessly with everyone in your KoalaWeb room.
                The KoalaSync extension is a standalone project — fully open source.
            </p>

            {/* Primary CTA: Landing Page */}
            <div className="glass-card animate-fade-in" style={{ padding: '32px', marginBottom: '24px', border: '1px solid rgba(59,130,246,0.25)' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <Globe size={24} color="var(--accent-primary)" />
                    Get KoalaSync
                </h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px', lineHeight: '1.6' }}>
                    Visit the official KoalaSync website for installation instructions, release notes, and support.
                </p>
                <a
                    href="https://sync.koalastuff.net"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary"
                    style={{ textDecoration: 'none', display: 'inline-flex', gap: '8px', alignItems: 'center' }}
                >
                    <Globe size={18} /> Open sync.koalastuff.net <ExternalLink size={14} />
                </a>
            </div>

            {/* Download & GitHub */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                <div className="glass-card animate-fade-in" style={{ padding: '28px', animationDelay: '0.1s' }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', fontSize: '1.2rem' }}>
                        <Download size={20} color="var(--accent-primary)" />
                        Download
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px', lineHeight: '1.5' }}>
                        Download the latest release directly from GitHub.
                    </p>
                    <a
                        href="https://github.com/Shik3i/KoalaSync/releases"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary"
                        style={{ textDecoration: 'none', display: 'inline-flex', gap: '8px', alignItems: 'center', fontSize: '0.9rem' }}
                    >
                        <Download size={16} /> Latest Release <ExternalLink size={12} />
                    </a>
                </div>

                <div className="glass-card animate-fade-in" style={{ padding: '28px', animationDelay: '0.2s' }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', fontSize: '1.2rem' }}>
                        <Github size={20} />
                        Source Code
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px', lineHeight: '1.5' }}>
                        KoalaSync is fully open source. Contributions and issue reports welcome!
                    </p>
                    <a
                        href="https://github.com/Shik3i/KoalaSync"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost"
                        style={{ textDecoration: 'none', display: 'inline-flex', gap: '8px', alignItems: 'center', fontSize: '0.9rem' }}
                    >
                        <Github size={16} /> View on GitHub <ExternalLink size={12} />
                    </a>
                </div>
            </div>

            {/* Features overview */}
            <div className="glass-card animate-fade-in" style={{ padding: '32px', animationDelay: '0.3s' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <Zap size={24} color="#f59e0b" />
                    What KoalaSync Does
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <p style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #10b981', color: 'var(--text-main)', lineHeight: '1.6' }}>
                        <CheckCircle size={14} style={{ display: 'inline', marginRight: '8px', color: '#10b981' }} />
                        <strong>Video Sync:</strong> Keeps playback in sync for all room members — works with YouTube, Netflix, Emby and any HTML5 video player.
                    </p>
                    <p style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #6366f1', color: 'var(--text-main)', lineHeight: '1.6' }}>
                        <Zap size={14} style={{ display: 'inline', marginRight: '8px', color: '#6366f1' }} />
                        <strong>Force Sync:</strong> One-click button that pauses all users, seeks to the exact same timestamp, waits for buffering, then auto-plays simultaneously.
                    </p>
                    <p style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #3b82f6', color: 'var(--text-main)', lineHeight: '1.6' }}>
                        <CheckCircle size={14} style={{ display: 'inline', marginRight: '8px', color: '#3b82f6' }} />
                        <strong>Status Push:</strong> Minimal network traffic via a unidirectional heartbeat model — no constant ping-pong overhead.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ExtensionInfo;
