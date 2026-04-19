/**
 * background.js
 *
 * Kommunikationsmodell:
 *  - Alle 15s kommt ein Bridge-Heartbeat → wir senden sofort unseren vollen Status (tab_status) an den Room
 *  - Tab-Wechsel → sofort Status senden
 *  - Befehle (play/pause/force_sync) → ausführen + ACK zurück senden
 *  - Eingehender tab_status von Peers → einfach in roomPeers speichern, KEINE Antwort
 *  - Kein broadcast/response Pingpong
 *  - Peer-Prune-Alarm alle 2 Minuten (nur Housekeeping, kein Netzwerk-Traffic)
 */

const PRODUCTION_URLS = ["*://timer.shik3i.net/*", "*://*.timer.shik3i.net/*"];
const LOCALHOST_URLS  = ["http://localhost:3001/*"];

async function getTimerTabUrls() {
    const data = await new Promise(r => chrome.storage.local.get(['bridgeDomainMode'], r));
    return (data.bridgeDomainMode || 'production') === 'localhost' ? LOCALHOST_URLS : PRODUCTION_URLS;
}

// In-memory cache — vermeidet redundante Storage-Reads bei jedem Heartbeat
let cachedPlaybackState = null; // 'playing' | 'paused' | null
let cachedVideoReady    = false; // video.readyState >= 3

// Cooldown damit ein Burst von Events den Room nicht flutet
let lastStatusSentTime = 0;
const STATUS_COOLDOWN_MS = 500;

// ─── Logging ─────────────────────────────────────────────────────────────────

function addDevLog(message, type = 'info') {
    chrome.storage.local.get(['devModeEnabled', 'devLogs'], (data) => {
        if (data.devModeEnabled !== true) return;
        const logs = data.devLogs || [];
        logs.unshift({ timestamp: new Date().toISOString(), message, type });
        chrome.storage.local.set({ devLogs: logs.slice(0, 50) });
    });
}

// ─── Instance ID ──────────────────────────────────────────────────────────────

function getOrCreateExtensionInstanceId(callback) {
    chrome.storage.local.get(['extensionInstanceId'], (data) => {
        if (data.extensionInstanceId) { callback(data.extensionInstanceId); return; }
        const id = crypto.randomUUID();
        chrome.storage.local.set({ extensionInstanceId: id }, () => callback(id));
    });
}

// ─── Senden an Room-Tab(s) ────────────────────────────────────────────────────

function broadcastToTimerTabs(message) {
    getTimerTabUrls().then(urls => {
        chrome.tabs.query({ url: urls }, (tabs) => {
            if (!tabs.length) return;
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, message).catch(err => {
                    addDevLog(`Broadcast zu Timer-Tab ${tab.id} fehlgeschlagen: ${err.message}`, 'error');
                });
            });
        });
    });
}

// ─── Unseren Status an den Room senden ───────────────────────────────────────
// Wird bei jedem Bridge-Heartbeat und sofort bei Tab-Wechsel aufgerufen.
// Peers empfangen das als EXTENSION_INBOUND { action: 'tab_status' } und speichern es nur.

function sendStatusToRoom() {
    const now = Date.now();
    if (now - lastStatusSentTime < STATUS_COOLDOWN_MS) return;
    lastStatusSentTime = now;

    chrome.storage.local.get(['targetTabId'], (data) => {
        const targetTabId = data.targetTabId;

        getOrCreateExtensionInstanceId((instanceId) => {
            const version = chrome.runtime.getManifest().version;

            const buildPayload = (tabTitle) => ({
                action:        'tab_status',
                tabTitle,
                isReady:       cachedVideoReady,
                playbackState: cachedPlaybackState,
                version,
                instanceId
            });

            if (!targetTabId || targetTabId === 'none') {
                broadcastToTimerTabs({ type: 'EXTENSION_OUTBOUND', payload: buildPayload(null) });
                return;
            }

            chrome.tabs.get(targetTabId, (tab) => {
                if (chrome.runtime.lastError || !tab) {
                    // Tab ist weg — aufräumen
                    chrome.storage.local.set({ targetTabId: 'none' });
                    updateBadgeStatus();
                    broadcastToTimerTabs({ type: 'EXTENSION_OUTBOUND', payload: buildPayload(null) });
                    return;
                }
                const tabTitle = tab.title ? tab.title.substring(0, 30) : null;
                addDevLog(`Status gesendet: "${tabTitle}" isReady=${cachedVideoReady} ${cachedPlaybackState}`, 'info');
                broadcastToTimerTabs({ type: 'EXTENSION_OUTBOUND', payload: buildPayload(tabTitle) });
            });
        });
    });
}

