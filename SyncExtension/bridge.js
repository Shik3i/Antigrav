/**
 * bridge.js - Injected ONLY on timer.shik3i.net
 * This script acts as a bridge between the website's window.postMessage 
 * and the Chrome Extension's Background Worker.
 */

const ALLOWED_ORIGINS = new Set([
    'https://timer.shik3i.net',
    'http://localhost:3001'
]);

// Helper: check if extension context is still valid
function isContextValid() {
    try {
        return !!chrome.runtime?.id;
    } catch (e) {
        return false;
    }
}

// --- Environment Validation ---
chrome.storage.local.get(['bridgeDomainMode'], (data) => {
    const mode = data.bridgeDomainMode || 'production';
    const origin = window.location.origin;
    const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1');
    
    // If we are in production mode but on localhost, or vice-versa, stop.
    if (mode === 'production' && isLocal) {
        console.log('SyncExtension: Bridge disabled (Mode: Production, Origin: Localhost)');
        return;
    }
    if (mode === 'localhost' && !isLocal) {
        console.log('SyncExtension: Bridge disabled (Mode: Localhost, Origin: Production)');
        return;
    }

    initBridge();
});

function initBridge() {
    // Listen for messages from the React application (timer.shik3i.net)
    window.addEventListener('message', (event) => {
        if (!event.data) return;
        if (event.source !== window) return;
        if (!ALLOWED_ORIGINS.has(event.origin)) return;

        // React App asks if Extension is alive
        if (event.data.action === 'EXTENSION_PING') {
            window.postMessage(
                { action: isContextValid() ? 'EXTENSION_PONG' : 'EXTENSION_GONE' },
                window.location.origin
            );
            return;
        }

        // New Generic Pipe: React App -> Extension (Inbound to Extension)
        if (event.data.type === 'EXTENSION_INBOUND' && event.data.payload) {
            if (!isContextValid()) return; 
            try {
                chrome.runtime.sendMessage({
                    source: 'timer_website',
                    type: 'EXTENSION_INBOUND',
                    payload: event.data.payload,
                    senderName: event.data.senderName || null
                }).catch(err => {
                    if (isContextValid()) {
                        chrome.runtime.sendMessage({ type: 'ADD_DEV_LOG', message: `Bridge error: ${err.message}`, logType: 'warn' }).catch(() => {});
                    }
                });
            } catch (e) {
                if (isContextValid()) {
                    chrome.runtime.sendMessage({ type: 'ADD_DEV_LOG', message: `Bridge context error: ${e.message}`, logType: 'warn' }).catch(() => {});
                }
            }
        }
    });

    // Proactively announce presence to the React App as soon as bridge.js is loaded
    setTimeout(() => {
        if (isContextValid()) {
            window.postMessage({ action: 'EXTENSION_PONG' }, window.location.origin);
        }
    }, 100);

    // HEARTBEAT: Ping background.js every 15 seconds to keep it alive
    // and trigger a tab status broadcast.
    function sendHeartbeat() {
        if (!isContextValid()) return;
        chrome.runtime.sendMessage({ type: 'EXTENSION_HEARTBEAT', source: 'bridge' })
            .catch(err => {
                if (err.message?.includes('Receiving end does not exist')) {
                    setTimeout(() => {
                        if (isContextValid()) {
                            chrome.runtime.sendMessage({
                                type: 'EXTENSION_HEARTBEAT', source: 'bridge'
                            }).catch(e => {
                                 // Context likely gone now, console only
                                 console.warn('Bridge: Persistent heartbeat failure');
                            });
                        }
                    }, 1000);
                } else {
                    if (isContextValid()) {
                        chrome.runtime.sendMessage({ type: 'ADD_DEV_LOG', message: `Bridge heartbeat transient failure: ${err.message}`, logType: 'warn' }).catch(() => {});
                    }
                    // We do NOT clear the interval here as it might be a temporary context issue
                }
            });
    }
    setInterval(sendHeartbeat, 15000);

    // Listen for reverse messages from the Extension generic pipe
    // and forward them to the React Website so it can sync the room.
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!isContextValid()) return;
        // New Generic Pipe: Extension -> React App (Outbound to React)
        if (message.type === 'EXTENSION_OUTBOUND' && message.payload) {
            window.postMessage({
                type: 'EXTENSION_OUTBOUND',
                payload: message.payload
            }, window.location.origin);
        }
    });
}
