// content.js - Injected into video tabs
// Handles play/pause commands, diagnostics, and force sync

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

    // --- Helper: find the best video element on the page ---
    function findVideo() {
        const videos = document.querySelectorAll('video');
        if (videos.length > 0) return videos[0];
        return document.querySelector('video');
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

    const videos = document.querySelectorAll('video');

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
            result.detectionStatus = `Error: ${e.message}`;
        }

        sendResponse(result);
        return true;
    }

    if (videos.length === 0) {
        sendResponse({ status: 'no_video' });
        return true;
    }

    // --- Helper: safely play/pause taking YouTube and other SPA players into account ---
    const tryMediaAction = (action) => {
        try {
            const isYouTube = window.location.hostname.includes('youtube.com');

            if (isYouTube) {
                const ytButton = document.querySelector('.ytp-play-button');
                if (ytButton) {
                    const title = ytButton.getAttribute('title') || ytButton.getAttribute('data-title-no-tooltip') || ytButton.getAttribute('aria-label') || '';
                    const isCurrentlyPlaying = title.toLowerCase().includes('pause');

                    if ((action === 'play' && !isCurrentlyPlaying) || (action === 'pause' && isCurrentlyPlaying)) {
                        ytButton.click();
                        return;
                    } else {
                        return; // Already in desired state
                    }
                }

                const ytVideo = document.querySelector('video.video-stream.html5-main-video');
                if (ytVideo) {
                    if (action === 'play' && ytVideo.paused) {
                        ytVideo.play().catch(e => console.warn('YT native play fails:', e));
                    } else if (action === 'pause' && !ytVideo.paused) {
                        ytVideo.pause();
                    }
                    return;
                }
            }

            // Default HTML5 Video approach
            videos.forEach(v => {
                if (action === 'play') {
                    if (v.paused) v.play().catch(e => console.error('Play failed:', e));
                } else if (action === 'pause') {
                    if (!v.paused) v.pause();
                }
            });
        } catch (e) {
            console.error('Error in media action:', e);
        }
    };

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

    return true;
});
