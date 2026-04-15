import { useEffect, useRef } from 'react';
import EVENTS from '../socketEvents';
import { playAlarmSound, playPingSound } from '../utils/soundGenerator';
import { useAuth } from '../context/AuthContext';

/**
 * GlobalAudioController
 * Renders nothing visible. Listens on the global socket for TIMER_COMPLETED events
 * and plays the alarm sound globally (even if the user is not on the Room page).
 * Also handles pre-timer ping if the user has configured preTimerPingSeconds.
 */
const GlobalAudioController = ({ socket, roomState }) => {
    const { user } = useAuth();
    const hasPingedRef = useRef(false);
    const prevRemainingRef = useRef(null);

    // Reset ping flag when timer resets or room changes
    useEffect(() => {
        hasPingedRef.current = false;
    }, [roomState?.id, roomState?.config?.durationMs]);

    // Global alarm on timer completion
    useEffect(() => {
        if (!socket) return;

        const handleTimerCompleted = () => {
            const alarmSound = user?.preferences?.alarmSound || 'Classic Beep';
            playAlarmSound(alarmSound);
        };

        socket.on(EVENTS.TIMER_COMPLETED, handleTimerCompleted);
        return () => socket.off(EVENTS.TIMER_COMPLETED, handleTimerCompleted);
    }, [socket, user?.preferences?.alarmSound]);

    // Pre-timer ping
    useEffect(() => {
        if (!roomState?.state?.isRunning) return;

        const preTimerPingSeconds = parseInt(user?.preferences?.preTimerPingSeconds) || 0;
        if (preTimerPingSeconds <= 0) return;

        const remainingMs = roomState.state.remainingMs;
        const thresholdMs = preTimerPingSeconds * 1000;

        // Only ping once per timer cycle when crossing the threshold
        if (remainingMs <= thresholdMs && !hasPingedRef.current) {
            hasPingedRef.current = true;
            playPingSound();
        }

        // Reset if timer was extended or restarted past the threshold
        if (remainingMs > thresholdMs) {
            hasPingedRef.current = false;
        }

        prevRemainingRef.current = remainingMs;
    }, [roomState?.state?.remainingMs, roomState?.state?.isRunning, user?.preferences?.preTimerPingSeconds]);

    return null; // This component renders nothing
};

export default GlobalAudioController;
