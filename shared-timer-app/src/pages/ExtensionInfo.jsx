import React from 'react';
import { Link } from 'react-router-dom';
import { Download, ArrowLeft, Settings, CheckCircle, Zap } from 'lucide-react';

const ExtensionInfo = () => {
    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 0' }}>
            <Link to="/settings" className="btn-ghost" style={{ marginBottom: '24px', display: 'inline-flex' }}>
                <ArrowLeft size={20} /> Back to Settings
            </Link>

            <h1 style={{ marginBottom: '16px' }}>KoalaSync Media Extension</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '32px' }}>
                Synchronize video playback seamlessly with everyone in your KoalaSync room. Works with YouTube, Netflix, Emby, and almost any HTML5 video player!
            </p>

            <div className="glass-card animate-fade-in" style={{ padding: '32px', marginBottom: '32px' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <Download size={24} color="var(--accent-primary)" />
                    1. Download Extension
                </h2>
                <p style={{ marginBottom: '12px', color: 'var(--text-main)', lineHeight: '1.5' }}>
                    Download the latest version (<strong>v1.9</strong>) of the KoalaSync extension as a ZIP file.
                </p>
                <p style={{ marginBottom: '24px', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                    Don't worry about missing updates — the extension will notify you automatically when someone in your room has a newer version!
                </p>
                <a
                    href="https://drive.google.com/drive/folders/10F_rwk_W82lOBiqq0k4XHVSWb4W_iAgj?usp=sharing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary"
                    style={{ textDecoration: 'none', display: 'inline-flex' }}
                >
                    Download from Google Drive
                </a>
            </div>

            <div className="glass-card animate-fade-in" style={{ padding: '32px', marginBottom: '32px', animationDelay: '0.1s' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <Settings size={24} color="var(--accent-secondary)" />
                    2. Installation (Chrome / Edge / Opera / Brave)
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ background: 'var(--bg-sidebar)', padding: '6px 14px', borderRadius: '8px', fontWeight: 'bold', height: 'fit-content' }}>Step 1</div>
                        <div style={{ padding: '4px 0', color: 'var(--text-main)', lineHeight: '1.5' }}>Extract the downloaded ZIP file into a new folder on your computer.</div>
                    </div>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ background: 'var(--bg-sidebar)', padding: '6px 14px', borderRadius: '8px', fontWeight: 'bold', height: 'fit-content' }}>Step 2</div>
                        <div style={{ padding: '4px 0', color: 'var(--text-main)', lineHeight: '1.5' }}>Open your browser's extensions page: <code>chrome://extensions/</code> (or <code>opera://extensions/</code> for Opera).</div>
                    </div>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ background: 'var(--bg-sidebar)', padding: '6px 14px', borderRadius: '8px', fontWeight: 'bold', height: 'fit-content' }}>Step 3</div>
                        <div style={{ padding: '4px 0', color: 'var(--text-main)', lineHeight: '1.5' }}>Enable <strong>Developer mode</strong> using the toggle switch in the top right corner.</div>
                    </div>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ background: 'var(--bg-sidebar)', padding: '6px 14px', borderRadius: '8px', fontWeight: 'bold', height: 'fit-content' }}>Step 4</div>
                        <div style={{ padding: '4px 0', color: 'var(--text-main)', lineHeight: '1.5' }}>Click <strong>Load unpacked</strong> ("Entpackte Erweiterung laden") and select the extracted folder.</div>
                    </div>
                    <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #6366f1', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                        <strong>💡 Updating:</strong> To update, replace the old folder with the new one and click the reload button (🔄) on your extensions page. No need to uninstall!
                    </div>
                </div>
            </div>

            <div className="glass-card animate-fade-in" style={{ padding: '32px', marginBottom: '32px', animationDelay: '0.2s' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <CheckCircle size={24} color="#10b981" />
                    3. How to Use
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: 'var(--text-main)', lineHeight: '1.6' }}>
                    <p>
                        <strong>1. Connect passively:</strong> Once installed, simply have this timer website open in one tab and join a room. The extension popup will automatically show "Connected to Room" in green. No setup needed!
                    </p>
                    <p>
                        <strong>2. Select your video:</strong> Open your video (e.g. YouTube, Netflix, Emby). Then open the extension popup and select that specific tab from the <strong>"Target Tab"</strong> dropdown.
                    </p>
                    <p>
                        <strong>3. Sync playback:</strong> Use the Play/Pause buttons in the extension popup, or the global Play/Pause buttons on the Timer page. Commands sync to all users in your room automatically.
                    </p>
                </div>
            </div>

            <div className="glass-card animate-fade-in" style={{ padding: '32px', animationDelay: '0.3s' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <Zap size={24} color="#f59e0b" />
                    4. Features
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', color: 'var(--text-main)', lineHeight: '1.6' }}>
                    <p style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #10b981' }}>
                        <strong>✅ Verified ACKs:</strong> See exactly which users successfully executed your play/pause command in real-time under "History".
                    </p>
                    <p style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #6366f1' }}>
                        <strong>⏱ Force Sync:</strong> One-click button that pauses all users, seeks to the exact same timestamp, waits for buffering, then auto-plays simultaneously.
                    </p>
                    <p style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #f59e0b' }}>
                        <strong>🔔 Auto-Update Check:</strong> The extension compares version numbers with other users in the room and notifies you if an update is available.
                    </p>
                    <p style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #8b5cf6' }}>
                        <strong>🔧 Dev Tab:</strong> Built-in diagnostics showing video detection, playback state, current time, buffer status, and source URL.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ExtensionInfo;
