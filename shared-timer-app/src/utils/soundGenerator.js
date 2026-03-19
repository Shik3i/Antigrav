// Synthetic Audio Generator using Web Audio API
// This creates alarm sounds without needing external mp3 files

let audioCtx = null;

const getAudioContext = () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
};

export const ALARM_SOUNDS = {
    NONE: 'Mute (Kein Ton)',
    CLASSIC_BEEP: 'Classic Beep',
    SOFT_BELL: 'Soft Bell',
    DIGITAL_ALARM: 'Digital Alarm',
    GONG: 'Gong',
    BIRD: 'Bird Chirp',
    CHIME: 'Wind Chime',
    BUZZER: 'Buzzer',
    WATCH_BEEP: 'Digital Watch Beep',
    SONAR: 'Submarine Sonar',
    TWINKLE: 'Magic Twinkle',
    ARCADE: 'Retro Arcade',
    ECHO_DROP: 'Echo Drop',
    SIREN: 'Emergency Siren'
};

export const playAlarmSound = (soundType) => {
    if (!soundType || soundType === ALARM_SOUNDS.NONE) return;

    const ctx = getAudioContext();
    const t = ctx.currentTime;

    switch (soundType) {
        case ALARM_SOUNDS.SOFT_BELL:
            playSoftBell(ctx, t);
            break;
        case ALARM_SOUNDS.DIGITAL_ALARM:
            playDigitalAlarm(ctx, t);
            break;
        case ALARM_SOUNDS.GONG:
            playGong(ctx, t);
            break;
        case ALARM_SOUNDS.BIRD:
            playBird(ctx, t);
            break;
        case ALARM_SOUNDS.CHIME:
            playChime(ctx, t);
            break;
        case ALARM_SOUNDS.BUZZER:
            playBuzzer(ctx, t);
            break;
        case ALARM_SOUNDS.WATCH_BEEP:
            playWatchBeep(ctx, t);
            break;
        case ALARM_SOUNDS.SONAR:
            playSonar(ctx, t);
            break;
        case ALARM_SOUNDS.TWINKLE:
            playTwinkle(ctx, t);
            break;
        case ALARM_SOUNDS.ARCADE:
            playArcade(ctx, t);
            break;
        case ALARM_SOUNDS.ECHO_DROP:
            playEchoDrop(ctx, t);
            break;
        case ALARM_SOUNDS.SIREN:
            playSiren(ctx, t);
            break;
        case ALARM_SOUNDS.CLASSIC_BEEP:
        default:
            playClassicBeep(ctx, t);
            break;
    }
};

const playClassicBeep = (ctx, t) => {
    [0, 0.25, 0.5, 0.75].forEach(delay => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, t + delay); // A5

        gain.gain.setValueAtTime(0, t + delay);
        gain.gain.linearRampToValueAtTime(0.5, t + delay + 0.05);
        gain.gain.linearRampToValueAtTime(0, t + delay + 0.15);

        osc.start(t + delay);
        osc.stop(t + delay + 0.2);
    });
};

const playArcade = (ctx, t) => {
    // A rapid arpeggio
    const freqs = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
    freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t + (idx * 0.1));

        gain.gain.setValueAtTime(0, t + (idx * 0.1));
        gain.gain.linearRampToValueAtTime(0.2, t + (idx * 0.1) + 0.02);
        gain.gain.linearRampToValueAtTime(0, t + (idx * 0.1) + 0.1);

        osc.start(t + (idx * 0.1));
        osc.stop(t + (idx * 0.1) + 0.1);
    });
};

const playEchoDrop = (ctx, t) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';

    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 1.5);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.6, t + 0.1);

    // Create an echo effect with the gain
    for (let i = 0; i < 5; i++) {
        gain.gain.exponentialRampToValueAtTime(0.4 / (i + 1), t + 0.3 + (i * 0.3));
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5 + (i * 0.3));
    }
    gain.gain.linearRampToValueAtTime(0, t + 2);

    osc.start(t);
    osc.stop(t + 2);
};

const playSiren = (ctx, t) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';

    // Modulate frequency up and down
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.linearRampToValueAtTime(1200, t + 0.5);
    osc.frequency.linearRampToValueAtTime(600, t + 1.0);
    osc.frequency.linearRampToValueAtTime(1200, t + 1.5);
    osc.frequency.linearRampToValueAtTime(600, t + 2.0);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.1);
    gain.gain.setValueAtTime(0.3, t + 1.9);
    gain.gain.linearRampToValueAtTime(0, t + 2.0);

    osc.start(t);
    osc.stop(t + 2.0);
};

