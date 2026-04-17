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
        return document.querySelector('video');
    }

    // --- Helper: safely play/pause taking YouTube, Twitch and other SPA players into account ---
    function tryMediaAction(action) {
        isProcessingCommand = true;
        try {
            const host = window.location.hostname.toLowerCase();
            const isYouTube = host.includes('youtube.com');
            const isTwitch = host.includes('twitch.tv');

            // --- YOUTUBE SPECIAL HANDLING ---
            if (isYouTube) {
                const ytButton = document.querySelector('.ytp-play-button');
                if (ytButton) {
                    const title = ytButton.getAttribute('title') || ytButton.getAttribute('data-title-no-tooltip') || ytButton.getAttribute('aria-label') || '';
                    const isCurrentlyPlaying = title.toLowerCase().includes('pause');

                    if ((action === 'play' && !isCurrentlyPlaying) || (action === 'pause' && isCurrentlyPlaying)) {
                        ytButton.click();
                        setTimeout(() => { isProcessingCommand = false; }, 1000);
                        return;
                    } else {
                        isProcessingCommand = false;
                        return;
                    }
                }
            }

            // --- TWITCH SPECIAL HANDLING ---
            if (isTwitch) {
                const twitchButton = document.querySelector('[data-a-target="player-play-pause-button"]');
                if (twitchButton) {
                    // Check state via aria-label or internal icon
                    const label = twitchButton.getAttribute('aria-label')?.toLowerCase() || '';
                    const isCurrentlyPlaying = label.includes('pause') || label.includes('wiedergabe stoppen');

                    if ((action === 'play' && !isCurrentlyPlaying) || (action === 'pause' && isCurrentlyPlaying)) {
                        twitchButton.click();
                        setTimeout(() => { isProcessingCommand = false; }, 1000);
                        return;
                    } else {
                        isProcessingCommand = false;
                        return;
                    }
                }
            }

            // --- DEFAULT HTML5 VIDEO FALLBACK ---
            const videos = document.querySelectorAll('video');
            videos.forEach(v => {
                if (action === 'play') {
                    if (v.paused) {
                        v.play().catch(e => {
                            if (e.name === 'NotAllowedError') {
                                chrome.runtime.sendMessage({ type: 'ADD_DEV_LOG', message: 'SyncExtension: Autoplay blocked. Please click the page once.', logType: 'warn' }).catch(() => {});
                                console.warn('SyncExtension: Autoplay blocked. Please click the page once to enable sync.');
                            } else {
                                chrome.runtime.sendMessage({ type: 'ADD_DEV_LOG', message: `SyncExtension: Native play failed: ${e.message}`, logType: 'error' }).catch(() => {});
                                console.debug('SyncExtension: Native play failed:', e.message);
                            }
                        });
                    }
                } else if (action === 'pause') {
                    if (!v.paused) v.pause();
                }
            });
        } catch (e) {
            chrome.runtime.sendMessage({ type: 'ADD_DEV_LOG', message: `SyncExtension: Error in media action: ${e.message}`, logType: 'error' }).catch(() => {});
            console.error('SyncExtension: Error in media action:', e);
        }
        setTimeout(() => { isProcessingCommand = false; }, 1000);
    }

    // --- Helper: poll video state with timeout ---
    function pollVideoState(targetPaused, timeoutMs = 2000) {
        return new Promise((resolve) => {
            const video = findVideo();
            if (!video) { resolve(false); return; }

            // Check immediately
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

    // --- Helper: poll until seeked & buffered ---
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

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        // Ignore messages meant for bridge.js (bidirectional sync and ACK)
        if (message.source === 'extension_popup' || message.source === 'extension_background') {
            return false;
        }
        // Ignore generic pipe wrappers — only handle raw payloads
        if (message.type === 'EXTENSION_INBOUND' || message.type === 'EXTENSION_OUTBOUND') {
            return false;
        }

        if (message.action === 'ping') {
            sendResponse({ status: 'ok' });
            return true;
        }

        // --- Diagnostics ---
        if (message.action === 'get_debug_info') {
            const result = {
                detectionStatus: 'Not Found',
                videoState: 'N/A',
                currentTime: 'N/A',
                readyState: 'N/A',
                sourceUrl: window.location.href
            };

            try {
                const targetVideo = findVideo();
                if (targetVideo) {
                    result.detectionStatus = 'Found';
                    result.videoState = targetVideo.paused ? 'Paused' : 'Playing';
                    result.currentTime = targetVideo.currentTime.toFixed(1) + 's';
                    result.readyState = targetVideo.readyState;
                    result.sourceUrl = targetVideo.src || targetVideo.currentSrc || window.location.href;
                } else {
                    result.detectionStatus = 'No <video> element found';
                }
            } catch (e) {
                chrome.runtime.sendMessage({ type: 'ADD_DEV_LOG', message: `Content: Debug info error: ${e.message}`, logType: 'warn' }).catch(() => {});
                result.detectionStatus = `Error: ${e.message}`;
            }

            sendResponse(result);
            return true;
        }

        const videos = document.querySelectorAll('video');
        if (videos.length === 0) {
            sendResponse({ status: 'no_video' });
            return true;
        }

        // --- PLAY with verified ACK ---
        if (message.action === 'play') {
            tryMediaAction('play');
            pollVideoState(false).then(success => {
                sendResponse({ status: success ? 'playing' : 'failed' });
            });
            return true; // async
        }

        // --- PAUSE with verified ACK ---
        if (message.action === 'pause') {
            tryMediaAction('pause');
            pollVideoState(true).then(success => {
                sendResponse({ status: success ? 'paused' : 'failed' });
            });
            return true; // async
        }

        // --- FORCE SYNC: Phase 1 - Pause + Seek ---
        if (message.action === 'force_sync_pause_seek') {
            const targetTime = message.targetTime;
            const video = findVideo();

            if (!video) {
                sendResponse({ status: 'no_video' });
                return true;
            }

            // Pause first
            tryMediaAction('pause');

            // Wait until paused, then seek
            pollVideoState(true, 1500).then(() => {
                video.currentTime = targetTime;

                // Wait until seeked and buffered
                pollSeekReady(targetTime).then(ready => {
                    sendResponse({
                        status: ready ? 'seek_ready' : 'seek_timeout',
                        currentTime: video.currentTime,
                        readyState: video.readyState
                    });
                });
            });

            return true; // async
        }

        // --- FORCE SYNC: Phase 2 - Play ---
        if (message.action === 'force_sync_play') {
            tryMediaAction('play');
            pollVideoState(false).then(success => {
                sendResponse({ status: success ? 'playing' : 'failed' });
            });
            return true; // async
        }

        return;
    });

    // HEARTBEAT: Ping background.js every 15 seconds to keep it alive
    // Only run if we have a video or were active to minimize noise on non-media tabs
    const heartbeatInterval = setInterval(() => {
        try {
            // 1. Extra robust check: id is gone = context dead
            if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
                clearInterval(heartbeatInterval);
                return;
            }

            const video = findVideo();
            if (video || window.koalaSyncInjected) {
                const playbackState = video ? (video.paused ? 'paused' : 'playing') : null;
                // 2. Double protection with try/catch because sendMessage throws synchronously on invalid context
                chrome.runtime.sendMessage({ type: 'EXTENSION_HEARTBEAT', source: 'content', playbackState })
                    .catch(err => {
                        if (err.message?.includes('Receiving end does not exist')) {
                            setTimeout(() => {
                                if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
                                    chrome.runtime.sendMessage({ type: 'EXTENSION_HEARTBEAT', source: 'content', playbackState }).catch(() => {});
                                }
                            }, 1000);
                        } else {
                            chrome.runtime.sendMessage({ type: 'ADD_DEV_LOG', message: `Content Heartbeat failed: ${err.message}`, logType: 'warn' }).catch(() => {});
                            clearInterval(heartbeatInterval);
                        }
                    });
            }
        } catch (e) {
            // Context is definitely gone - no way to log here as sendMessage would throw
            clearInterval(heartbeatInterval);
        }
    }, 15000);

    // --- TWO-WAY SYNC: Listen for native video events ---
    function reportVideoEvent(action) {
        if (isProcessingCommand) return;
        
        const video = findVideo();
        const payload = {
            action: action,
            timestamp: new Date().toISOString(),
            currentTime: video ? video.currentTime : null,
            sourceUrl: window.location.href
        };

        chrome.runtime.sendMessage({
            type: 'EXTENSION_OUTBOUND',
            source: 'video_native_event',
            payload: payload
        }).catch((err) => {
            console.warn('Silent sync failure (context likely gone)');
        });
    }

    function attachVideoListeners(video) {
        if (!video || video.dataset.syncAttached === 'true') return;
        
        video.addEventListener('play', () => reportVideoEvent('play'));
        video.addEventListener('pause', () => reportVideoEvent('pause'));
        video.dataset.syncAttached = 'true';
    }

    // Check for videos immediately and periodically
    let observer;
    let fallbackInterval = null;

    const initSync = () => {
        const video = findVideo();
        if (video) {
            attachVideoListeners(video);
            if (observer) observer.disconnect();
            // Bug 4 Fix: Clear fallback interval once video is found and attached
            if (video.dataset.syncAttached === 'true' && fallbackInterval) {
                clearInterval(fallbackInterval);
                fallbackInterval = null;
            }
        }
    };

    observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.addedNodes.length) {
                initSync();
            }
        }
    });

    initSync();
    fallbackInterval = setInterval(initSync, 5000); // Rare fallback check, cleared once video is attached
    observer.observe(document.body, { childList: true, subtree: true });

})();
