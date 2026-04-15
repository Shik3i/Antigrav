document.addEventListener('DOMContentLoaded', async () => {
    const targetTabSelect = document.getElementById('targetTab');
    const statusDiv = document.getElementById('status');
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');

    // Tab Elements
    const tabControls = document.getElementById('tabControls');
    const tabHistory = document.getElementById('tabHistory');
    const tabDev = document.getElementById('tabDev');
    const contentControls = document.getElementById('contentControls');
    const contentHistory = document.getElementById('contentHistory');
    const contentDev = document.getElementById('contentDev');
    const historyList = document.getElementById('historyList');
    const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
    const refreshDevBtn = document.getElementById('refreshDevBtn');
    const devInfo = document.getElementById('devInfo');
    const forceSyncBtn = document.getElementById('forceSyncBtn');
    const syncStatus = document.getElementById('syncStatus');
    const syncStatusText = document.getElementById('syncStatusText');

    let detectedRoomId = null;

    // Populate open tabs
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
        if (tab.url && !tab.url.startsWith('chrome://')) {
            const option = document.createElement('option');
            option.value = tab.id;
            option.textContent = `${tab.id} - ${tab.title.substring(0, 30)}`;
            targetTabSelect.appendChild(option);
        }

        // Auto-detect timer room to confirm passive connection
        if (tab.url && (tab.url.includes('timer.shik3i.net/room/') || tab.url.includes('localhost:3000/room/'))) {
            try {
                const url = new URL(tab.url);
                const match = url.pathname.match(/\/room\/([^\/]+)/);
                if (match && match[1]) {
                    detectedRoomId = match[1];
                }
            } catch (e) { }
        }
    });

    // Update connection status UI
    const connStatus = document.getElementById('connectionStatus');
    const connDot = document.getElementById('connectionDot');
    const connText = document.getElementById('connectionText');

    if (detectedRoomId) {
        connStatus.style.background = 'rgba(76, 175, 80, 0.1)';
        connStatus.style.borderColor = '#4CAF50';
        connDot.style.background = '#4CAF50';
        connDot.style.boxShadow = '0 0 8px #4CAF50';
        connText.style.color = '#4CAF50';
        connText.textContent = `Connected to Room: ${detectedRoomId}`;

        // Announce our version to the room so others can compare
        const myVersion = chrome.runtime.getManifest().version;
        chrome.runtime.sendMessage({
            type: 'EXTENSION_OUTBOUND',
            source: 'extension_popup',
            payload: { action: 'version_announce', version: myVersion }
        }).catch(() => { });
    }

    // Check if background.js flagged a newer version from someone in the room
    const updateBanner = document.getElementById('updateBanner');
    const updateVersionText = document.getElementById('updateVersionText');
    chrome.storage.local.get(['updateAvailable'], (data) => {
        if (data.updateAvailable) {
            const myVersion = chrome.runtime.getManifest().version;
            // Only show if still newer (user might have updated already)
            const pa = myVersion.split('.').map(Number);
            const pb = data.updateAvailable.split('.').map(Number);
            let isNewer = false;
            for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
                const na = pa[i] || 0, nb = pb[i] || 0;
                if (na < nb) { isNewer = true; break; }
                if (na > nb) break;
            }
            if (isNewer) {
                updateVersionText.textContent = `v${data.updateAvailable}`;
                updateBanner.style.display = 'block';
            } else {
                // We're up-to-date, clear the flag
                chrome.storage.local.remove('updateAvailable');
            }
        }
    });

    // Load existing settings
    chrome.storage.local.get(['targetTabId'], (data) => {
        if (data.targetTabId !== undefined) {
            targetTabSelect.value = data.targetTabId === null ? 'none' : data.targetTabId;
        } else {
            targetTabSelect.value = 'none';
        }
        // Announce tab status AFTER restoring saved value (so the title is correct)
        if (detectedRoomId) announceTabStatus();
    });

    // Auto-Save
    targetTabSelect.addEventListener('change', () => {
        let targetTabId = targetTabSelect.value;
        if (targetTabId === 'none' || targetTabId === '') {
            targetTabId = null;
        } else {
            targetTabId = parseInt(targetTabId, 10);
        }

        chrome.storage.local.set({ targetTabId }, () => {
            statusDiv.innerText = "Target Tab Auto-Saved!";
            statusDiv.style.color = '#4CAF50';
            statusDiv.style.display = 'block';
            setTimeout(() => { statusDiv.style.display = 'none'; }, 2000);
        });
        // Re-announce tab status to peers when selection changes
        announceTabStatus();
    });

    // --- Room Peer Status ---
    function announceTabStatus() {
        const selVal = targetTabSelect.value;
        if (!selVal || selVal === 'none') return;
        const selOption = targetTabSelect.options[targetTabSelect.selectedIndex];
        const tabTitle = selOption ? selOption.textContent.replace(/^\d+ - /, '').trim() : null;
        chrome.runtime.sendMessage({
            type: 'EXTENSION_OUTBOUND',
            source: 'extension_popup',
            payload: {
                action: 'tab_status',
                tabTitle: tabTitle,
                isReady: !!tabTitle,
                version: chrome.runtime.getManifest().version
            }
        }).catch(() => {});
    }

    function renderRoomPeers() {
        const panel = document.getElementById('roomStatusPanel');
        const list = document.getElementById('roomPeerList');
        chrome.storage.local.get(['roomPeers'], (data) => {
            const peers = data.roomPeers || {};
            // Evict peers not seen in last 10 minutes
            const now = Date.now();
            const active = Object.entries(peers).filter(([, v]) => (now - v.lastSeen) < 10 * 60 * 1000);

            // Build "You" entry from current target tab selection
            const selVal = targetTabSelect.value;
            const selOption = targetTabSelect.options[targetTabSelect.selectedIndex];
            const myTabTitle = (selVal && selVal !== 'none' && selOption)
                ? selOption.textContent.replace(/^\d+ - /, '').trim()
                : null;
            const myVersion = chrome.runtime.getManifest().version;

            // Always show the panel (min: shows "You")
            panel.style.display = 'block';
            list.innerHTML = '';

            // Render own entry first
            const makeRow = (name, tabTitle, isReady, version, isSelf) => {
                const row = document.createElement('div');
                row.style.cssText = `display:flex;align-items:center;gap:6px;background:${isSelf ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.04)'};padding:6px 8px;border-radius:6px;font-size:10px;color:#e2e8f0;`;
                const dot = isReady ? '🟢' : '🔴';
                const ver = version ? `<span style="color:#6b7280;margin-left:auto;">v${version}</span>` : '';
                const label = isSelf ? `<em style="color:#6b7280;">(You)</em>` : '';
                const titleHtml = tabTitle
                    ? `<span style="color:#a5b4fc;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${tabTitle}">${tabTitle}</span>`
                    : `<span style="color:#6b7280;font-style:italic;">No tab</span>`;
                row.innerHTML = `<span>${dot}</span><strong style="min-width:45px;">${name}</strong>${label}${titleHtml}${ver}`;
                list.appendChild(row);
            };

            makeRow('You', myTabTitle, !!myTabTitle, myVersion, true);
            active.forEach(([name, info]) => makeRow(name, info.tabTitle, info.isReady, info.version, false));
        });
    }

    // Render peers on open and whenever storage changes
    renderRoomPeers();
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.roomPeers) renderRoomPeers();
    });

    // Media Controls Helper
    function sendMediaCommand(action) {
        let targetTabIdStr = targetTabSelect.value;
        let targetTabId = targetTabIdStr === 'none' || targetTabIdStr === '' ? null : parseInt(targetTabIdStr, 10);

        if (!targetTabId) {
            console.warn("No valid target tab selected to execute local command.");
            statusDiv.innerText = "Select Target JS!";
            statusDiv.style.color = '#dc3545';
            statusDiv.style.display = 'block';
            setTimeout(() => { statusDiv.style.display = 'none'; }, 2000);
            return;
        }

        // Send to background worker to handle targeting and bidirectional sync
        chrome.runtime.sendMessage({
            type: 'EXTENSION_OUTBOUND',
            source: 'extension_popup',
            payload: {
                action: action,
                timestamp: new Date().toISOString()
            }
        }).catch(err => console.debug("Popup to background message warning:", err));

        // Reload history tab slightly after background worker processes it
        setTimeout(() => {
            loadHistory();
        }, 250);
    }

    playBtn.addEventListener('click', () => sendMediaCommand('play'));
    pauseBtn.addEventListener('click', () => sendMediaCommand('pause'));

    // --- Force Sync Logic ---
    function updateSyncStatus(text, color) {
        syncStatus.style.display = 'block';
        syncStatusText.textContent = text;
        syncStatusText.style.color = color || 'var(--text-muted)';
    }

    function hideSyncStatus(delay = 4000) {
        setTimeout(() => { syncStatus.style.display = 'none'; }, delay);
    }

    forceSyncBtn.addEventListener('click', async () => {
        let targetTabIdStr = targetTabSelect.value;
        let targetTabId = targetTabIdStr === 'none' || targetTabIdStr === '' ? null : parseInt(targetTabIdStr, 10);

        if (!targetTabId) {
            updateSyncStatus('❌ Select a Target Tab first!', '#dc3545');
            hideSyncStatus(3000);
            return;
        }

        // Phase 0: Get current video time from local tab
        updateSyncStatus('⏳ Reading video position...', '#f59e0b');
        let currentVideoTime = 0;
        try {
            const debugInfo = await chrome.tabs.sendMessage(targetTabId, { action: 'get_debug_info' });
            if (debugInfo && debugInfo.currentTime && debugInfo.currentTime !== 'N/A') {
                currentVideoTime = parseFloat(debugInfo.currentTime);
            }
        } catch (e) {
            updateSyncStatus('❌ Cannot read video time', '#dc3545');
            hideSyncStatus(3000);
            return;
        }

        const timestamp = new Date().toISOString();

        // Phase 1: Send pause + seek to everyone (including self)
        updateSyncStatus(`⏳ Syncing to ${currentVideoTime.toFixed(1)}s...`, '#f59e0b');

        // Send to self (local extension)
        chrome.runtime.sendMessage({
            type: 'EXTENSION_INBOUND',
            source: 'force_sync_initiator',
            payload: {
                action: 'force_sync_pause_seek',
                targetTime: currentVideoTime,
                timestamp: timestamp
            }
        }).catch(() => { });

        // Send to others via OUTBOUND pipe (through React -> Socket -> others)
        chrome.runtime.sendMessage({
            type: 'EXTENSION_OUTBOUND',
            source: 'extension_popup',
            payload: {
                action: 'force_sync_pause_seek',
                targetTime: currentVideoTime,
                timestamp: timestamp
            }
        }).catch(() => { });

        // Phase 2: Wait for seek to complete (give buffer time)
        updateSyncStatus('⏳ Waiting for buffer...', '#f59e0b');

        // Wait a reasonable time for seek + buffer (content.js polls up to 8s)
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Phase 3: Send play to everyone
        updateSyncStatus('▶ Starting playback...', '#6366f1');

        chrome.runtime.sendMessage({
            type: 'EXTENSION_INBOUND',
            source: 'force_sync_initiator',
            payload: {
                action: 'force_sync_play',
                timestamp: timestamp
            }
        }).catch(() => { });

        chrome.runtime.sendMessage({
            type: 'EXTENSION_OUTBOUND',
            source: 'extension_popup',
            payload: {
                action: 'force_sync_play',
                timestamp: timestamp
            }
        }).catch(() => { });

        updateSyncStatus('✅ Force Sync complete!', '#4CAF50');
        hideSyncStatus(4000);

        setTimeout(() => loadHistory(), 500);
    });

    // --- Tabs & History Logic ---
    function switchTab(tabId) {
        tabControls.classList.remove('active');
        tabHistory.classList.remove('active');
        tabDev.classList.remove('active');
        contentControls.classList.remove('active');
        contentHistory.classList.remove('active');
        contentDev.classList.remove('active');

        if (tabId === 'history') {
            tabHistory.classList.add('active');
            contentHistory.classList.add('active');
            loadHistory();
        } else if (tabId === 'dev') {
            tabDev.classList.add('active');
            contentDev.classList.add('active');
            loadDevInfo();
        } else {
            tabControls.classList.add('active');
            contentControls.classList.add('active');
        }
    }

    tabControls.addEventListener('click', () => switchTab('controls'));
    tabHistory.addEventListener('click', () => switchTab('history'));
    tabDev.addEventListener('click', () => switchTab('dev'));
    refreshHistoryBtn.addEventListener('click', () => loadHistory());
    refreshDevBtn.addEventListener('click', () => loadDevInfo());

    function loadHistory() {
        chrome.storage.local.get(['history'], (data) => {
            const currentHistory = data.history || [];

            // Update the Latest Activity pill on the main tab
            const latestDiv = document.getElementById('latestActivity');
            const latestText = document.getElementById('latestActivityText');
            const latestTime = document.getElementById('latestActivityTime');
            const latestAcks = document.getElementById('latestActivityAcks');

            if (currentHistory.length > 0) {
                const latest = currentHistory[0];
                const actionColor = latest.action === 'play' ? '#28a745' : '#dc3545';
                const actionIcon = latest.action === 'play' ? '▶' : '⏸';
                const sourceText = latest.source === 'timer_website' ? 'Web' : 'Local';

                latestText.innerHTML = `<span style="color: ${actionColor}; font-weight: bold;">${actionIcon} ${latest.action.toUpperCase()}</span> (${sourceText})`;
                latestTime.textContent = new Date(latest.timestamp).toLocaleTimeString();
                latestDiv.style.display = 'block';

                // Display ACKs if any exist for this action
                if (latest.acks && latest.acks.length > 0) {
                    latestAcks.style.display = 'block';
                    latestAcks.textContent = `✓ Ack: ${latest.acks.join(', ')}`;
                } else {
                    latestAcks.style.display = 'none';
                }
            } else {
                latestDiv.style.display = 'none';
            }

            // Update the full History tab
            if (currentHistory.length === 0) {
                historyList.innerHTML = '<div style="text-align:center; color: #666; padding: 20px 0;">No history yet.</div>';
                return;
            }

            historyList.innerHTML = '';
            currentHistory.forEach(item => {
                const div = document.createElement('div');
                const actionLabels = {
                    'play': '▶ Play',
                    'pause': '⏸ Pause',
                    'force_sync_pause_seek': '⏱ Sync Seek',
                    'force_sync_play': '⏱ Sync Play'
                };
                const isPause = item.action === 'pause' || item.action === 'force_sync_pause_seek';
                div.className = `history-item ${isPause ? 'pause' : 'play'}`;

                const date = new Date(item.timestamp);
                const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                // Source badge
                const sourceLabel = item.source === 'timer_website' ? 'Web' :
                    item.source === 'extension_popup' ? 'Ext' :
                        item.source === 'force_sync_initiator' ? 'Sync' : 'Ext';
                const sourceColor = item.source === 'timer_website' ? '#60a5fa' : '#a78bfa';

                // Sender name
                const sender = item.senderName || (item.source === 'extension_popup' ? 'You' : '');

                // ACK list
                let ackHtml = '';
                if (item.acks && item.acks.length > 0) {
                    ackHtml = `<div style="font-size: 9px; color: #6ee7b7; margin-top: 3px;">✓ ${item.acks.join(', ')}</div>`;
                }

                div.innerHTML = `
                    <div style="display: flex; flex-direction: column; gap: 2px; flex: 1;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span class="history-action">${actionLabels[item.action] || item.action}</span>
                            ${sender ? `<span style="font-size: 10px; color: #e2e8f0; font-weight: 500;">${sender}</span>` : ''}
                            <span style="font-size: 8px; padding: 1px 5px; border-radius: 3px; background: ${sourceColor}22; color: ${sourceColor}; font-weight: 600;">${sourceLabel}</span>
                        </div>
                        ${ackHtml}
                    </div>
                    <span class="history-time">${timeString}</span>
                `;
                historyList.appendChild(div);
            });
        });
    }

    function loadDevInfo() {
        devInfo.innerHTML = "Fetching diagnostics...";
        let targetTabIdStr = targetTabSelect.value;
        let targetTabId = targetTabIdStr === 'none' || targetTabIdStr === '' ? null : parseInt(targetTabIdStr, 10);

        if (!targetTabId) {
            devInfo.innerHTML = '<span style="color: #dc3545; font-weight: bold;">Select a Target Tab (Video) in the "Controls" tab first.</span>';
            return;
        }

        chrome.tabs.sendMessage(targetTabId, { action: 'get_debug_info' })
            .then(response => {
                if (!response) {
                    devInfo.innerHTML = '<span style="color: #dc3545">No response. Is the page fully loaded? Make sure the content script is running.</span>';
                    return;
                }

                const renderRow = (label, value) => `
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 4px 0;">
                        <strong>${label}:</strong> <span style="color: #fff; text-align: right; max-width: 65%; word-break: break-all;">${value}</span>
                    </div>
                `;

                devInfo.innerHTML = `
                    ${renderRow('Detection', response.detectionStatus)}
                    ${renderRow('Video State', response.videoState)}
                    ${renderRow('Current Time', response.currentTime)}
                    ${renderRow('Ready State', response.readyState)}
                    ${renderRow('Source URL', response.sourceUrl)}
                `;
            })
            .catch(err => {
                devInfo.innerHTML = `<span style="color: #dc3545">Error connecting to tab:<br>${err.message}</span>`;
            });
    }

    // Auto-refresh when background.js writes new history (e.g. command from website)
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.history) {
            loadHistory();
        }
    });

    // Load on initial popup open
    loadHistory();
});
