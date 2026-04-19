// content.js - Injected into video tabs
// Handles play/pause commands, diagnostics, and force sync

(function() {
    // Prevent double injection
    if (window.koalaSyncInjected) return;
    window.koalaSyncInjected = true;

    // --- Global state for coordination ---
    let isProcessingCommand = false;

    // --- Helper: find the best video element on the page ---
    function findVideo() {
        const videos = document.querySelectorAll('video');
        if (videos.length > 0) return videos[0];
        return null;
    }

    // --- Helper: safely play/pause taking YouTube, Twitch and other SPA players into account ---
    function tryMediaAction(action) {
        isProcessingCommand = true;
        try {
            const host = window.location.hostname.toLowerCase();
            const isYouTube = host.includes('youtube.com');
            const isTwitch  = host.includes('twitch.tv');

            // --- YOUTUBE ---
            if (isYouTube) {
                const ytButton = document.querySelector('.ytp-play-button');
                if (ytButton) {
                    const title = ytButton.getAttribute('title') ||
                                  ytButton.getAttribute('data-title-no-tooltip') ||
                                  ytButton.getAttribute('aria-label') || '';
                    const isCurrentlyPlaying = title.toLowerCase().includes('pause');
                    if ((action === 'play' && !isCurrentlyPlaying) || (action === 'pause' && isCurrentlyPlaying)) {
                        ytButton.click();
                    }
                    setTimeout(() => { isProcessingCommand = false; }, 1000);
                    return;
                }
            }

            // --- TWITCH ---
            if (isTwitch) {
                const twitchButton = document.querySelector('[data-a-target="player-play-pause-button"]');
                if (twitchButton) {
                    const label = twitchButton.getAttribute('aria-label')?.toLowerCase() || '';
                    // Mehrsprachige Pause-Erkennung
                    const isCurrentlyPlaying = label.includes('pause') ||
                                               label.includes('stoppen') ||
                                               label.includes('arrête') ||
                                               label.includes('detener');
                    if ((action === 'play' && !isCurrentlyPlaying) || (action === 'pause' && isCurrentlyPlaying)) {
                        twitchButton.click();
                    }
                    setTimeout(() => { isProcessingCommand = false; }, 1000);
                    return;
                }
            }

            // --- DEFAULT HTML5 VIDEO ---
            const videos = document.querySelectorAll('video');
            videos.forEach(v => {
                if (action === 'play') {
                    if (v.paused) {
                        v.play().catch(e => {
                            if (e.name === 'NotAllowedError') {
                                chrome.runtime.sendMessage({
                                    type: 'ADD_DEV_LOG',
                                    message: 'Autoplay blockiert. Bitte einmal auf die Seite klicken.',
                                    logType: 'warn'
                                }).catch(() => {});
                            } else {
                                chrome.runtime.sendMessage({
                                    type: 'ADD_DEV_LOG',
                                    message: `Native play fehlgeschlagen: ${e.message}`,
                                    logType: 'error'
                                }).catch(() => {});
                            }
                        });
                    }
                } else if (action === 'pause') {
                    if (!v.paused) v.pause();
                }
            });
        } catch (e) {
            chrome.runtime.sendMessage({
                type: 'ADD_DEV_LOG',
                message: `Media action Fehler: ${e.message}`,
                logType: 'error'
            }).catch(() => {});
        }
        setTimeout(() => { isProcessingCommand = false; }, 1000);
    }

    // --- Helper: poll video state with timeout ---
    function pollVideoState(targetPaused, timeoutMs = 2000) {
        return new Promise((resolve) => {
            const video = findVideo();
            if (!video) { resolve(false); return; }
            if (video.paused === targetPaused) { resolve(true); return; }

            const interval = 100;
            let elapsed = 0;
            const timer = setInterval(() => {
                elapsed += interval;
                if (video.paused === targetPaused) {
                    clearInterval(timer);
                    resolve(true);
                } else if (elapsed >= timeoutMs) {
                    clearInterval(timer);
                    resolve(false);
                }
            }, interval);
        });
    }

    // --- Helper: poll until seeked & buffered (readyState >= 3) ---
    function pollSeekReady(targetTime, timeoutMs = 8000) {
        return new Promise((resolve) => {
            const video = findVideo();
            if (!video) { resolve(false); return; }

            const interval = 150;
            let elapsed = 0;
            const timer = setInterval(() => {
                elapsed += interval;
                const timeDiff = Math.abs(video.currentTime - targetTime);
                const ready = video.readyState >= 3 && timeDiff < 1.0;
                if (ready) {
                    clearInterval(timer);
                    resolve(true);
                } else if (elapsed >= timeoutMs) {
                    clearInterval(timer);
                    resolve(false);
                }
            }, interval);
        });
    }

    // ─── Message Handler ──────────────────────────────────────────────────────

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        // Nachrichten die nicht für content.js bestimmt sind ignorieren
        if (message.source === 'extension_popup' || message.source === 'extension_background') {
            return false;
        }
        if (message.type === 'EXTENSION_INBOUND' || message.type === 'EXTENSION_OUTBOUND') {
            return false;
        }

        if (message.action === 'ping') {
            sendResponse({ status: 'ok' });
            return false;
        }

        // --- Diagnostics ---
        if (message.action === 'get_debug_info') {
            const result = {
                detectionStatus: 'Not Found',
                videoState:      'N/A',
                currentTime:     'N/A',
                readyState:      'N/A',
                sourceUrl:       window.location.href
            };
            try {
                const video = findVideo();
                if (video) {
                    result.detectionStatus = 'Found';
                    result.videoState      = video.paused ? 'Paused' : 'Playing';
                    result.currentTime     = video.currentTime.toFixed(1) + 's';
                    result.readyState      = video.readyState;
                    result.sourceUrl       = video.src || video.currentSrc || window.location.href;
                } else {
                    result.detectionStatus = 'No <video> element found';
                }
            } catch (e) {
                result.detectionStatus = `Error: ${e.message}`;
            }
            sendResponse(result);
            return false;
        }

        const videos = document.querySelectorAll('video');
        if (videos.length === 0) {
            sendResponse({ status: 'no_video' });
            return true;
        }

        // --- PLAY ---
        if (message.action === 'play') {
            tryMediaAction('play');
            pollVideoState(false).then(success => {
                sendResponse({ status: success ? 'playing' : 'failed' });
            });
            return true;
        }

        // --- PAUSE ---
        if (message.action === 'pause') {
            tryMediaAction('pause');
            pollVideoState(true).then(success => {
                sendResponse({ status: success ? 'paused' : 'failed' });
            });
            return true;
        }

        // --- FORCE SYNC Phase 1: Pause + Seek + warten bis gebuffert ---
        if (message.action === 'force_sync_pause_seek') {
            const targetTime = message.targetTime;
            const video = findVideo();
            if (!video) {
                sendResponse({ status: 'no_video' });
                return true;
            }

            tryMediaAction('pause');
            pollVideoState(true, 1500).then(() => {
                video.currentTime = targetTime;
                pollSeekReady(targetTime).then(ready => {
                    sendResponse({
                        status:      ready ? 'seek_ready' : 'seek_timeout',
                        currentTime: video.currentTime,
                        readyState:  video.readyState
                    });
                });
            });
            return true;
        }

        // --- FORCE SYNC Phase 2: Play ---
        if (message.action === 'force_sync_play') {
            tryMediaAction('play');
            pollVideoState(false).then(success => {
                sendResponse({ status: success ? 'playing' : 'failed' });
            });
            return true;
        }

        return false;
    });

    // ─── Heartbeat an background.js ───────────────────────────────────────────
    // Sendet alle 15s Playback-Status + ReadyState des Videos.
    // background.js cached diese Werte und sendet sie beim nächsten Bridge-Heartbeat
    // als tab_status an den Room. Kein direktes Antworten nötig.

    const heartbeatInterval = setInterval(() => {
        try {
            if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
                clearInterval(heartbeatInterval);
                return;
            }

            const video = findVideo();
            if (!video) return; // Kein Video = kein Heartbeat (Rauschen reduzieren)

            const playbackState  = video.paused ? 'paused' : 'playing';
            const videoReadyState = video.readyState;

            chrome.runtime.sendMessage({
                type:             'EXTENSION_HEARTBEAT',
                source:           'content',
                playbackState,
                videoReadyState
            }).catch(err => {
                if (err.message?.includes('Receiving end does not exist')) {
                    // Service Worker war schlafen — einmal wiederholen
                    setTimeout(() => {
                        if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
                            chrome.runtime.sendMessage({
                                type: 'EXTENSION_HEARTBEAT',
                                source: 'content',
                                playbackState,
                                videoReadyState
                            }).catch(() => {});
                        }
                    }, 1000);
                } else {
                    chrome.runtime.sendMessage({
                        type: 'ADD_DEV_LOG',
                        message: `Content Heartbeat Fehler: ${err.message}`,
                        logType: 'warn'
                    }).catch(() => {});
                }
            });
        } catch (e) {
            // Context definitiv weg
            clearInterval(heartbeatInterval);
        }
    }, 15000);

    // ─── Native Video Events (User drückt selbst Play/Pause) ─────────────────
    // Wird sofort an den Room gemeldet, nicht erst beim nächsten Heartbeat.

    function reportVideoEvent(action) {
        if (isProcessingCommand) return; // Ignorieren wenn wir selbst einen Befehl ausführen

        const video = findVideo();
        chrome.runtime.sendMessage({
            type:   'EXTENSION_OUTBOUND',
            source: 'video_native_event',
            payload: {
                action,
                timestamp:   new Date().toISOString(),
                currentTime: video ? video.currentTime : null,
                sourceUrl:   window.location.href
            }
        }).catch(() => {});
    }

    function attachVideoListeners(video) {
        if (!video || video.dataset.syncAttached === 'true') return;
        video.addEventListener('play',  () => reportVideoEvent('play'));
        video.addEventListener('pause', () => reportVideoEvent('pause'));
        video.dataset.syncAttached = 'true';
    }

    // ─── Video-Erkennung (auch für SPAs mit nachträglich eingefügten Videos) ──

    function waitForBody(callback) {
        if (document.body) { callback(); return; }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback, { once: true });
            return;
        }
        setTimeout(() => waitForBody(callback), 100);
    }

    const initSync = () => {
        const video = findVideo();
        if (video) attachVideoListeners(video);
    };

    const observer = new MutationObserver(() => initSync());
    const fallbackInterval = setInterval(initSync, 5000);

    initSync();
    waitForBody(() => {
        if (!document.body) return;
        observer.observe(document.body, { childList: true, subtree: true });
        initSync();
    });

})();