// ─── Force Sync State (Queue gegen Race Conditions) ───────────────────────────

let forceSyncWriteQueue = Promise.resolve();

function updateForceSyncState(timestamp, updater) {
    if (!timestamp) return;
    forceSyncWriteQueue = forceSyncWriteQueue.then(() => new Promise(resolve => {
        chrome.storage.local.get(['forceSyncState'], (data) => {
            try {
                const next = updater(data.forceSyncState || {});
                chrome.storage.local.set({ forceSyncState: next }, resolve);
            } catch (e) {
                addDevLog(`forceSyncState updater Fehler: ${e.message}`, 'error');
                resolve();
            }
        });
    }));
}

// ─── Benachrichtigungen ───────────────────────────────────────────────────────

function showPeerActionNotification(senderName, action) {
    chrome.storage.local.get(['notificationsEnabled'], (data) => {
        if (data.notificationsEnabled === false) return;
        const label = action === 'play'                  ? 'gestartet' :
                      action === 'pause'                 ? 'pausiert' :
                      action === 'force_sync_pause_seek' ? 'Synchronisierung gestartet' :
                      action === 'force_sync_play'       ? 'Synchronisierung abgeschlossen' :
                      action.toUpperCase();
        chrome.notifications.create(`sync_${action}_${Date.now()}`, {
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'Sync Extension',
            message: `${senderName || 'Ein Teilnehmer'} hat das Video ${label}.`,
            priority: 1
        });
    });
}

// ─── Badge ────────────────────────────────────────────────────────────────────

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

// ─── Inaktive Peers entfernen ─────────────────────────────────────────────────
// Ein Peer der 4 Heartbeat-Zyklen (60s) nichts gesendet hat gilt als offline.

function pruneRoomPeers() {
    chrome.storage.local.get(['roomPeers'], (data) => {
        const peers = data.roomPeers || {};
        const now = Date.now();
        let changed = false;
        Object.keys(peers).forEach(name => {
            const lastSeen = peers[name].lastSeen;
            if (!lastSeen || (now - lastSeen) > 60 * 1000) {
                addDevLog(`Peer entfernt: ${name} (zuletzt: ${lastSeen ? Math.round((now - lastSeen) / 1000) + 's' : 'nie'})`, 'info');
                delete peers[name];
                changed = true;
            }
        });
        if (changed) chrome.storage.local.set({ roomPeers: peers });
    });
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
    // Alten Alarm-Namen löschen (Migration von vorheriger Version)
    chrome.alarms.clear('extension-tab-status-heartbeat');
    chrome.alarms.get('extension-peer-prune', (alarm) => {
        if (!alarm) chrome.alarms.create('extension-peer-prune', { periodInMinutes: 2 });
    });
});

chrome.runtime.onStartup.addListener(() => {
    chrome.alarms.get('extension-peer-prune', (alarm) => {
        if (!alarm) chrome.alarms.create('extension-peer-prune', { periodInMinutes: 2 });
    });
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'extension-peer-prune') {
        updateBadgeStatus();
        pruneRoomPeers();
    }
});

// ─── Tab geschlossen ──────────────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.storage.local.get(['targetTabId'], (data) => {
        if (data.targetTabId === tabId) {
            chrome.storage.local.set({ targetTabId: 'none' });
            cachedPlaybackState = null;
            cachedVideoReady = false;
            updateBadgeStatus();
            sendStatusToRoom();
        }
    });
});

