/**
 * background.js - Passive Receiver
 * No longer connects to Socket.IO.
 * Listens for messages from popup.js and bridge.js
 */

const TIMER_TAB_URLS = ["*://timer.shik3i.net/*", "http://localhost:3001/*", "*://*.timer.shik3i.net/*"];

function getOrCreateExtensionInstanceId(callback) {
    chrome.storage.local.get(['extensionInstanceId'], (storageData) => {
        if (storageData.extensionInstanceId) {
            callback(storageData.extensionInstanceId);
            return;
        }

        const instanceId = crypto.randomUUID();
        chrome.storage.local.set({ extensionInstanceId: instanceId }, () => callback(instanceId));
    });
}

function broadcastToTimerTabs(message) {
    chrome.tabs.query({ url: TIMER_TAB_URLS }, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, message).catch(() => { });
        });
    });
}

function announceLocalTabStatus() {
    chrome.storage.local.get(['targetTabId'], (storageData) => {
        const targetTabId = storageData.targetTabId;

        getOrCreateExtensionInstanceId((instanceId) => {
            const version = chrome.runtime.getManifest().version;

            if (!targetTabId || targetTabId === 'none') {
                broadcastToTimerTabs({
                    type: 'EXTENSION_OUTBOUND',
                    payload: {
                        action: 'tab_status',
                        tabTitle: null,
                        isReady: false,
                        version,
                        instanceId
                    }
                });
                return;
            }

            chrome.tabs.get(targetTabId, (tab) => {
                if (chrome.runtime.lastError || !tab) {
                    // TAB IS GONE: Clear the target for the user to prevent stuck state
                    chrome.storage.local.set({ targetTabId: 'none' });
                    
                    broadcastToTimerTabs({
                        type: 'EXTENSION_OUTBOUND',
                        payload: {
                            action: 'tab_status',
                            tabTitle: null,
                            isReady: false,
                            version,
                            instanceId
                        }
                    });
                    return;
                }

                const tabTitle = tab.title ? tab.title.substring(0, 30) : null;
                broadcastToTimerTabs({
                    type: 'EXTENSION_OUTBOUND',
                    payload: {
                        action: 'tab_status',
                        tabTitle,
                        isReady: !!tabTitle,
                        version,
                        instanceId
                    }
                });
            });
        });
    });
}

function updateForceSyncState(timestamp, updater) {
    if (!timestamp) return;

    chrome.storage.local.get(['forceSyncState'], (storageData) => {
        const nextState = updater(storageData.forceSyncState || {});
        chrome.storage.local.set({ forceSyncState: nextState });
    });
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create('extension-tab-status-heartbeat', { periodInMinutes: 1 });
});

chrome.runtime.onStartup.addListener(() => {
    chrome.alarms.create('extension-tab-status-heartbeat', { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'extension-tab-status-heartbeat') {
        announceLocalTabStatus();
        updateBadgeStatus();
        pruneRoomPeers(); // Periodically clean up old peers
    }
});
function updateBadgeStatus() {
    chrome.storage.local.get(['targetTabId'], (data) => {
        if (data.targetTabId && data.targetTabId !== 'none') {
            chrome.action.setBadgeText({ text: 'ON' });
            chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
        } else {
            chrome.action.setBadgeText({ text: '' });
        }
    });
}

function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pa[i] || 0) - (pb[i] || 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

// Memory Cleanup: Prune peers that haven't been seen in > 1 minute to prevent storage bloat.
function pruneRoomPeers() {
    chrome.storage.local.get(['roomPeers'], (data) => {
        const peers = data.roomPeers || {};
        const now = Date.now();
        let changed = false;

        Object.keys(peers).forEach(name => {
            if ((now - peers[name].lastSeen) > 60 * 1000) {
                delete peers[name];
                changed = true;
            }
        });

        if (changed) {
            chrome.storage.local.set({ roomPeers: peers });
        }
    });
}

// Monitor Tab closure: If the target tab is closed, clear it immediately.
chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.storage.local.get(['targetTabId'], (data) => {
        if (data.targetTabId === tabId) {
            chrome.storage.local.set({ targetTabId: 'none' });
            updateBadgeStatus();
            announceLocalTabStatus();
        }
    });
});