const playSoftBell = (ctx, t) => {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    // E6 and B6 harmonious chord
    osc1.frequency.setValueAtTime(1318.51, t);
    osc2.frequency.setValueAtTime(1975.53, t);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.05); // Soft attack
    gain.gain.exponentialRampToValueAtTime(0.01, t + 2.0); // Long decay

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 2.0);
    osc2.stop(t + 2.0);
};

const playDigitalAlarm = (ctx, t) => {
    for (let i = 0; i < 4; i++) {
        const delay = i * 0.4;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, t + delay);
        osc.frequency.setValueAtTime(1600, t + delay + 0.1);

        osc.connect(gain);
        gain.connect(ctx.destination);

        gain.gain.setValueAtTime(0, t + delay);
        gain.gain.setValueAtTime(0.15, t + delay + 0.02);
        gain.gain.setValueAtTime(0.15, t + delay + 0.2);
        gain.gain.setValueAtTime(0, t + delay + 0.22);

        osc.start(t + delay);
        osc.stop(t + delay + 0.25);
    }
};

const playGong = (ctx, t) => {
    // Generate complex waveform with multiple oscillators for a rich gong
    const freqs = [200, 280, 420, 560];
    const gains = [0.6, 0.4, 0.3, 0.2];

    freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        // Add slight detune for richness
        osc.frequency.setValueAtTime(freq + (Math.random() * 5), t);

        osc.connect(gain);
        gain.connect(ctx.destination);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(gains[idx], t + 0.1); // Attack
        gain.gain.exponentialRampToValueAtTime(0.01, t + 3.5); // Long resonant decay

        osc.start(t);
        osc.stop(t + 3.5);
    });
};

const playBird = (ctx, t) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(4000, t);
    osc.frequency.linearRampToValueAtTime(6000, t + 0.1);
    osc.frequency.linearRampToValueAtTime(4000, t + 0.2);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
    gain.gain.linearRampToValueAtTime(0, t + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.25);

    // Echo chirp
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(4500, t + 0.3);
    osc2.frequency.linearRampToValueAtTime(6500, t + 0.4);
    osc2.frequency.linearRampToValueAtTime(4500, t + 0.5);

    gain2.gain.setValueAtTime(0, t + 0.3);
    gain2.gain.linearRampToValueAtTime(0.2, t + 0.35);
    gain2.gain.linearRampToValueAtTime(0, t + 0.5);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(t + 0.3);
    osc2.stop(t + 0.55);
};

const playChime = (ctx, t) => {
    const freqs = [1046.50, 1318.51, 1567.98, 2093.00]; // C6, E6, G6, C7
    freqs.forEach((freq, i) => {
        const delay = i * 0.15;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + delay);

        gain.gain.setValueAtTime(0, t + delay);
        gain.gain.linearRampToValueAtTime(0.3, t + delay + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, t + delay + 2.0);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t + delay);
        osc.stop(t + delay + 2.0);
    });
};

const playBuzzer = (ctx, t) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, t);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.5, t + 0.05);
    gain.gain.setValueAtTime(0.5, t + 0.8);
    gain.gain.linearRampToValueAtTime(0, t + 0.9);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 1.0);
};

const playWatchBeep = (ctx, t) => {
    // Sharp double beep like a casio watch
    [0, 0.15].forEach(delay => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(2000, t + delay);

        gain.gain.setValueAtTime(0, t + delay);
        gain.gain.linearRampToValueAtTime(0.2, t + delay + 0.01);
        gain.gain.linearRampToValueAtTime(0, t + delay + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t + delay);
        osc.stop(t + delay + 0.1);
    });
};

const playSonar = (ctx, t) => {
    // Deep ping with long trailing echo
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.5);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.4, t + 0.05); // Sharp attack
    gain.gain.exponentialRampToValueAtTime(0.01, t + 3.0); // Long underwater decay

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 3.0);
};

const playTwinkle = (ctx, t) => {
    // Rapid ascending arpeggio
    const freqs = [1046.50, 1318.51, 1567.98, 2093.00, 2637.02, 3135.96]; // C6, E6, G6, C7, E7, G7
    freqs.forEach((freq, idx) => {
        const delay = idx * 0.08;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + delay);

        gain.gain.setValueAtTime(0, t + delay);
        gain.gain.linearRampToValueAtTime(0.15, t + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, t + delay + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t + delay);
        osc.stop(t + delay + 0.3);
    });
};

// A gentle two-tone ping for pre-timer notification
export const playPingSound = () => {
    const ctx = getAudioContext();
    const t = ctx.currentTime;

    [0, 0.2].forEach((delay, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(i === 0 ? 880 : 1320, t + delay);
        gain.gain.setValueAtTime(0, t + delay);
        gain.gain.linearRampToValueAtTime(0.25, t + delay + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.01, t + delay + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t + delay);
        osc.stop(t + delay + 0.35);
    });
};
