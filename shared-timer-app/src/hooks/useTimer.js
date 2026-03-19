import { useState, useEffect, useRef } from 'react';
import EVENTS from '../socketEvents';

export function useTimer(roomState, socket) {
    const [localRemainingMs, setLocalRemainingMs] = useState(0);
    const [showConfetti, setShowConfetti] = useState(false);
    const animationRef = useRef(null);
    const audioContextRef = useRef(null);

    useEffect(() => {
        if (!roomState) return;
        setLocalRemainingMs(roomState.state.remainingMs);

        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
    }, [roomState?.state.remainingMs, roomState?.config.durationMs]);

    useEffect(() => {
        if (!roomState) return;

        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }

        if (roomState.state.isRunning) {
            let lastTime = performance.now();
            const updateTimer = (currentTime) => {
                const delta = currentTime - lastTime;
                lastTime = currentTime;
                setLocalRemainingMs(prev => {
                    const next = prev - delta;
                    return next > 0 ? next : 0;
                });
                animationRef.current = requestAnimationFrame(updateTimer);
            };
            animationRef.current = requestAnimationFrame(updateTimer);
        } else {
            setLocalRemainingMs(roomState.state.remainingMs);
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        }
        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [roomState?.state.isRunning, roomState?.state.remainingMs]);

    useEffect(() => {
        if (!socket || !roomState) return;

        const playRingtone = () => {
            if (!audioContextRef.current) return;
            const ctx = audioContextRef.current;
            if (ctx.state === 'suspended') ctx.resume();

            [0, 0.25, 0.5, 0.75].forEach(delay => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, ctx.currentTime + delay);
                osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + delay + 0.1);

                gain.gain.setValueAtTime(0, ctx.currentTime + delay);
                gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + delay + 0.05);
                gain.gain.linearRampToValueAtTime(0, ctx.currentTime + delay + 0.15);

                osc.start(ctx.currentTime + delay);
                osc.stop(ctx.currentTime + delay + 0.2);
            });
        };

        const handleCompleted = () => {
            setLocalRemainingMs(0);
            playRingtone();
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 4000);
            if (Notification.permission === 'granted') {
                new Notification('Timer Completed!', {
                    body: `The timer "${roomState?.config?.name || 'Session'}" has finished.`,
                    icon: '/vite.svg'
                });
            }
        };
        socket.on(EVENTS.TIMER_COMPLETED, handleCompleted);
        return () => socket.off(EVENTS.TIMER_COMPLETED, handleCompleted);
    }, [socket, roomState]);

    const resumeAudioContext = () => {
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
    };

    return { localRemainingMs, showConfetti, resumeAudioContext };
}