// Proactive Injection: When the user selects a target tab, inject the sync logic immediately.
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.targetTabId) {
        const newId = changes.targetTabId.newValue;
        if (newId && newId !== 'none') {
            chrome.scripting.executeScript({
                target: { tabId: newId },
                files: ['content.js']
            }).then(() => {
                console.log(`Background: Proactively injected sync script into tab ${newId}`);
                // Refresh status so the timer tab knows we are ready
                announceLocalTabStatus();
            }).catch(err => {
                console.warn(`Background: Proactive injection failed for tab ${newId}:`, err.message);
            });
        }
        updateBadgeStatus();
    }
});

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
                }
            });
            return true;
        }

        // 2. Handle version announcements from other users
        if (message.type === 'EXTENSION_INBOUND' && p.action === 'version_announce' && p.version) {
            getOrCreateExtensionInstanceId((instanceId) => {
                if (p.instanceId && p.instanceId === instanceId) return;

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
            });
            return true;
        }

        // 2b. Handle tab_status announcements from other users
        if (message.type === 'EXTENSION_INBOUND' && p.action === 'tab_status') {
            getOrCreateExtensionInstanceId((instanceId) => {
                if (p.instanceId && p.instanceId === instanceId) return;

                const peerName = message.senderName || p.senderName || 'Unknown';
                chrome.storage.local.get(['roomPeers'], (data) => {
                    const peers = data.roomPeers || {};
                    peers[peerName] = {
                        tabTitle: p.tabTitle || null,
                        isReady: p.isReady || false,
                        version: p.version || null,
                        instanceId: p.instanceId || null,
                        lastSeen: Date.now()
                    };
                    chrome.storage.local.set({ roomPeers: peers });
                });
            });
            return true;
        }

        // 2c. Track force-sync readiness from the room so the popup can wait on a real signal
        if (message.type === 'EXTENSION_INBOUND' && p.action === 'force_sync_ready' && p.timestamp) {
            getOrCreateExtensionInstanceId((instanceId) => {
                if (p.instanceId && p.instanceId === instanceId) return;

                const peerName = message.senderName || p.senderName || 'Unknown';
                updateForceSyncState(p.timestamp, (currentState) => {
                    const remoteReady = { ...(currentState.remoteReady || {}) };
                    remoteReady[peerName] = {
                        currentTime: p.currentTime ?? null,
                        readyState: p.readyState ?? null,
                        instanceId: p.instanceId || null,
                        updatedAt: Date.now()
                    };

                    return {
                        ...currentState,
                        timestamp: p.timestamp,
                        remoteReady
                    };
                });
            });
            return true;
        }

        // 2d. Handle Heartbeat (Keep-Alive) from content.js or bridge.js
        if (message.type === 'EXTENSION_HEARTBEAT') {
            // Heartbeat only keeps the service worker alive.
            // announceLocalTabStatus and updateBadgeStatus are handled by the 1min alarm.
            return true;
        }

        // 3. Handle actionable payloads (like play, pause, seek, etc.) meant for the Video Tab
        chrome.storage.local.get(['targetTabId', 'history'], (storageData) => {
            const currentHistory = storageData.history || [];
            const actionTarget = p.action || 'unknown_payload';

            if (actionTarget === 'force_sync_pause_seek' && p.timestamp) {
                chrome.storage.local.set({
                    forceSyncState: {
                        timestamp: p.timestamp,
                        stage: 'seeking',
                        targetTime: p.targetTime ?? null,
                        localReady: false,
                        remoteReady: {},
                        error: null,
                        updatedAt: Date.now()
                    }
                });
            }

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
                            broadcastToTimerTabs({
                                type: 'EXTENSION_OUTBOUND',
                                payload: {
                                    action: 'EXTENSION_SYNC_ACK',
                                    originalAction: actionTarget,
                                    timestamp: p.timestamp
                                }
                            });
                        }

                        // Force Sync: content.js confirmed seek is ready
                        if (response.status === 'seek_ready') {
                            updateForceSyncState(p.timestamp, (currentState) => ({
                                ...currentState,
                                timestamp: p.timestamp,
                                stage: 'ready',
                                localReady: true,
                                localCurrentTime: response.currentTime,
                                localReadyState: response.readyState,
                                error: null,
                                updatedAt: Date.now()
                            }));

                            getOrCreateExtensionInstanceId((instanceId) => {
                                broadcastToTimerTabs({
                                    type: 'EXTENSION_OUTBOUND',
                                    payload: {
                                        action: 'force_sync_ready',
                                        currentTime: response.currentTime,
                                        readyState: response.readyState,
                                        timestamp: p.timestamp,
                                        instanceId
                                    }
                                });
                            });
                        }

                        if (response.status === 'seek_timeout' || response.status === 'no_video') {
                            updateForceSyncState(p.timestamp, (currentState) => ({
                                ...currentState,
                                timestamp: p.timestamp,
                                stage: 'error',
                                localReady: false,
                                error: response.status,
                                updatedAt: Date.now()
                            }));
                        }
                    }).catch(err => {
                        console.warn('Background: Failed to send message to target tab:', err.message);
                        updateForceSyncState(p.timestamp, (currentState) => ({
                            ...currentState,
                            timestamp: p.timestamp,
                            stage: 'error',
                            localReady: false,
                            error: err.message,
                            updatedAt: Date.now()
                        }));
                        if (retryCount === 0 && (err.message.includes('Receiving end does not exist') || err.message.includes('Could not establish connection'))) {
                            chrome.scripting.executeScript({
                                target: { tabId: storageData.targetTabId },
                                files: ['content.js']
                            }).then(() => {
                                setTimeout(() => sendCommand(1), 500);
                            }).catch(e => {
                                // Double safety: tab might have closed between check and injection
                                console.error("Inject Err", e.message);
                                if (e.message.includes('No tab with id')) {
                                    chrome.storage.local.set({ targetTabId: 'none' });
                                }
                            });
                        }
                    });
                };
                sendCommand();
            }

            // 3. For Bidirectional Sync: Broadcast OUTBOUND payloads to Timer tabs
            if (message.type === 'EXTENSION_OUTBOUND') {
                broadcastToTimerTabs(message);
            }
        });
    }

    return true; // async
});
