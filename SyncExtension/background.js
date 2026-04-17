/**
 * background.js - Passive Receiver
 * No longer connects to Socket.IO.
 * Listens for messages from popup.js and bridge.js
 */

const PRODUCTION_URLS = ["*://timer.shik3i.net/*", "*://*.timer.shik3i.net/*"];
const LOCALHOST_URLS = ["http://localhost:3001/*"];

async function getTimerTabUrls() {
    const data = await new Promise(r => chrome.storage.local.get(['bridgeDomainMode'], r));
    const mode = data.bridgeDomainMode || 'production';
    return mode === 'localhost' ? LOCALHOST_URLS : PRODUCTION_URLS;
}

// Bug 1 Fix: In-memory playback state cache so bridge.js heartbeats (which lack playbackState) never erase it
let cachedPlaybackState = null;

// Traffic Optimization: Cooldown for status broadcasts to prevent noise/bursts
let lastStatusBroadcastTime = 0;

function addDevLog(message, type = 'info') {
    chrome.storage.local.get(['devModeEnabled', 'devLogs'], (data) => {
        if (data.devModeEnabled !== true) return;
        
        const logs = data.devLogs || [];
        logs.unshift({
            timestamp: new Date().toISOString(),
            message,
            type
        });
        
        // Rolling buffer: keep only last 50 entries
        chrome.storage.local.set({ devLogs: logs.slice(0, 50) });
    });
}

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
    getTimerTabUrls().then(urls => {
        chrome.tabs.query({ url: urls }, (tabs) => {
            if (tabs.length === 0) {
                // Heartbeats are silent if no tabs found, but active commands log a warning
                if (['EXTENSION_PONG', 'EXTENSION_HEARTBEAT'].includes(message.type)) return;
                addDevLog(`No active Timer tabs (${urls[0]}...) found for broadcast`, 'info');
                return;
            }
            addDevLog(`Broadcasting ${message.type} to ${tabs.length} timer tab(s)`, 'info');
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, message).catch((err) => { 
                    addDevLog(`Failed to send to timer tab ${tab.id}: ${err.message}`, 'error');
                });
            });
        });
    });
}

function announceLocalTabStatus(reason = 'broadcast') {
    const now = Date.now();
    const cooldown = reason === 'broadcast' ? 500 : 2000;
    
    if (now - lastStatusBroadcastTime < cooldown) {
        if (reason === 'broadcast') {
            addDevLog(`Status broadcast throttled (${reason})`, 'info');
        }
        return;
    }

    chrome.storage.local.get(['targetTabId'], (storageData) => {
        const targetTabId = storageData.targetTabId;
        
        // LAZY STATUS: If no tab is selected and it's just a routine heartbeat, 
        // don't bother the room with "No tab selected" updates.
        if (reason !== 'broadcast' && (!targetTabId || targetTabId === 'none')) {
            return;
        }
        const playbackState = cachedPlaybackState;

        getOrCreateExtensionInstanceId((instanceId) => {
            const version = chrome.runtime.getManifest().version;
            
            const createPayload = (tabTitle, isReady) => ({
                action: 'tab_status',
                tabTitle,
                isReady,
                playbackState,
                version,
                instanceId,
                reason // 'broadcast' (needs reply) or 'response' (end of chain)
            });

            if (!targetTabId || targetTabId === 'none') {
                const payload = createPayload(null, false);
                addDevLog(`OUTBOUND: Status (${reason}) - No tab selected`, 'info');
                broadcastToTimerTabs({ type: 'EXTENSION_OUTBOUND', payload });
                return;
            }

            chrome.tabs.get(targetTabId, (tab) => {
                if (chrome.runtime.lastError || !tab) {
                    chrome.storage.local.set({ targetTabId: 'none' });
                    const payload = createPayload(null, false);
                    addDevLog(`OUTBOUND: Status (${reason}) - Tab ${targetTabId} not found`, 'warn');
                    broadcastToTimerTabs({ type: 'EXTENSION_OUTBOUND', payload });
                    return;
                }

                const tabTitle = tab.title ? tab.title.substring(0, 30) : null;
                const payload = createPayload(tabTitle, !!tabTitle);
                addDevLog(`OUTBOUND: Status (${reason}) - ${tabTitle || 'No Title'}`, 'success');
                lastStatusBroadcastTime = Date.now();
                broadcastToTimerTabs({ type: 'EXTENSION_OUTBOUND', payload });
            });
        });
    });
}

