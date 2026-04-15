/**
 * bridge.js - Injected ONLY on timer.shik3i.net
 * This script acts as a bridge between the website's window.postMessage 
 * and the Chrome Extension's Background Worker.
 */

// Helper: check if extension context is still valid
function isContextValid() {
    try {
        return !!chrome.runtime?.id;
    } catch (e) {
        return false;
    }
}

// Listen for messages from the React application (timer.shik3i.net)
window.addEventListener('message', (event) => {
    if (!event.data) return;

    // React App asks if Extension is alive
    if (event.data.action === 'EXTENSION_PING') {
        window.postMessage({ action: isContextValid() ? 'EXTENSION_PONG' : 'EXTENSION_GONE' }, '*');
        return;
    }

    // New Generic Pipe: React App -> Extension (Inbound to Extension)
    if (event.data.type === 'EXTENSION_INBOUND' && event.data.payload) {
        if (!isContextValid()) return; // Extension was reloaded, silently drop
        chrome.runtime.sendMessage({
            source: 'timer_website',
            type: 'EXTENSION_INBOUND',
            payload: event.data.payload,
            senderName: event.data.senderName || null
        }).catch(err => console.debug('Bridge could not reach background worker:', err.message));
    }
});

// Proactively announce presence to the React App as soon as bridge.js is loaded
setTimeout(() => {
    if (isContextValid()) window.postMessage({ action: 'EXTENSION_PONG' }, '*');
}, 100);

// Listen for reverse messages from the Extension generic pipe
// and forward them to the React Website so it can sync the room.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isContextValid()) return;
    // New Generic Pipe: Extension -> React App (Outbound to React)
    if (message.type === 'EXTENSION_OUTBOUND' && message.payload) {
        window.postMessage({
            type: 'EXTENSION_OUTBOUND',
            payload: message.payload
        }, '*');
    }
});
