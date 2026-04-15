/**
 * background.js - Passive Receiver
 * No longer connects to Socket.IO.
 * Listens for messages from popup.js and bridge.js
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // We only care about EXTENSION_INBOUND and EXTENSION_OUTBOUND now
    if (message.type === 'EXTENSION_INBOUND' || message.type === 'EXTENSION_OUTBOUND') {
        if (!message.payload) return;

        const p = message.payload;

        // 1. Handle incoming ACKs from other users via the React Bridge
        if (message.type === 'EXTENSION_INBOUND' && p.action === 'EXTENSION_SYNC_ACK') {
            // senderName comes from the pipe (bridge.js → background.js)
            const ackName = message.senderName || p.userDisplayName || 'Unknown';
            chrome.storage.local.get(['history'], (storageData) => {
                const currentHistory = storageData.history || [];
                if (currentHistory.length === 0) return;

                const targetEntry = currentHistory.find(entry => entry.timestamp === p.timestamp && entry.action === p.originalAction);
                if (targetEntry) {
                    if (!targetEntry.acks) targetEntry.acks = [];
                    if (ackName && !targetEntry.acks.includes(ackName)) {
                        targetEntry.acks.push(ackName);
                        chrome.storage.local.set({ history: currentHistory });
                    }
                } else if (currentHistory[0] && currentHistory[0].action === p.originalAction) {
                    if (!currentHistory[0].acks) currentHistory[0].acks = [];
                    if (ackName && !currentHistory[0].acks.includes(ackName)) {
                        currentHistory[0].acks.push(ackName);
                        chrome.storage.local.set({ history: currentHistory });
                    }
                }
            });
            return true;
        }

        // 2. Handle version announcements from other users
        if (message.type === 'EXTENSION_INBOUND' && p.action === 'version_announce' && p.version) {
            const myVersion = chrome.runtime.getManifest().version;
            const compareVersions = (a, b) => {
                const pa = a.split('.').map(Number);
                const pb = b.split('.').map(Number);
                for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
                    const na = pa[i] || 0, nb = pb[i] || 0;
                    if (na < nb) return -1;
                    if (na > nb) return 1;
                }
                return 0;
            };
            if (compareVersions(myVersion, p.version) < 0) {
                chrome.storage.local.set({ updateAvailable: p.version });
            }
            return true;
        }

        // 2b. Handle tab_status announcements from other users
        if (message.type === 'EXTENSION_INBOUND' && p.action === 'tab_status') {
            const peerName = message.senderName || p.senderName || 'Unknown';
            chrome.storage.local.get(['roomPeers'], (data) => {
                const peers = data.roomPeers || {};
                peers[peerName] = {
                    tabTitle: p.tabTitle || null,
                    isReady: p.isReady || false,
                    version: p.version || null,
                    lastSeen: Date.now()
                };
                chrome.storage.local.set({ roomPeers: peers });
            });
            return true;
        }

        // 3. Handle actionable payloads (like play, pause, seek, etc.) meant for the Video Tab
        chrome.storage.local.get(['targetTabId', 'history'], (storageData) => {
            const currentHistory = storageData.history || [];
            const actionTarget = p.action || 'unknown_payload';

            // Log core actions to history
            if (['play', 'pause', 'force_sync_pause_seek', 'force_sync_play'].includes(actionTarget)) {
                const logEntry = {
                    action: actionTarget,
                    timestamp: p.timestamp || new Date().toISOString(),
                    source: message.source || 'extension',
                    senderName: message.senderName || (message.source === 'extension_popup' ? 'You' : null)
                };
                currentHistory.unshift(logEntry);
                chrome.storage.local.set({ history: currentHistory.slice(0, 50) });
            }

            if (storageData.targetTabId && storageData.targetTabId !== 'none') {
                const sendCommand = (retryCount = 0) => {
                    // Forward the payload directly to content.js
                    chrome.tabs.sendMessage(storageData.targetTabId, p).then((response) => {
                        if (!response) return;

                        // Verified ACK: content.js confirmed the action succeeded
                        if (response.status === 'playing' || response.status === 'paused') {
                            // Forward ACK to all React Timer tabs via OUTBOUND pipe
                            chrome.tabs.query({ url: ["*://timer.shik3i.net/*", "*://localhost/*", "*://*.timer.shik3i.net/*"] }, (tabs) => {
                                tabs.forEach(tab => {
                                    chrome.tabs.sendMessage(tab.id, {
                                        type: 'EXTENSION_OUTBOUND',
                                        payload: {
                                            action: 'EXTENSION_SYNC_ACK',
                                            originalAction: actionTarget,
                                            timestamp: p.timestamp
                                        }
                                    }).catch(() => { });
                                });
                            });
                        }

                        // Force Sync: content.js confirmed seek is ready
                        if (response.status === 'seek_ready') {
                            chrome.tabs.query({ url: ["*://timer.shik3i.net/*", "*://localhost/*", "*://*.timer.shik3i.net/*"] }, (tabs) => {
                                tabs.forEach(tab => {
                                    chrome.tabs.sendMessage(tab.id, {
                                        type: 'EXTENSION_OUTBOUND',
                                        payload: {
                                            action: 'force_sync_ready',
                                            currentTime: response.currentTime,
                                            readyState: response.readyState,
                                            timestamp: p.timestamp
                                        }
                                    }).catch(() => { });
                                });
                            });
                        }
                    }).catch(err => {
                        console.warn('Background: Failed to send message to target tab:', err.message);
                        if (retryCount === 0 && (err.message.includes('Receiving end does not exist') || err.message.includes('Could not establish connection'))) {
                            chrome.scripting.executeScript({
                                target: { tabId: storageData.targetTabId },
                                files: ['content.js']
                            }).then(() => setTimeout(() => sendCommand(1), 500)).catch(e => console.error("Inject Err", e));
                        }
                    });
                };
                sendCommand();
            }

            // 3. For Bidirectional Sync: Broadcast OUTBOUND payloads to Timer tabs
            if (message.type === 'EXTENSION_OUTBOUND') {
                chrome.tabs.query({ url: ["*://timer.shik3i.net/*", "*://localhost/*", "*://*.timer.shik3i.net/*"] }, (tabs) => {
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(tab.id, message).catch(() => { });
                    });
                });
            }
        });
    }

    return true; // async
});