let forceSyncUpdateQueue = Promise.resolve();

function updateForceSyncState(timestamp, updater) {
    if (!timestamp) return;

    // Use a queue to prevent race conditions during simultaneous storage updates (e.g. multiple ACKs)
    forceSyncUpdateQueue = forceSyncUpdateQueue.then(() => {
        return new Promise((resolve) => {
            chrome.storage.local.get(['forceSyncState'], (storageData) => {
                try {
                    const nextState = updater(storageData.forceSyncState || {});
                    chrome.storage.local.set({ forceSyncState: nextState }, resolve);
                } catch (e) {
                    addDevLog(`Error in forceSyncState updater: ${e.message}`, 'error');
                    resolve();
                }
            });
        });
    });
}

function showPeerActionNotification(senderName, action) {
    chrome.storage.local.get(['notificationsEnabled'], (data) => {
        if (data.notificationsEnabled === false) return;

        let actionLabel = action === 'play' ? 'gestartet' :
                          action === 'pause' ? 'pausiert' :
                          action === 'force_sync_pause_seek' ? 'Synchronisierung gestartet' :
                          action === 'force_sync_play' ? 'Synchronisierung abgeschlossen' :
                          action.toUpperCase();

        const notificationId = `sync_${action}_${Date.now()}`;
        chrome.notifications.create(notificationId, {
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'Sync Extension',
            message: `${senderName || 'Ein Teilnehmer'} hat das Video ${actionLabel}.`,
            priority: 1
        });
    });
}

chrome.runtime.onInstalled.addListener(() => {
    // L4 Fix: Guard with .get to avoid recreating an existing alarm
    chrome.alarms.get('extension-tab-status-heartbeat', (alarm) => {
        if (!alarm) chrome.alarms.create('extension-tab-status-heartbeat', { periodInMinutes: 1 });
    });
});