// ─── Tab-Wechsel → content.js injizieren + sofort Status senden ───────────────

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.targetTabId) return;
    const newId = changes.targetTabId.newValue;
    // Cache zurücksetzen da neuer Tab
    cachedPlaybackState = null;
    cachedVideoReady = false;
    if (newId && newId !== 'none') {
        chrome.scripting.executeScript({
            target: { tabId: newId },
            files: ['content.js']
        }).then(() => {
            addDevLog(`content.js in Tab ${newId} injiziert`, 'success');
            sendStatusToRoom();
        }).catch(err => {
            addDevLog(`Injektion in Tab ${newId} fehlgeschlagen: ${err.message}`, 'error');
            if (err.message.includes('No tab with id')) {
                chrome.storage.local.set({ targetTabId: 'none' });
            }
        });
    } else {
        sendStatusToRoom();
    }
    updateBadgeStatus();
});

// ─── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    let isAsync = false;

    // ── Logging von anderen Extension-Teilen ──────────────────────────────────
    if (message.type === 'ADD_DEV_LOG') {
        addDevLog(message.message, message.logType || 'info');
        return false;
    }

    // ── Heartbeat von bridge.js ───────────────────────────────────────────────
    // Bridge lebt = Room-Tab ist offen = unseren vollen Status an alle Peers senden.
    // Das ist der einzige Mechanismus für Peer-Discovery. Keine Antwort nötig.
    if (message.type === 'EXTENSION_HEARTBEAT' && message.source === 'bridge') {
        addDevLog('Heartbeat (bridge): sende Status an Room', 'info');
        sendStatusToRoom();
        return false;
    }

    // ── Heartbeat von content.js ──────────────────────────────────────────────
    // Enthält aktuellen Playback-Status und Video-ReadyState des Ziel-Tabs.
    // Nur Cache updaten — wird beim nächsten Bridge-Heartbeat automatisch mitgesendet.
    if (message.type === 'EXTENSION_HEARTBEAT' && message.source === 'content') {
        addDevLog(`Heartbeat (content): ${message.playbackState}, readyState: ${message.videoReadyState ?? 'n/a'}`, 'info');
        if (message.playbackState && cachedPlaybackState !== message.playbackState) {
            cachedPlaybackState = message.playbackState;
            chrome.storage.local.set({ localPlaybackState: message.playbackState });
        }
        const nowReady = (message.videoReadyState ?? 0) >= 3;
        cachedVideoReady = nowReady;
        return false;
    }

    // ── Tab-Selektion geändert (aus popup.js) ─────────────────────────────────
    if (message.type === 'TAB_SELECTION_CHANGED') {
        addDevLog('TAB_SELECTION_CHANGED → Status sofort senden', 'info');
        // Cooldown ignorieren — Tab-Wechsel soll immer sofort durch
        lastStatusSentTime = 0;
        sendStatusToRoom();
        return false;
    }

    // ── INBOUND / OUTBOUND Payloads ───────────────────────────────────────────
    if (message.type === 'EXTENSION_INBOUND' || message.type === 'EXTENSION_OUTBOUND') {
        if (!message.payload) return false;

        const p = message.payload;
        addDevLog(`${message.type}: ${p.action}`, 'info');

        // ── ACK von einem Peer empfangen ──────────────────────────────────────
        if (message.type === 'EXTENSION_INBOUND' && p.action === 'EXTENSION_SYNC_ACK') {
            const ackName = message.senderName || p.userDisplayName || 'Unknown';
            addDevLog(`ACK von ${ackName} für ${p.originalAction}`, 'success');

            chrome.storage.local.get(['history'], (data) => {
                const history = data.history || [];
                const entry = history.find(e => e.timestamp === p.timestamp && e.action === p.originalAction);
                if (entry) {
                    if (!entry.acks) entry.acks = [];
                    if (ackName && !entry.acks.includes(ackName)) {
                        entry.acks.push(ackName);
                        chrome.storage.local.set({ history });
                    }
                }
            });

            if (p.originalAction === 'force_sync_pause_seek' && p.timestamp) {
                updateForceSyncState(p.timestamp, (state) => {
                    const remoteAcks = state.remoteAcks || {};
                    remoteAcks[ackName] = true;
                    return { ...state, remoteAcks, updatedAt: Date.now() };
                });
            }
            return false;
        }

        // ── Version-Ankündigung von Peer ──────────────────────────────────────
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
            return false;
        }

        // ── tab_status von Peer empfangen → speichern, KEINE Antwort ─────────
        if (message.type === 'EXTENSION_INBOUND' && p.action === 'tab_status') {
            getOrCreateExtensionInstanceId((instanceId) => {
                if (p.instanceId && p.instanceId === instanceId) return; // eigene Nachricht ignorieren

                const peerName = message.senderName || p.senderName || 'Unknown';
                addDevLog(`Peer-Status von ${peerName}: isReady=${p.isReady} ${p.playbackState}`, 'success');

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
                // Kein sendStatusToRoom() — der nächste Bridge-Heartbeat sendet unseren Status
            });
            return false;
        }

        // ── Force Sync Ready von Peer ─────────────────────────────────────────
        if (message.type === 'EXTENSION_INBOUND' && p.action === 'force_sync_ready' && p.timestamp) {
            getOrCreateExtensionInstanceId((instanceId) => {
                if (p.instanceId && p.instanceId === instanceId) return;
                const peerName = message.senderName || p.senderName || 'Unknown';
                updateForceSyncState(p.timestamp, (state) => {
                    const remoteReady = { ...(state.remoteReady || {}) };
                    remoteReady[peerName] = {
                        currentTime: p.currentTime ?? null,
                        readyState:  p.readyState  ?? null,
                        instanceId:  p.instanceId  || null,
                        updatedAt:   Date.now()
                    };
                    return { ...state, timestamp: p.timestamp, remoteReady };
                });
            });
            return false;
        }

        // ── Native Video Events (User hat selbst Play/Pause gedrückt) ─────────
        // Direkt an Room weiterleiten, NICHT zurück an content.js (Echo-Loop).
        if (message.type === 'EXTENSION_OUTBOUND' && message.source === 'video_native_event') {
            broadcastToTimerTabs(message);
            return false;
        }

        // ── Aktions-Payloads: play / pause / force_sync ───────────────────────
        // Gilt für OUTBOUND vom Popup (lokale Aktion) UND INBOUND von Remote-Peers.
        if (['play', 'pause', 'force_sync_pause_seek', 'force_sync_play'].includes(p.action)) {

            // OUTBOUND vom Popup → an alle anderen Peers im Room weiterleiten
            if (message.type === 'EXTENSION_OUTBOUND') {
                broadcastToTimerTabs(message);
            }

            // Force Sync State initialisieren + Sofort-ACK an Initiator
            if (p.action === 'force_sync_pause_seek' && p.timestamp) {
                chrome.storage.local.set({
                    forceSyncState: {
                        timestamp:   p.timestamp,
                        stage:       'seeking',
                        targetTime:  p.targetTime ?? null,
                        localReady:  false,
                        remoteReady: {},
                        remoteAcks:  {},
                        error:       null,
                        updatedAt:   Date.now()
                    }
                });
                // Sofortiges Empfangs-ACK damit der Initiator weiß dass wir da sind
                if (message.type === 'EXTENSION_INBOUND') {
                    broadcastToTimerTabs({
                        type: 'EXTENSION_OUTBOUND',
                        payload: {
                            action:         'EXTENSION_SYNC_ACK',
                            originalAction: p.action,
                            timestamp:      p.timestamp
                        }
                    });
                }
            }

            // History loggen
            chrome.storage.local.get(['history'], (data) => {
                const history = data.history || [];
                history.unshift({
                    action:     p.action,
                    timestamp:  p.timestamp || new Date().toISOString(),
                    source:     message.source || 'remote',
                    senderName: message.senderName || (message.source === 'extension_popup' ? 'You' : null)
                });
                chrome.storage.local.set({ history: history.slice(0, 50) });
            });

            // Benachrichtigung für eingehende Remote-Aktionen
            if (message.type === 'EXTENSION_INBOUND' && message.senderName) {
                showPeerActionNotification(message.senderName, p.action);
            }

            // Befehl an Ziel-Tab senden
            chrome.storage.local.get(['targetTabId'], (data) => {
                const targetTabId = data.targetTabId;
                if (!targetTabId || targetTabId === 'none') return;

                const sendCommand = (retryCount = 0) => {
                    chrome.tabs.sendMessage(targetTabId, p).then((response) => {
                        if (!response) return;

                        // play/pause bestätigt → Cache updaten + ACK an Room
                        if (response.status === 'playing' || response.status === 'paused') {
                            const newState = response.status === 'playing' ? 'playing' : 'paused';
                            if (cachedPlaybackState !== newState) {
                                cachedPlaybackState = newState;
                                chrome.storage.local.set({ localPlaybackState: newState });
                            }
                            // Cooldown überspringen — Befehlsbestätigung soll sofort durch
                            lastStatusSentTime = 0;
                            sendStatusToRoom();
                            broadcastToTimerTabs({
                                type: 'EXTENSION_OUTBOUND',
                                payload: {
                                    action:         'EXTENSION_SYNC_ACK',
                                    originalAction: p.action,
                                    timestamp:      p.timestamp
                                }
                            });
                        }

                        // Force Sync Phase 1: seek + buffer fertig → Ready-Signal an Room
                        if (response.status === 'seek_ready') {
                            addDevLog(`Force Sync bereit: Tab ${targetTabId} bei ${response.currentTime}s`, 'success');
                            cachedVideoReady = true;

                            updateForceSyncState(p.timestamp, (state) => ({
                                ...state,
                                stage:            'ready',
                                localReady:       true,
                                localCurrentTime: response.currentTime,
                                localReadyState:  response.readyState,
                                error:            null,
                                updatedAt:        Date.now()
                            }));

                            getOrCreateExtensionInstanceId((instanceId) => {
                                broadcastToTimerTabs({
                                    type: 'EXTENSION_OUTBOUND',
                                    payload: {
                                        action:      'force_sync_ready',
                                        currentTime: response.currentTime,
                                        readyState:  response.readyState,
                                        timestamp:   p.timestamp,
                                        instanceId
                                    }
                                });
                            });
                        }

                        // Force Sync Fehler
                        if (response.status === 'seek_timeout' || response.status === 'no_video') {
                            updateForceSyncState(p.timestamp, (state) => ({
                                ...state,
                                stage:      'error',
                                localReady: false,
                                error:      response.status,
                                updatedAt:  Date.now()
                            }));
                        }

                    }).catch(err => {
                        addDevLog(`Senden an Ziel-Tab fehlgeschlagen: ${err.message}`, 'error');
                        updateForceSyncState(p.timestamp, (state) => ({
                            ...state,
                            stage:      'error',
                            localReady: false,
                            error:      err.message,
                            updatedAt:  Date.now()
                        }));

                        // Einmalig versuchen content.js neu zu injizieren
                        if (retryCount === 0 && (
                            err.message.includes('Receiving end does not exist') ||
                            err.message.includes('Could not establish connection')
                        )) {
                            chrome.scripting.executeScript({
                                target: { tabId: targetTabId },
                                files: ['content.js']
                            }).then(() => {
                                setTimeout(() => sendCommand(1), 500);
                            }).catch(e => {
                                addDevLog(`Re-Injektion fehlgeschlagen: ${e.message}`, 'error');
                                if (e.message.includes('No tab with id')) {
                                    chrome.storage.local.set({ targetTabId: 'none' });
                                    updateBadgeStatus();
                                }
                            });
                        }
                    });
                };

                sendCommand();
            });

            isAsync = true;
        }
    }

    return isAsync;
});
