document.addEventListener('DOMContentLoaded', async () => {
    const targetTabSelect = document.getElementById('targetTab');
    const statusDiv = document.getElementById('status');
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');

    // Tab Elements
    const tabControls = document.getElementById('tabControls');
    const tabHistory = document.getElementById('tabHistory');
    const tabDev = document.getElementById('tabDev');
    const tabSettings = document.getElementById('tabSettings');
    
    const contentControls = document.getElementById('contentControls');
    const contentHistory = document.getElementById('contentHistory');
    const contentDev = document.getElementById('contentDev');
    const contentSettings = document.getElementById('contentSettings');
    
    const filterNoiseToggle = document.getElementById('filterNoiseToggle');
    const notificationsToggle = document.getElementById('notificationsToggle');
    const historyList = document.getElementById('historyList');
    const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
    const refreshDevBtn = document.getElementById('refreshDevBtn');
    const devInfo = document.getElementById('devInfo');
    const forceSyncBtn = document.getElementById('forceSyncBtn');
    const syncStatus = document.getElementById('syncStatus');
    const syncStatusText = document.getElementById('syncStatusText');
    const latestActivity = document.getElementById('latestActivity');
    const latestActivityText = document.getElementById('latestActivityText');
    const latestActivityTime = document.getElementById('latestActivityTime');
    const latestActivityAcks = document.getElementById('latestActivityAcks');

    let detectedRoomId = null;
    let hasTimerTab = false;
    let extensionInstanceId = null;

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const BLACKLIST_DOMAINS = [
        'mail.google.com', 'outlook.live.com', 'outlook.office.com', 'gmx.net', 'web.de',
        'web.whatsapp.com', 'web.telegram.org', 'discord.com', 'element.io', 'app.slack.com',
        'atlassian.net', 'jira', 'trello.com', 'notion.so', 'monday.com', 'asana.com',
        'github.com', 'gitlab.com', 'bitbucket.org',
        'linkedin.com', 'twitter.com', 'x.com', 'facebook.com', 'instagram.com',
        'timer.shik3i.net', 'localhost', 'zoom.us', 'teams.microsoft.com', 'meet.google.com'
    ];

    // Populate open tabs with Smart Matching
    const populateTabs = async () => {
        const storageData = await new Promise(r => chrome.storage.local.get(['targetTabId', 'roomPeers', 'filterNoiseTabs'], r));
        const currentTargetTabId = storageData.targetTabId;
        const peers = storageData.roomPeers || {};
        const isFilterActive = storageData.filterNoiseTabs !== false;
        
        const peerTitles = Object.values(peers)
            .map(p => p.tabTitle)
            .filter(t => t && t.length > 3);

        const tabs = await chrome.tabs.query({});
        
        while (targetTabSelect.options.length > 1) {
            targetTabSelect.remove(1);
        }

        let bestMatchId = null;

        // FIRST: Scan all tabs for the Timer/Bridge - BEFORE filtering for the dropdown
        tabs.forEach(tab => {
            if (tab.url && (tab.url.includes('timer.shik3i.net/') || tab.url.includes('localhost:3001/'))) {
                hasTimerTab = true;
                try {
                    const url = new URL(tab.url);
                    const match = url.pathname.match(/\/room\/([^\/]+)/);
                    if (match && match[1]) detectedRoomId = match[1];
                } catch (e) { }
            }
        });

        const sortedTabs = tabs
            .filter(tab => {
                if (!tab.url || tab.url.startsWith('chrome://')) return false;
                if (isFilterActive && tab.id !== currentTargetTabId) {
                    const urlStr = tab.url.toLowerCase();
                    if (BLACKLIST_DOMAINS.some(d => urlStr.includes(d.toLowerCase()))) return false;
                }
                return true;
            })
            .map(tab => {
                const isMatch = peerTitles.some(pt => {
                    const t1 = (tab.title || '').toLowerCase();
                    const t2 = (pt || '').toLowerCase();
                    return t1.startsWith(t2) || t2.startsWith(t1) || (t1.length > 10 && t2.includes(t1.substring(0, 15)));
                });
                return { ...tab, isMatch };
            })
            .sort((a, b) => (b.isMatch ? 1 : 0) - (a.isMatch ? 1 : 0));

        sortedTabs.forEach(tab => {
            const option = document.createElement('option');
            option.value = tab.id;
            const title = (tab.title || 'Loading...');
            let label = `${tab.id} - ${title.substring(0, 40)}`;
            if (tab.isMatch) {
                label = `⭐ MATCH: ${title.substring(0, 35)}`;
                option.style.fontWeight = 'bold';
                option.style.color = '#fbbf24';
                if (!bestMatchId) bestMatchId = tab.id;
            }
            option.textContent = label;
            targetTabSelect.appendChild(option);
        });

        if (currentTargetTabId && currentTargetTabId !== 'none') {
            targetTabSelect.value = currentTargetTabId;
        } else if (bestMatchId) {
            targetTabSelect.value = bestMatchId;
            chrome.storage.local.set({ targetTabId: bestMatchId });
            statusDiv.innerText = "Smart Match Auto-Selected! ⭐";
            statusDiv.style.color = '#fbbf24';
            statusDiv.style.display = 'block';
            setTimeout(() => { statusDiv.style.display = 'none'; }, 3000);
            announceTabStatus();
        } else {
            targetTabSelect.value = 'none';
        }
    };

    await populateTabs();

    // UI Feedback for Connection
    const connStatus = document.getElementById('connectionStatus');
    const connDot = document.getElementById('connectionDot');
    const connText = document.getElementById('connectionText');

    if (hasTimerTab) {
        connStatus.style.background = 'rgba(76, 175, 80, 0.1)';
        connStatus.style.borderColor = '#4CAF50';
        connDot.style.background = '#4CAF50';
        connDot.style.boxShadow = '0 0 8px #4CAF50';
        connText.style.color = '#4CAF50';
        connText.textContent = detectedRoomId ? `Timer detected (Room: ${detectedRoomId})` : 'Timer detected';
    }

    // Settings Toggle Logic
    chrome.storage.local.get(['targetTabId', 'extensionInstanceId', 'filterNoiseTabs', 'notificationsEnabled'], (data) => {
        extensionInstanceId = data.extensionInstanceId;
        if (!extensionInstanceId) {
            console.warn('Popup: extensionInstanceId not found, waiting for background...');
        }

        const isFilterActive = data.filterNoiseTabs !== false;
        filterNoiseToggle.checked = isFilterActive;

        // Notifications are ON by default
        notificationsToggle.checked = data.notificationsEnabled !== false;

        if (data.targetTabId !== undefined) {
            targetTabSelect.value = data.targetTabId === null ? 'none' : data.targetTabId;
        }
        if (hasTimerTab) {
            announceTabStatus();
            announceVersion();
        }
    });

    filterNoiseToggle.addEventListener('change', () => {
        chrome.storage.local.set({ filterNoiseTabs: filterNoiseToggle.checked }, () => {
            populateTabs();
        });
    });

    notificationsToggle.addEventListener('change', () => {
        chrome.storage.local.set({ notificationsEnabled: notificationsToggle.checked });
    });

    targetTabSelect.addEventListener('change', () => {
        let val = targetTabSelect.value;
        let id = val === 'none' ? null : parseInt(val, 10);
        
        // Proactive injection for better UX (so bidirectional sync starts immediately)
        if (id) {
            chrome.scripting.executeScript({
                target: { tabId: id },
                files: ['content.js']
            }).then(() => {
                statusDiv.innerText = "Sync Script Loaded! ✅";
                statusDiv.style.color = '#4CAF50';
                statusDiv.style.display = 'block';
                setTimeout(() => { statusDiv.style.display = 'none'; }, 2000);
            }).catch((err) => { 
                console.warn("Injection failed:", err.message);
                statusDiv.innerText = "Restricted Page! ❌";
                statusDiv.style.color = '#ef4444';
                statusDiv.style.display = 'block';
                setTimeout(() => { statusDiv.style.display = 'none'; }, 4000);
            });
        }

        chrome.storage.local.set({ targetTabId: id }, () => {
            statusDiv.innerText = "Auto-Saved!";
            statusDiv.style.color = '#4CAF50';
            statusDiv.style.display = 'block';
            setTimeout(() => { statusDiv.style.display = 'none'; }, 2000);
        });
        announceTabStatus();
    });

    // Peer Status
    function announceTabStatus() {
        if (!extensionInstanceId) return;
        const selVal = targetTabSelect.value;
        const selOption = targetTabSelect.options[targetTabSelect.selectedIndex];
        const tabTitle = (selVal && selVal !== 'none' && selOption) ? selOption.textContent.replace(/^\d+ - /, '').replace(/⭐ MATCH: /, '').trim() : null;
        chrome.runtime.sendMessage({
            type: 'EXTENSION_OUTBOUND',
            source: 'extension_popup',
            payload: {
                action: 'tab_status',
                tabTitle,
                isReady: !!tabTitle,
                version: chrome.runtime.getManifest().version,
                instanceId: extensionInstanceId
            }
        }).catch(() => {});
    }

    function announceVersion() {
        if (!hasTimerTab || !extensionInstanceId) return;
        chrome.runtime.sendMessage({
            type: 'EXTENSION_OUTBOUND',
            source: 'extension_popup',
            payload: {
                action: 'version_announce',
                version: chrome.runtime.getManifest().version,
                instanceId: extensionInstanceId
            }
        }).catch(() => {});
    }

    function renderRoomPeers() {
        chrome.storage.local.get(['roomPeers'], (data) => {
            const list = document.getElementById('roomPeerList');
            if(!list) return;
            const peers = data.roomPeers || {};
            const now = Date.now();
            const active = Object.entries(peers).filter(([, v]) => {
                if ((now - v.lastSeen) >= 60 * 1000) return false;
                return v.instanceId !== extensionInstanceId;
            });

            const myVal = targetTabSelect.value;
            const myOption = targetTabSelect.options[targetTabSelect.selectedIndex];
            const myTitle = (myVal && myVal !== 'none' && myOption) ? myOption.textContent.replace(/^\d+ - /, '').replace(/⭐ MATCH: /, '').trim() : null;
            const myTabId = myVal && myVal !== 'none' ? parseInt(myVal, 10) : null;
            
            list.innerHTML = '';

            const makeRow = (name, tabTitle, isReady, version, isSelf, playbackState) => {
                const row = document.createElement('div');
                row.style.cssText = `display:flex;align-items:center;gap:6px;background:${isSelf ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.04)'};padding:6px 8px;border-radius:6px;font-size:10px;color:#e2e8f0;`;
                const safeName = escapeHtml(name);
                const safeTitle = escapeHtml(tabTitle);
                const titleHtml = tabTitle
                    ? `<span style="color:#a5b4fc;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${safeTitle}</span>`
                    : `<span style="color:#6b7280;font-style:italic;">No tab</span>`;

                // Play/Pause icon: show state if known, else readiness dot
                let stateIcon;
                if (!isReady) {
                    stateIcon = `<span title="No tab selected" style="font-size:11px;">🔴</span>`;
                } else if (playbackState === 'playing') {
                    stateIcon = `<span title="Playing" style="font-size:11px;">▶️</span>`;
                } else if (playbackState === 'paused') {
                    stateIcon = `<span title="Paused" style="font-size:11px;">⏸️</span>`;
                } else {
                    stateIcon = `<span title="Ready (state unknown)" style="font-size:11px;">🟢</span>`;
                }

                row.innerHTML = `${stateIcon}<strong style="min-width:45px;">${safeName}</strong>${titleHtml}<span style="color:#6b7280;margin-left:auto;">v${version}</span>`;
                list.appendChild(row);
            };

            // For "You": query content.js directly for live state
            if (myTabId) {
                chrome.tabs.sendMessage(myTabId, { action: 'get_debug_info' }).then(info => {
                    const myState = info && info.videoState !== 'N/A'
                        ? (info.videoState === 'Playing' ? 'playing' : 'paused')
                        : null;
                    makeRow('You', myTitle, !!myTitle, chrome.runtime.getManifest().version, true, myState);
                    active.forEach(([name, info]) => makeRow(name, info.tabTitle, info.isReady, info.version, false, info.playbackState || null));
                    document.getElementById('roomStatusPanel').style.display = 'block';
                }).catch(() => {
                    // content.js not reachable yet — render without state
                    makeRow('You', myTitle, !!myTitle, chrome.runtime.getManifest().version, true, null);
                    active.forEach(([name, info]) => makeRow(name, info.tabTitle, info.isReady, info.version, false, info.playbackState || null));
                    document.getElementById('roomStatusPanel').style.display = 'block';
                });
            } else {
                makeRow('You', myTitle, !!myTitle, chrome.runtime.getManifest().version, true, null);
                active.forEach(([name, info]) => makeRow(name, info.tabTitle, info.isReady, info.version, false, info.playbackState || null));
                document.getElementById('roomStatusPanel').style.display = 'block';
            }
        });
    }

    renderRoomPeers();
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
            if (changes.roomPeers || changes.extensionInstanceId || changes.targetTabId || changes.localPlaybackState) {
                renderRoomPeers();
                populateTabs();
            }
            if (changes.history) {
                loadHistory();
                renderLatestActivity();
            }
        }
    });

    setInterval(() => { announceTabStatus(); renderRoomPeers(); }, 30000);

    // Commands
    function sendMediaCommand(action) {
        let val = targetTabSelect.value;
        let id = val === 'none' ? null : parseInt(val, 10);
        if (!id) {
            statusDiv.innerText = "Select Target!";
            statusDiv.style.color = '#dc3545';
            statusDiv.style.display = 'block';
            setTimeout(() => { statusDiv.style.display = 'none'; }, 2000);
            return;
        }
        chrome.runtime.sendMessage({
            type: 'EXTENSION_OUTBOUND',
            source: 'extension_popup',
            payload: { action, timestamp: new Date().toISOString() }
        }).catch(() => {});
        setTimeout(() => loadHistory(), 250);
    }

    playBtn.addEventListener('click', () => sendMediaCommand('play'));
    pauseBtn.addEventListener('click', () => sendMediaCommand('pause'));

    // Force Sync
    forceSyncBtn.addEventListener('click', async () => {
        let val = targetTabSelect.value;
        let id = val === 'none' ? null : parseInt(val, 10);
        if (!id) return;

        updateSyncStatus('⏳ Reading time...', '#f59e0b');
        try {
            const di = await chrome.tabs.sendMessage(id, { action: 'get_debug_info' });
            if (!di || di.currentTime === 'N/A') throw new Error();
            const time = parseFloat(di.currentTime);
            const ts = new Date().toISOString();

            updateSyncStatus(`⏳ Syncing to ${time.toFixed(1)}s...`, '#f59e0b');
            
            // 1. Reset state and start sync
            await chrome.storage.local.set({ 
                forceSyncState: { 
                    timestamp: ts, 
                    targetTime: time, 
                    localReady: false, 
                    remoteReady: {}, 
                    updatedAt: Date.now() 
                } 
            });
            
            // 2. Broadcast OUTBOUND pause/seek. 
            // Note: background.js now handles the local INBOUND trigger automatically.
            const msg = { 
                type: 'EXTENSION_OUTBOUND', 
                source: 'extension_popup', 
                payload: { action: 'force_sync_pause_seek', targetTime: time, timestamp: ts } 
            };
            chrome.runtime.sendMessage(msg).catch(() => {});

            // 3. Polling for readiness
            const startTime = Date.now();
            const pollInterval = setInterval(async () => {
                const elapsed = Date.now() - startTime;
                const { roomPeers, forceSyncState } = await new Promise(r => 
                    chrome.storage.local.get(['roomPeers', 'forceSyncState'], r)
                );

                const peersInRoom = Object.keys(roomPeers || {}).filter(k => 
                    k !== 'You' && (Date.now() - roomPeers[k].lastSeen < 60000)
                );
                const readyPeers = Object.keys(forceSyncState?.remoteReady || {});

                // Success: All known peers are ready
                if (peersInRoom.length > 0 && peersInRoom.every(p => readyPeers.includes(p))) {
                    clearInterval(pollInterval);
                    finalizeSync(ts);
                    return;
                }

                // Fallback (3s): No peers in room detected
                if (elapsed >= 3000 && peersInRoom.length === 0) {
                    clearInterval(pollInterval);
                    updateSyncStatus('⚠️ No peers responded – syncing locally only', '#f59e0b');
                    setTimeout(() => finalizeSync(ts), 1500);
                    return;
                }

                // Timeout (8s): Some peers are still not ready
                if (elapsed >= 8000) {
                    clearInterval(pollInterval);
                    updateSyncStatus('⚠️ Timeout – not all peers confirmed ready', '#f59e0b');
                    setTimeout(() => finalizeSync(ts), 1500);
                    return;
                }
            }, 300);

        } catch(e) { 
            updateSyncStatus('❌ Failed', '#dc3545'); 
            hideSyncStatus(); 
        }
    });

    function finalizeSync(ts) {
        chrome.runtime.sendMessage({ 
            type: 'EXTENSION_OUTBOUND', 
            source: 'extension_popup', 
            payload: { action: 'force_sync_play', timestamp: ts } 
        });
        updateSyncStatus('✅ Done!', '#4CAF50');
        hideSyncStatus();
    }

    function updateSyncStatus(t, c) { syncStatus.style.display='block'; syncStatusText.textContent=t; syncStatusText.style.color=c; }
    function hideSyncStatus() { setTimeout(()=>syncStatus.style.display='none', 3000); }

    // History & Tabs
    function switchTab(id) {
        [tabControls, tabHistory, tabDev, tabSettings].forEach(t => t.classList.remove('active'));
        [contentControls, contentHistory, contentDev, contentSettings].forEach(c => c.classList.remove('active'));
        document.getElementById('tab' + id.charAt(0).toUpperCase() + id.slice(1)).classList.add('active');
        document.getElementById('content' + id.charAt(0).toUpperCase() + id.slice(1)).classList.add('active');
        if (id === 'history') loadHistory();
        if (id === 'dev') loadDevInfo();
    }

    tabControls.addEventListener('click', () => switchTab('controls'));
    tabHistory.addEventListener('click', () => switchTab('history'));
    tabDev.addEventListener('click', () => switchTab('dev'));
    tabSettings.addEventListener('click', () => switchTab('settings'));
    
    if (refreshHistoryBtn) refreshHistoryBtn.addEventListener('click', () => loadHistory());
    if (refreshDevBtn) refreshDevBtn.addEventListener('click', () => loadDevInfo());

    function timeAgo(isoTimestamp) {
        const diff = Math.floor((Date.now() - new Date(isoTimestamp).getTime()) / 1000);
        if (diff < 5)  return 'gerade eben';
        if (diff < 60) return `vor ${diff}s`;
        const m = Math.floor(diff / 60);
        if (m < 60)    return `vor ${m} Min.`;
        const h = Math.floor(m / 60);
        if (h < 24)    return `vor ${h} Std.`;
        return new Date(isoTimestamp).toLocaleDateString();
    }

    let _historyData = [];

    function loadHistory() {
        chrome.storage.local.get(['history'], (data) => {
            _historyData = data.history || [];
            renderHistory();
        });
    }

    function renderHistory() {
        historyList.innerHTML = _historyData.length
            ? ''
            : '<div style="text-align:center;color:#666;padding:20px 0;">No history.</div>';

        _historyData.forEach(item => {
            const div = document.createElement('div');
            div.className = `history-item ${item.action.includes('pause') ? 'pause' : 'play'}`;
            const safeName = escapeHtml(item.senderName || 'You');
            const actionLabel = item.action === 'force_sync_pause_seek' ? 'FORCE SYNC' :
                                item.action === 'force_sync_play'       ? 'FORCE PLAY' :
                                item.action.toUpperCase();
            div.innerHTML = `
                <div style="flex:1;">
                    <strong>${actionLabel}</strong>
                    <span style="font-size:10px;color:var(--text-muted);"> ${safeName}</span>
                </div>
                <span class="history-time" data-ts="${escapeHtml(item.timestamp)}">${timeAgo(item.timestamp)}</span>`;
            historyList.appendChild(div);
        });
    }

    // Refresh relative timestamps every 30 seconds while popup is open
    setInterval(() => {
        historyList.querySelectorAll('.history-time[data-ts]').forEach(el => {
            el.textContent = timeAgo(el.dataset.ts);
        });
        // Also update latestActivity time if visible
        if (latestActivityTime && latestActivityTime.dataset.ts) {
            latestActivityTime.textContent = timeAgo(latestActivityTime.dataset.ts);
        }
    }, 30000);

    function loadDevInfo() {
        let id = targetTabSelect.value === 'none' ? null : parseInt(targetTabSelect.value, 10);
        if(!id) { devInfo.innerHTML = 'No tab selected.'; return; }
        chrome.tabs.sendMessage(id, { action: 'get_debug_info' }).then(r => {
            devInfo.innerHTML = r ? Object.entries(r).map(([k,v])=>`<strong>${k}:</strong> ${v}`).join('<br>') : 'No response.';
        }).catch(e => { devInfo.innerHTML = 'Error: ' + e.message; });
    }

    function renderLatestActivity() {
        if (!latestActivity) return;
        chrome.storage.local.get(['history'], (data) => {
            const hist = data.history || [];
            if (hist.length === 0) {
                latestActivity.style.display = 'none';
                return;
            }

            const last = hist[0];
            const now = Date.now();
            const lastTime = new Date(last.timestamp).getTime();
            
            // Only show activity if it's less than 5 minutes old
            if (now - lastTime > 5 * 60 * 1000) {
                latestActivity.style.display = 'none';
                return;
            }

            latestActivity.style.display = 'block';
            const actionColor = last.action.includes('pause') ? '#ef4444' : '#10b981';
            const sender = escapeHtml(last.senderName || 'You');
            latestActivityText.innerHTML = `<strong style="color: ${actionColor}">${last.action.toUpperCase()}</strong> by ${sender}`;
            latestActivityTime.textContent = timeAgo(last.timestamp);
            latestActivityTime.dataset.ts = last.timestamp;

            if (last.acks && last.acks.length > 0) {
                latestActivityAcks.style.display = 'block';
                latestActivityAcks.textContent = `ACK: ${last.acks.join(', ')}`;
            } else {
                latestActivityAcks.style.display = 'none';
            }
        });
    }
    
    loadHistory();
    renderLatestActivity();
});