chrome.runtime.onStartup.addListener(() => {
    chrome.alarms.get('extension-tab-status-heartbeat', (alarm) => {
        if (!alarm) chrome.alarms.create('extension-tab-status-heartbeat', { periodInMinutes: 1 });
    });
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'extension-tab-status-heartbeat') {
        announceLocalTabStatus('response');
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

// Bug C Fix: Removed duplicate global compareVersions – the local definition inside
// the version_announce handler is the only one used.

// Memory Cleanup: Prune peers that haven't been seen in > 1 minute to prevent storage bloat.
function pruneRoomPeers() {
    chrome.storage.local.get(['roomPeers'], (data) => {
        const peers = data.roomPeers || {};
        const now = Date.now();
        let changed = false;

        Object.keys(peers).forEach(name => {
            const lastSeen = peers[name].lastSeen;
            if (!lastSeen || (now - lastSeen) > 120 * 1000) {
                addDevLog(`Pruning inactive peer: ${name} (Last seen: ${lastSeen ? Math.round((now-lastSeen)/1000)+'s ago' : 'never'})`, 'info');
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
                addDevLog(`Proactively injected content.js into tab ${newId}`, 'success');
                console.log(`Background: Proactively injected sync script into tab ${newId}`);
                // Refresh status so the timer tab knows we are ready
                announceLocalTabStatus();
            }).catch(err => {
                addDevLog(`Proactive injection failed for tab ${newId}: ${err.message}`, 'error');
                console.warn(`Background: Proactive injection failed for tab ${newId}:`, err.message);
            });
        }
        updateBadgeStatus();
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Flag to keep the message channel open for async responses if needed
    let isAsync = false;

    // Bug A Fix: HEARTBEAT handled FIRST, outside the INBOUND/OUTBOUND block.
    // Previously this check was inside that block and could never be reached because
    // EXTENSION_HEARTBEAT doesn't match INBOUND or OUTBOUND.
    if (message.type === 'EXTENSION_HEARTBEAT') {
        if (message.source === 'content' && message.playbackState) {
            addDevLog(`Heartbeat (content): ${message.playbackState}`, 'info');
            if (cachedPlaybackState !== message.playbackState) {
                cachedPlaybackState = message.playbackState;
                // Write to storage so popup.js changes.localPlaybackState listener fires
                chrome.storage.local.set({ localPlaybackState: message.playbackState });
                announceLocalTabStatus('response');
            }
        } else if (message.source === 'bridge') {
            addDevLog(`Heartbeat (bridge): triggering quiet status update`, 'info');
            announceLocalTabStatus('response');
        }
    }

    // New Central Logging Service for all extension parts
    if (message.type === 'ADD_DEV_LOG') {
        addDevLog(message.message, message.logType || 'info');
        return;
    }

    // Also handle TAB_SELECTION_CHANGED here so it is never accidentally skipped
    if (message.type === 'TAB_SELECTION_CHANGED') {
        addDevLog('TAB_SELECTION_CHANGED detected -> broadcasting status', 'info');
        announceLocalTabStatus('broadcast'); 
    }

    if (message.type === 'EXTENSION_INBOUND' || message.type === 'EXTENSION_OUTBOUND') {
        if (!message.payload) return true;

        const p = message.payload;
        if (p.action !== 'tab_status') {
             addDevLog(`${message.type}: ${p.action}`, 'info');
        }

        // 1. Handle incoming ACKs from other users via the React Bridge
        if (message.type === 'EXTENSION_INBOUND' && p.action === 'EXTENSION_SYNC_ACK') {
            const ackName = message.senderName || p.userDisplayName || 'Unknown';
            addDevLog(`ACK received from ${ackName} for ${p.originalAction}`, 'success');
            
            // 1a. Update history (legacy)
            chrome.storage.local.get(['history'], (storageData) => {
                const currentHistory = storageData.history || [];
                if (currentHistory.length > 0) {
                    const targetEntry = currentHistory.find(entry => entry.timestamp === p.timestamp && entry.action === p.originalAction);
                    if (targetEntry) {
                        if (!targetEntry.acks) targetEntry.acks = [];
                        if (ackName && !targetEntry.acks.includes(ackName)) {
                            targetEntry.acks.push(ackName);
                            chrome.storage.local.set({ history: currentHistory });
                        }
                    }
                }
            });

            // 1b. Update forceSyncState for real-time Two-Phase validation
            if (p.originalAction === 'force_sync_pause_seek' && p.timestamp) {
                updateForceSyncState(p.timestamp, (currentState) => {
                    const remoteAcks = currentState.remoteAcks || {};
                    remoteAcks[ackName] = true;
                    return { ...currentState, remoteAcks, updatedAt: Date.now() };
                });
            }
            return;
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
                if (p.instanceId && p.instanceId === instanceId) {
                    addDevLog(`INBOUND: Status from self (ignored) - ID: ${p.instanceId}`, 'info');
                    return;
                }

                const peerName = message.senderName || p.senderName || 'Unknown';
                const reason = p.reason || 'broadcast';
                addDevLog(`INBOUND: Status (${reason}) from ${peerName}`, 'success');

                chrome.storage.local.get(['roomPeers'], (data) => {
                    const peers = data.roomPeers || {};
                    const existing = peers[peerName] || {};
                    peers[peerName] = {
                        tabTitle:      p.tabTitle      ?? existing.tabTitle,
                        isReady:       p.isReady       ?? existing.isReady,
                        playbackState: p.playbackState ?? existing.playbackState,
                        version:       p.version       ?? existing.version,
                        instanceId:    p.instanceId    ?? existing.instanceId,
                        lastSeen:      Date.now()
                    };
                    chrome.storage.local.set({ roomPeers: peers });
                });

                // RESPONSE LOGIC:
                // Only reply if the sender asked for a broadcast (discovery).
                // If they explicitly sent a 'response', we stop here to avoid infinite loops.
                if (reason === 'broadcast') {
                    addDevLog(`Responding to ${peerName}'s discovery broadcast...`, 'info');
                    announceLocalTabStatus('response');
                } else {
                    addDevLog(`Peer ${peerName} sent a response - chain ends here.`, 'info');
                }
            });
            return true;
        }

        // 2c. Track force-sync readiness from the room
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
                    return { ...currentState, timestamp: p.timestamp, remoteReady };
                });
            });
            return true;
        }

        // Bug B Fix: Broadcast EXTENSION_OUTBOUND to timer tabs IMMEDIATELY and
        // UNCONDITIONALLY before entering the storage.get block. This ensures:
        // (a) even without a targetTabId, native events reach the timer website, and
        // (b) we can return early for video_native_event to prevent echo-looping
        //     (content.js fired a native play/pause → background must NOT send it back).
        if (message.type === 'EXTENSION_OUTBOUND') {
            broadcastToTimerTabs(message);
            if (message.source === 'video_native_event') {
                // Native events are already done – only the broadcast above is needed.
                // Sending a command back to content.js would cause an infinite echo loop.
                return true;
            }
        }

        // 3. Handle actionable payloads (play, pause, seek, force_sync)
        //    Applies to: OUTBOUND from popup, INBOUND from remote peers
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
                        remoteAcks: {},
                        error: null,
                        updatedAt: Date.now()
                    }
                });
            }
            
            // Bug Fix: Immediate ACK for Force Sync (Receipt Confirmation)
            // This ensures the initiator doesn't wait 5 seconds for peers that are just buffering.
            if (message.type === 'EXTENSION_INBOUND' && actionTarget === 'force_sync_pause_seek') {
                addDevLog(`Immediate ACK sent for ${actionTarget}`, 'info');
                broadcastToTimerTabs({
                    type: 'EXTENSION_OUTBOUND',
                    payload: {
                        action: 'EXTENSION_SYNC_ACK',
                        originalAction: actionTarget,
                        timestamp: p.timestamp
                    }
                });
            }

            // Log core actions to history
            if (['play', 'pause', 'force_sync_pause_seek', 'force_sync_play'].includes(actionTarget)) {
                addDevLog(`Action Logger: ${message.type} ${actionTarget} from ${message.source || 'remote'}`, 'info');
                const logEntry = {
                    action: actionTarget,
                    timestamp: p.timestamp || new Date().toISOString(),
                    source: message.source || 'extension',
                    senderName: message.senderName || (message.source === 'extension_popup' ? 'You' : null)
                };
                currentHistory.unshift(logEntry);
                chrome.storage.local.set({ history: currentHistory.slice(0, 50) });

                // Show notification for inbound actions from remote peers
                if (message.type === 'EXTENSION_INBOUND' && message.senderName) {
                    showPeerActionNotification(message.senderName, actionTarget);
                }
            }

            if (storageData.targetTabId && storageData.targetTabId !== 'none') {
                const sendCommand = (retryCount = 0) => {
                    chrome.tabs.sendMessage(storageData.targetTabId, p).then((response) => {
                        if (!response) return;

                        // Verified ACK: content.js confirmed the action succeeded
                        if (response.status === 'playing' || response.status === 'paused') {
                            const newState = response.status === 'playing' ? 'playing' : 'paused';
                            if (cachedPlaybackState !== newState) {
                                cachedPlaybackState = newState;
                                // Write to storage so popup.js changes.localPlaybackState listener fires
                                chrome.storage.local.set({ localPlaybackState: newState });
                            }
                            announceLocalTabStatus();
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
                            addDevLog(`Force Sync Phase 1 Ready: Tab ${storageData.targetTabId} at ${response.currentTime}`, 'success');
                            
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
                        addDevLog(`Failed to send message to target tab: ${err.message}`, 'error');
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
                                addDevLog(`Retry injection failed: ${e.message}`, 'error');
                                console.error('Inject Err', e.message);
                                if (e.message.includes('No tab with id')) {
                                    chrome.storage.local.set({ targetTabId: 'none' });
                                }
                            });
                        }
                    });
                };
                sendCommand();
            }
        });
        isAsync = true;
    }

    return isAsync;
});
