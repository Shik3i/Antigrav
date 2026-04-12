import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Gamepad2, Trophy, ArrowLeft, RotateCcw, Play, Pause, Zap, Timer, Coffee } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ─── Constants ────────────────────────────────────────────────
const COLS = 10;
const ROWS = 20;
const CELL = 30;
const CANVAS_W = COLS * CELL;
const CANVAS_H = ROWS * CELL;
const PREVIEW_CELL = 16;
const PREVIEW_CELL_SM = 10;
const NEXT_QUEUE_SIZE = 5;
const LOCK_DELAY_MS = 500;
const LOCK_DELAY_MAX_RESETS = 15;
const SPRINT_TARGET = 40;

const TETROMINO_KEYS = 'IJLOSTZ';

const SHAPES = {
    I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    J: [[1,0,0],[1,1,1],[0,0,0]],
    L: [[0,0,1],[1,1,1],[0,0,0]],
    O: [[1,1],[1,1]],
    S: [[0,1,1],[1,1,0],[0,0,0]],
    T: [[0,1,0],[1,1,1],[0,0,0]],
    Z: [[1,1,0],[0,1,1],[0,0,0]],
};

const PIECE_COLORS = {
    I: null,
    J: '#6366f1',
    L: '#f97316',
    O: '#eab308',
    S: '#22c55e',
    T: '#a855f7',
    Z: '#ef4444',
};

// ─── Pure helpers ─────────────────────────────────────────────

function createEmptyBoard() {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomBag() {
    const keys = TETROMINO_KEYS.split('');
    for (let i = keys.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [keys[i], keys[j]] = [keys[j], keys[i]];
    }
    return keys;
}

function rotateMatrix(matrix) {
    const N = matrix.length;
    const out = [];
    for (let c = 0; c < N; c++) {
        const row = [];
        for (let r = N - 1; r >= 0; r--) row.push(matrix[r][c]);
        out.push(row);
    }
    return out;
}

function collides(board, shape, offX, offY) {
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (!shape[r][c]) continue;
            const bx = offX + c, by = offY + r;
            if (bx < 0 || bx >= COLS || by >= ROWS) return true;
            if (by >= 0 && board[by][bx]) return true;
        }
    }
    return false;
}

function mergeToBoard(board, shape, key, offX, offY) {
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (!shape[r][c]) continue;
            const bx = offX + c, by = offY + r;
            if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) board[by][bx] = key;
        }
    }
}

function findClearedRows(board) {
    const rows = [];
    for (let r = 0; r < ROWS; r++) {
        if (board[r].every(v => v !== 0)) rows.push(r);
    }
    return rows;
}

function removeRows(board, rows) {
    const sorted = [...rows].sort((a, b) => a - b);
    for (const r of sorted) { board.splice(r, 1); board.unshift(new Array(COLS).fill(0)); }
}

function getColor(key, accentColor) {
    if (key === 'I') return accentColor;
    return PIECE_COLORS[key] || accentColor;
}

function formatSprintTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    const frac = Math.floor((ms % 1000) / 10);
    return `${min}:${sec.toString().padStart(2, '0')}.${frac.toString().padStart(2, '0')}`;
}

// ─── Component ────────────────────────────────────────────────

const Tetris = () => {
    const navigate = useNavigate();
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    const [displayScore, setDisplayScore] = useState(0);
    const [displayLines, setDisplayLines] = useState(0);
    const [displayLevel, setDisplayLevel] = useState(1);
    const [displayHighScore, setDisplayHighScore] = useState(0);
    const [gamePhase, setGamePhase] = useState('IDLE'); // IDLE | PLAYING | PAUSED | OVER
    const [gameMode, setGameMode] = useState('endless'); // endless | sprint
    const [sprintTime, setSprintTime] = useState(0);

    const [speedMode, setSpeedMode] = useState(() => {
        try { return localStorage.getItem('tetris_speed_mode') === 'true'; } catch { return false; }
    });
    const speedModeRef = useRef(false);

    // Scaling Logic
    const [gameScale, setGameScale] = useState(1);
    const updateScale = useCallback(() => {
        const availableH = window.innerHeight - 150; // Account for header and padding
        const baseH = 700; // The intrinsic height of our game cluster
        const newScale = Math.max(0.5, Math.min(2.5, availableH / baseH));
        setGameScale(newScale);
    }, []);

    useEffect(() => {
        updateScale();
        window.addEventListener('resize', updateScale);
        return () => window.removeEventListener('resize', updateScale);
    }, [updateScale]);

    const [chillMode, setChillMode] = useState(() => {
        try { return localStorage.getItem('tetris_chill_mode') === 'true'; } catch { return false; }
    });
    const chillModeRef = useRef(false);

    useEffect(() => {
        chillModeRef.current = chillMode;
        try { localStorage.setItem('tetris_chill_mode', chillMode.toString()); } catch {}
    }, [chillMode]);

    useEffect(() => {
        speedModeRef.current = speedMode;
        try { localStorage.setItem('tetris_speed_mode', speedMode.toString()); } catch {}
    }, [speedMode]);

    useEffect(() => {
        chillModeRef.current = chillMode;
        try { localStorage.setItem('tetris_chill_mode', chillMode.toString()); } catch {}
    }, [chillMode]);

    const [previewTick, setPreviewTick] = useState(0);

    const gRef = useRef({
        board: createEmptyBoard(),
        piece: null,
        nextQueue: [],        // Array of 5 piece keys
        holdKey: null,
        holdUsed: false,
        bag: [],
        score: 0,
        lines: 0,
        level: 1,
        highScore: 0,
        dropInterval: 1000,
        lastDrop: 0,
        phase: 'IDLE',
        mode: 'endless',
        softDrop: false,
        animId: null,
        // Line clear
        clearingRows: [],
        clearFlash: 0,
        // Lock delay
        lockDelayActive: false,
        lockDelayStart: 0,
        lockDelayResets: 0,
        // Board shake
        shakeX: 0,
        shakeY: 0,
        shakeDuration: 0,
        shakeAmplitude: 0,
        // Particles
        particles: [],
        // Sprint
        sprintStartTime: 0,
    });

    // ─── Score Submission ─────────────────────────────────────

    const submitScore = useCallback(async (finalScore, finalLines, finalLevel, sprintTime = 0) => {
        const token = localStorage.getItem('timerToken');
        if (!token || (finalScore === 0 && sprintTime === 0)) return;
        
        try {
            await fetch('/api/games/tetris/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ 
                    score: finalScore, 
                    lines: finalLines, 
                    level: finalLevel,
                    sprintTime: Math.floor(sprintTime)
                }),
            });
        } catch (e) {
            console.error('Failed to submit Tetris score', e);
        }
    }, []);

    // ─── Bag system ───────────────────────────────────────────

    const drawNextKey = useCallback(() => {
        const g = gRef.current;
        if (g.bag.length === 0) g.bag = randomBag();
        return g.bag.pop();
    }, []);

    const fillQueue = useCallback(() => {
        const g = gRef.current;
        while (g.nextQueue.length < NEXT_QUEUE_SIZE) {
            g.nextQueue.push(drawNextKey());
        }
    }, [drawNextKey]);

    // ─── Shake trigger ────────────────────────────────────────

    const triggerShake = useCallback((amplitude, duration) => {
        const g = gRef.current;
        g.shakeAmplitude = amplitude;
        g.shakeDuration = duration;
    }, []);

    // ─── Spawn particles ──────────────────────────────────────

    const spawnParticles = useCallback((clearedRows, accentColor) => {
        const g = gRef.current;
        for (const row of clearedRows) {
            for (let c = 0; c < COLS; c++) {
                const cellColor = g.board[row][c] ? getColor(g.board[row][c], accentColor) : '#fff';
                const count = 3 + Math.floor(Math.random() * 3);
                for (let i = 0; i < count; i++) {
                    g.particles.push({
                        x: c * CELL + CELL / 2 + (Math.random() - 0.5) * CELL,
                        y: row * CELL + CELL / 2,
                        vx: (Math.random() - 0.5) * 6,
                        vy: -(Math.random() * 3 + 1),
                        color: Math.random() > 0.3 ? cellColor : '#ffffff',
                        life: 25 + Math.floor(Math.random() * 20),
                        maxLife: 45,
                        size: 2 + Math.random() * 3,
                    });
                }
            }
        }
    }, []);

    // ─── Spawn ────────────────────────────────────────────────

    const spawnPiece = useCallback(() => {
        const g = gRef.current;
        fillQueue();
        const key = g.nextQueue.shift();
        fillQueue();
        const shape = SHAPES[key];
        const x = Math.floor((COLS - shape[0].length) / 2);
        const y = 0;
        if (collides(g.board, shape, x, y)) {
            g.phase = 'OVER';
            setGamePhase('OVER');
            if (g.score > g.highScore) { g.highScore = g.score; setDisplayHighScore(g.score); }
            // Send 0 lines here because they were already sent incrementally during play
            submitScore(g.score, 0, g.level);
            return;
        }
        g.piece = { key, shape, x, y };
        g.holdUsed = false;
        g.lockDelayActive = false;
        g.lockDelayResets = 0;
        setPreviewTick(t => t + 1);
    }, [submitScore, fillQueue]);

    // ─── Lock piece ───────────────────────────────────────────

    const lockPiece = useCallback(() => {
        const g = gRef.current;
        if (!g.piece) return;
        mergeToBoard(g.board, g.piece.shape, g.piece.key, g.piece.x, g.piece.y);
        g.piece = null;
        g.lockDelayActive = false;
        g.lockDelayResets = 0;

        const cleared = findClearedRows(g.board);
        if (cleared.length > 0) {
            // Spawn particles BEFORE removing rows (while colors still exist)
            const styles = getComputedStyle(document.documentElement);
            const ac = styles.getPropertyValue('--accent-primary').trim() || '#3b82f6';
            spawnParticles(cleared, ac);

            g.clearingRows = cleared;
            g.clearFlash = 0;

            // Board shake: bigger for Tetris (4 lines)
            if (cleared.length >= 4) {
                triggerShake(6, 14);
            } else if (cleared.length >= 2) {
                triggerShake(3, 8);
            }
        } else {
            spawnPiece();
        }
    }, [spawnPiece, spawnParticles, triggerShake]);

    const finalizeClear = useCallback(() => {
        const g = gRef.current;
        const count = g.clearingRows.length;
        removeRows(g.board, g.clearingRows);
        g.clearingRows = [];

        const linePoints = [0, 100, 300, 500, 800];
        g.score += (linePoints[count] || count * 200) * g.level;
        g.lines += count;
        g.level = Math.floor(g.lines / 10) + 1;
        g.dropInterval = Math.max(80, 1000 - (g.level - 1) * 75);

        setDisplayScore(g.score);
        setDisplayLines(g.lines);
        setDisplayLevel(g.level);

        // Persistent saving: Save the lines cleared JUST NOW (incremental)
        if (count > 0) {
            submitScore(g.score, count, g.level);
        }

        // Sprint mode: check win condition
        if (g.mode === 'sprint' && g.lines >= SPRINT_TARGET) {
            const elapsed = performance.now() - g.sprintStartTime;
            setSprintTime(elapsed);
            g.phase = 'OVER';
            setGamePhase('OVER');
            if (g.score > g.highScore) { g.highScore = g.score; setDisplayHighScore(g.score); }
            // Sprint mode submission with elapsed time
            submitScore(g.score, 0, g.level, elapsed);
            return;
        }

        spawnPiece();
    }, [spawnPiece, submitScore]);

    // ─── Hold piece ───────────────────────────────────────────

    const holdPiece = useCallback(() => {
        const g = gRef.current;
        if (!g.piece || g.phase !== 'PLAYING' || g.holdUsed) return;

        const currentKey = g.piece.key;
        if (g.holdKey) {
            const newKey = g.holdKey;
            g.holdKey = currentKey;
            const shape = SHAPES[newKey];
            g.piece = { key: newKey, shape, x: Math.floor((COLS - shape[0].length) / 2), y: 0 };
        } else {
            g.holdKey = currentKey;
            g.piece = null;
            spawnPiece();
        }
        g.holdUsed = true;
        g.lockDelayActive = false;
        g.lockDelayResets = 0;
        setPreviewTick(t => t + 1);
    }, [spawnPiece]);

    // ─── Movement ─────────────────────────────────────────────

    const resetLockDelay = useCallback(() => {
        const g = gRef.current;
        if (g.lockDelayActive && g.lockDelayResets < LOCK_DELAY_MAX_RESETS) {
            g.lockDelayStart = performance.now();
            g.lockDelayResets++;
        }
    }, []);

    const moveLeft = useCallback(() => {
        const g = gRef.current;
        if (!g.piece || g.phase !== 'PLAYING' || g.clearingRows.length) return;
        if (!collides(g.board, g.piece.shape, g.piece.x - 1, g.piece.y)) {
            g.piece.x -= 1;
            resetLockDelay();
        }
    }, [resetLockDelay]);

    const moveRight = useCallback(() => {
        const g = gRef.current;
        if (!g.piece || g.phase !== 'PLAYING' || g.clearingRows.length) return;
        if (!collides(g.board, g.piece.shape, g.piece.x + 1, g.piece.y)) {
            g.piece.x += 1;
            resetLockDelay();
        }
    }, [resetLockDelay]);

    const moveDown = useCallback(() => {
        const g = gRef.current;
        if (!g.piece || g.phase !== 'PLAYING' || g.clearingRows.length) return;
        if (!collides(g.board, g.piece.shape, g.piece.x, g.piece.y + 1)) {
            g.piece.y += 1;
            // If piece can move down, cancel any active lock delay
            if (g.lockDelayActive) {
                g.lockDelayActive = false;
                g.lockDelayResets = 0;
            }
        } else {
            // Start lock delay instead of instant lock
            if (!g.lockDelayActive) {
                g.lockDelayActive = true;
                g.lockDelayStart = performance.now();
                g.lockDelayResets = 0;
            }
            // Don't lock yet — the game loop handles the delay timeout
        }
    }, []);

    const rotatePiece = useCallback(() => {
        const g = gRef.current;
        if (!g.piece || g.phase !== 'PLAYING' || g.clearingRows.length) return;
        if (g.piece.key === 'O') return;
        const rotated = rotateMatrix(g.piece.shape);
        for (const kick of [0, -1, 1, -2, 2]) {
            if (!collides(g.board, rotated, g.piece.x + kick, g.piece.y)) {
                g.piece.shape = rotated;
                g.piece.x += kick;
                resetLockDelay();
                return;
            }
        }
    }, [resetLockDelay]);

    const hardDrop = useCallback(() => {
        const g = gRef.current;
        if (!g.piece || g.phase !== 'PLAYING' || g.clearingRows.length) return;
        let dist = 0;
        while (!collides(g.board, g.piece.shape, g.piece.x, g.piece.y + dist + 1)) dist++;
        g.piece.y += dist;
        g.score += dist * 2;
        setDisplayScore(g.score);
        triggerShake(3, 6);
        lockPiece(); // Hard drop bypasses lock delay
    }, [lockPiece, triggerShake]);

    // ─── Drawing ──────────────────────────────────────────────

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const g = gRef.current;

        const styles = getComputedStyle(document.documentElement);
        const accentColor = styles.getPropertyValue('--accent-primary').trim() || '#3b82f6';
        const borderColor = styles.getPropertyValue('--border-color').trim() || 'rgba(255,255,255,0.08)';
        const bgCard = styles.getPropertyValue('--bg-card').trim() || 'rgba(30,30,30,0.8)';

        ctx.save();

        // Board shake
        if (g.shakeDuration > 0) {
            g.shakeX = (Math.random() - 0.5) * 2 * g.shakeAmplitude;
            g.shakeY = (Math.random() - 0.5) * 2 * g.shakeAmplitude;
            g.shakeDuration--;
            if (g.shakeDuration <= 0) { g.shakeX = 0; g.shakeY = 0; }
        }
        ctx.translate(g.shakeX, g.shakeY);

        // Background
        ctx.fillStyle = bgCard;
        ctx.fillRect(-10, -10, CANVAS_W + 20, CANVAS_H + 20); // slightly oversize to cover shake gaps

        // Grid lines
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 0.5;
        for (let r = 0; r <= ROWS; r++) {
            ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(CANVAS_W, r * CELL); ctx.stroke();
        }
        for (let c = 0; c <= COLS; c++) {
            ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, CANVAS_H); ctx.stroke();
        }

        // Locked cells
        for (let r = 0; r < ROWS; r++) {
            const isClearing = g.clearingRows.includes(r);
            for (let c = 0; c < COLS; c++) {
                const v = g.board[r][c];
                if (!v) continue;
                if (isClearing) {
                    const flashPhase = Math.floor(g.clearFlash / 4) % 2;
                    ctx.fillStyle = flashPhase === 0 ? '#ffffff' : getColor(v, accentColor);
                    const progress = Math.min(g.clearFlash / 20, 1);
                    const shrink = progress * (CELL / 2 - 1);
                    ctx.fillRect(c * CELL + 1 + shrink, r * CELL + 1 + shrink, CELL - 2 - shrink * 2, CELL - 2 - shrink * 2);
                } else {
                    ctx.fillStyle = getColor(v, accentColor);
                    ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
                    ctx.fillStyle = 'rgba(255,255,255,0.18)';
                    ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, 3);
                    ctx.fillRect(c * CELL + 1, r * CELL + 1, 3, CELL - 2);
                    ctx.fillStyle = 'rgba(0,0,0,0.2)';
                    ctx.fillRect(c * CELL + 1, r * CELL + CELL - 3, CELL - 2, 2);
                    ctx.fillRect(c * CELL + CELL - 3, r * CELL + 1, 2, CELL - 2);
                }
            }
        }

        // Clear flash overlay
        if (g.clearingRows.length > 0) {
            const progress = Math.min(g.clearFlash / 20, 1);
            ctx.globalAlpha = 0.3 * (1 - progress);
            ctx.fillStyle = '#fff';
            for (const row of g.clearingRows) ctx.fillRect(0, row * CELL, CANVAS_W, CELL);
            ctx.globalAlpha = 1.0;
        }

        // Ghost + Active piece
        if (g.piece) {
            let ghostY = g.piece.y;
            while (!collides(g.board, g.piece.shape, g.piece.x, ghostY + 1)) ghostY++;
            if (ghostY !== g.piece.y) {
                const gc = getColor(g.piece.key, accentColor);
                ctx.globalAlpha = 0.18;
                for (let r = 0; r < g.piece.shape.length; r++) {
                    for (let c = 0; c < g.piece.shape[r].length; c++) {
                        if (!g.piece.shape[r][c]) continue;
                        const bx = g.piece.x + c, by = ghostY + r;
                        if (by >= 0) {
                            ctx.fillStyle = gc;
                            ctx.fillRect(bx * CELL + 1, by * CELL + 1, CELL - 2, CELL - 2);
                            ctx.strokeStyle = gc; ctx.lineWidth = 1.5;
                            ctx.strokeRect(bx * CELL + 1.5, by * CELL + 1.5, CELL - 3, CELL - 3);
                        }
                    }
                }
                ctx.globalAlpha = 1.0;
            }

            // Active piece (flash if lock delay about to expire)
            const color = getColor(g.piece.key, accentColor);
            let pieceAlpha = 1.0;
            if (g.lockDelayActive) {
                const elapsed = performance.now() - g.lockDelayStart;
                const ratio = elapsed / LOCK_DELAY_MS;
                if (ratio > 0.6) pieceAlpha = 0.5 + 0.5 * Math.sin(ratio * 20); // blink when nearly locking
            }
            ctx.globalAlpha = pieceAlpha;
            for (let r = 0; r < g.piece.shape.length; r++) {
                for (let c = 0; c < g.piece.shape[r].length; c++) {
                    if (!g.piece.shape[r][c]) continue;
                    const bx = g.piece.x + c, by = g.piece.y + r;
                    if (by >= 0) {
                        ctx.fillStyle = color;
                        ctx.fillRect(bx * CELL + 1, by * CELL + 1, CELL - 2, CELL - 2);
                        ctx.fillStyle = 'rgba(255,255,255,0.22)';
                        ctx.fillRect(bx * CELL + 1, by * CELL + 1, CELL - 2, 3);
                        ctx.fillRect(bx * CELL + 1, by * CELL + 1, 3, CELL - 2);
                        ctx.fillStyle = 'rgba(0,0,0,0.22)';
                        ctx.fillRect(bx * CELL + 1, by * CELL + CELL - 3, CELL - 2, 2);
                        ctx.fillRect(bx * CELL + CELL - 3, by * CELL + 1, 2, CELL - 2);
                    }
                }
            }
            ctx.globalAlpha = 1.0;
        }

        // ─── Particles ────────────────────────────────────────
        for (const p of g.particles) {
            ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
        ctx.globalAlpha = 1.0;

        ctx.restore();
    }, []);

    // ─── Draw mini preview ────────────────────────────────────

    const drawPreview = useCallback((canvasEl, pieceKey) => {
        if (!canvasEl) return;
        const ctx = canvasEl.getContext('2d');
        const w = canvasEl.width, h = canvasEl.height;
        ctx.clearRect(0, 0, w, h);
        if (!pieceKey) return;

        const styles = getComputedStyle(document.documentElement);
        const accentColor = styles.getPropertyValue('--accent-primary').trim() || '#3b82f6';
        const shape = SHAPES[pieceKey];
        const color = getColor(pieceKey, accentColor);
        // Derive cell size from canvas width (canvas = cellSize * 4 + 4)
        const cellSize = Math.floor((w - 4) / 4);
        const shapeW = shape[0].length * cellSize;
        const shapeH = shape.length * cellSize;
        const offX = (w - shapeW) / 2, offY = (h - shapeH) / 2;

        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (!shape[r][c]) continue;
                ctx.fillStyle = color;
                ctx.fillRect(offX + c * cellSize + 1, offY + r * cellSize + 1, cellSize - 2, cellSize - 2);
                ctx.fillStyle = 'rgba(255,255,255,0.15)';
                ctx.fillRect(offX + c * cellSize + 1, offY + r * cellSize + 1, cellSize - 2, 2);
            }
        }
    }, []);

    const holdCanvasRef = useRef(null);
    const nextCanvasRefs = useRef([]);

    useEffect(() => {
        const g = gRef.current;
        drawPreview(holdCanvasRef.current, g.holdKey);
        for (let i = 0; i < NEXT_QUEUE_SIZE; i++) {
            drawPreview(nextCanvasRefs.current[i], g.nextQueue[i] || null);
        }
    }, [previewTick, drawPreview, gamePhase]);

    // ─── Game loop ────────────────────────────────────────────

    useEffect(() => {
        const g = gRef.current;

        const loop = (timestamp) => {
            if (g.phase !== 'PLAYING') { draw(); return; }

            // Update particles
            for (let i = g.particles.length - 1; i >= 0; i--) {
                const p = g.particles[i];
                p.x += p.vx; p.y += p.vy;
                p.vy += 0.12; // gravity
                p.vx *= 0.98; // friction
                p.life--;
                if (p.life <= 0) g.particles.splice(i, 1);
            }

            // Line clear animation
            if (g.clearingRows.length > 0) {
                g.clearFlash++;
                if (g.clearFlash >= 24) finalizeClear();
                draw();
                g.animId = requestAnimationFrame(loop);
                return;
            }

            // Lock delay check
            if (g.lockDelayActive && g.piece) {
                const elapsed = performance.now() - g.lockDelayStart;
                if (elapsed >= LOCK_DELAY_MS) {
                    lockPiece();
                    draw();
                    g.animId = requestAnimationFrame(loop);
                    return;
                }
                // Check if piece can now move down (floor disappeared due to clear)
                if (!collides(g.board, g.piece.shape, g.piece.x, g.piece.y + 1)) {
                    g.lockDelayActive = false;
                    g.lockDelayResets = 0;
                }
            }

            // Auto drop (chill mode = 4x slower, soft drop = 12x faster; both can coexist)
            let baseInterval = chillModeRef.current ? g.dropInterval * 4 : g.dropInterval;
            const dropSpeed = g.softDrop ? Math.max(40, baseInterval / 12) : baseInterval;
            if (!g.lockDelayActive && timestamp - g.lastDrop >= dropSpeed) {
                moveDown();
                g.lastDrop = timestamp;
            }

            // Sprint timer update
            if (g.mode === 'sprint' && g.sprintStartTime > 0) {
                setSprintTime(performance.now() - g.sprintStartTime);
            }

            draw();
            g.animId = requestAnimationFrame(loop);
        };

        if (gamePhase === 'PLAYING') {
            g.lastDrop = performance.now();
            g.animId = requestAnimationFrame(loop);
        } else {
            draw();
        }

        return () => {
            if (g.animId) { cancelAnimationFrame(g.animId); g.animId = null; }
        };
    }, [gamePhase, draw, moveDown, finalizeClear, lockPiece]);

    // ─── Keyboard ─────────────────────────────────────────────

    useEffect(() => {
        const g = gRef.current;
        const handleKeyDown = (e) => {
            if (g.phase !== 'PLAYING') return;
            const key = e.key;
            if (key === 'ArrowLeft' || key === 'a' || key === 'A') { e.preventDefault(); moveLeft(); return; }
            if (key === 'ArrowRight' || key === 'd' || key === 'D') { e.preventDefault(); moveRight(); return; }
            if (key === 'ArrowDown' || key === 's' || key === 'S') {
                e.preventDefault();
                if (speedModeRef.current) hardDrop(); else g.softDrop = true;
                return;
            }
            if (key === 'ArrowUp' || key === 'w' || key === 'W') { e.preventDefault(); rotatePiece(); return; }
            if (key === ' ') { e.preventDefault(); hardDrop(); return; }
            if (key === 'c' || key === 'C' || key === 'Shift' || key === '/' || (key === 'Control' && e.code === 'ControlRight')) {
                e.preventDefault(); holdPiece(); return;
            }
        };
        const handleKeyUp = (e) => {
            if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') gRef.current.softDrop = false;
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
    }, [moveLeft, moveRight, rotatePiece, hardDrop, holdPiece]);

    // ─── Start / Pause / End ──────────────────────────────────

    const startGame = useCallback((mode = 'endless') => {
        const g = gRef.current;
        g.board = createEmptyBoard();
        g.score = 0; g.lines = 0; g.level = 1;
        g.dropInterval = 1000; g.lastDrop = 0;
        g.piece = null; g.nextQueue = []; g.holdKey = null;
        g.holdUsed = false; g.softDrop = false;
        g.bag = []; g.clearingRows = []; g.clearFlash = 0;
        g.lockDelayActive = false; g.lockDelayResets = 0;
        g.shakeX = 0; g.shakeY = 0; g.shakeDuration = 0;
        g.particles = [];
        g.mode = mode;
        g.sprintStartTime = mode === 'sprint' ? performance.now() : 0;
        g.phase = 'PLAYING';

        setDisplayScore(0); setDisplayLines(0); setDisplayLevel(1);
        setGameMode(mode);
        setSprintTime(0);
        setGamePhase('PLAYING');
        fillQueue();
        spawnPiece();
        containerRef.current?.focus();
    }, [spawnPiece, fillQueue]);

    const togglePause = useCallback(() => {
        const g = gRef.current;
        if (g.phase === 'PLAYING') { g.phase = 'PAUSED'; setGamePhase('PAUSED'); }
        else if (g.phase === 'PAUSED') { g.phase = 'PLAYING'; setGamePhase('PLAYING'); }
    }, []);

    const endGame = useCallback(() => {
        const g = gRef.current;
        if (g.phase !== 'PLAYING' && g.phase !== 'PAUSED') return;
        if (g.mode === 'sprint') setSprintTime(performance.now() - g.sprintStartTime);
        g.phase = 'OVER'; setGamePhase('OVER');
        if (g.score > g.highScore) { g.highScore = g.score; setDisplayHighScore(g.score); }
        submitScore(g.score, g.lines);
    }, [submitScore]);

    // ─── Render ───────────────────────────────────────────────

    const isIdle = gamePhase === 'IDLE';
    const isOver = gamePhase === 'OVER';
    const isPaused = gamePhase === 'PAUSED';
    const isPlaying = gamePhase === 'PLAYING';
    const isSprint = gameMode === 'sprint';

    const previewBoxStyle = {
        background: 'rgba(0,0,0,0.15)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px',
    };

    const linesInLevel = displayLines % 10;
    const levelProgress = linesInLevel / 10;

    const [showControls, setShowControls] = useState(false);

    return (
        <div ref={containerRef}
            style={{ 
                width: '100%', 
                margin: '0 auto', 
                display: 'flex', 
                flexDirection: 'column', 
                height: '100%', 
                outline: 'none',
                position: 'relative',
                overflow: 'hidden' // Kill any scrollbars from scaling
            }}
            tabIndex="0"
        >
            {/* Header stays static */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button className="btn-ghost" onClick={() => navigate(-1)} style={{ padding: '8px' }}>
                    <ArrowLeft size={20} />
                </button>
                <h1 style={{ margin: 0, fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Gamepad2 color="var(--accent-primary)" size={28} />
                    Tetris
                </h1>
                <div style={{ marginLeft: '8px', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-card)', padding: '6px 12px', borderRadius: '50px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                    <Trophy size={14} color="var(--accent-primary)" />
                    Best: <strong style={{ color: 'var(--accent-primary)' }}>{displayHighScore}</strong>
                </div>
            </div>

            {/* Content area that handles the scale */}
            <div style={{ 
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%',
                overflow: 'hidden'
            }}>
                <div style={{ 
                    display: 'flex', 
                    gap: '12px', 
                    justifyContent: 'center', 
                    alignItems: 'flex-start',
                    transform: `scale(${gameScale})`,
                    transformOrigin: 'top center',
                    transition: 'transform 0.2s ease-out',
                    // This height fix is necessary for document flow
                    height: `${700 * gameScale}px`,
                    width: '100%',
                    minWidth: 0
                }}>
                {/* ── LEFT COLUMN: Hold + Actions + Toggles ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100px', flexShrink: 0 }}>
                    {/* Hold */}
                    <div className="glass-card" style={{ padding: '8px' }}>
                        <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px', textAlign: 'center' }}>Hold</div>
                        <div style={previewBoxStyle}>
                            <canvas ref={holdCanvasRef} width={PREVIEW_CELL * 4 + 4} height={PREVIEW_CELL * 4 + 4} style={{ display: 'block' }} />
                        </div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '3px' }}>
                            <code style={{ background: 'rgba(255,255,255,0.06)', padding: '0px 4px', borderRadius: '3px', border: '1px solid var(--border-color)', fontSize: '0.6rem' }}>C</code>
                        </div>
                    </div>

                    {/* Play / Pause / End */}
                    <div className="glass-card" style={{ padding: '6px', display: 'flex', gap: '4px' }}>
                        <button className="btn-ghost" style={{ flex: 1, justifyContent: 'center', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }} onClick={togglePause} disabled={!isPlaying && !isPaused}>
                            {isPaused ? <Play size={15} /> : <Pause size={15} />}
                        </button>
                        <button className="btn-ghost" style={{ flex: 1, justifyContent: 'center', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', color: '#ef4444' }} onClick={endGame} disabled={!isPlaying && !isPaused}>
                            <RotateCcw size={15} />
                        </button>
                    </div>

                    {/* Speed + Chill Toggles */}
                    <div className="glass-card" style={{ padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none', padding: '3px 2px' }} onClick={() => setSpeedMode(v => !v)}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Zap size={12} color={speedMode ? '#f59e0b' : 'var(--text-muted)'} fill={speedMode ? '#f59e0b' : 'none'} />
                                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: speedMode ? 'var(--text-main)' : 'var(--text-muted)' }}>Speed</span>
                            </div>
                            <div style={{ width: '28px', height: '14px', borderRadius: '7px', background: speedMode ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'background 0.2s', border: '1px solid var(--border-color)' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: speedMode ? '17px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none', padding: '3px 2px' }} onClick={() => setChillMode(v => !v)}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Coffee size={12} color={chillMode ? '#22c55e' : 'var(--text-muted)'} />
                                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: chillMode ? 'var(--text-main)' : 'var(--text-muted)' }}>Chill</span>
                            </div>
                            <div style={{ width: '28px', height: '14px', borderRadius: '7px', background: chillMode ? '#22c55e' : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'background 0.2s', border: '1px solid var(--border-color)' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: chillMode ? '17px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />
                            </div>
                        </div>
                    </div>

                    {/* Controls (collapsible) */}
                    <div className="glass-card" style={{ padding: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '2px' }} onClick={() => setShowControls(v => !v)}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-main)' }}>Controls</span>
                            <span style={{ fontSize: '0.65rem', transform: showControls ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▾</span>
                        </div>
                        {showControls && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                                {[['A/←', 'Left'], ['D/→', 'Right'], ['W/↑', 'Rotate'], ['S/↓', speedMode ? 'Hard' : 'Soft'], ['Spc', 'Drop'], ['C', 'Hold']].map(([key, action]) => (
                                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <code style={{ background: 'rgba(255,255,255,0.06)', padding: '0px 3px', borderRadius: '2px', fontSize: '0.58rem', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>{key}</code>
                                        <span style={{ fontSize: '0.62rem' }}>{action}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── CENTER: Board ── */}
                <div style={{
                    position: 'relative',
                    background: 'var(--bg-card)',
                    border: '2px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '4px',
                    boxShadow: 'var(--shadow-card)',
                    lineHeight: 0,
                    overflow: 'hidden',
                    flexShrink: 0,
                }}>
                    <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H}
                        style={{ borderRadius: 'var(--radius-sm)', display: 'block' }} />

                    {isIdle && (
                        <div style={{ position: 'absolute', inset: '4px', background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: 'var(--radius-sm)', gap: '16px' }}>
                            <h2 style={{ background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: '3rem', margin: 0, fontWeight: 900 }}>TETRIS</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '200px' }}>
                                <button className="btn-primary" onClick={() => startGame('endless')} style={{ fontSize: '1rem', padding: '14px', borderRadius: '50px', width: '100%' }}>
                                    <Play size={20} /> Endless
                                </button>
                                <button className="btn-primary" onClick={() => startGame('sprint')} style={{ fontSize: '1rem', padding: '14px', borderRadius: '50px', width: '100%', background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
                                    <Timer size={20} /> Sprint (40L)
                                </button>
                            </div>
                        </div>
                    )}

                    {isOver && (
                        <div style={{ position: 'absolute', inset: '4px', background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: 'var(--radius-sm)', padding: '24px' }}>
                            <h2 style={{ background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: '2.2rem', margin: '0 0 16px 0', fontWeight: 900, lineHeight: 1.1 }}>
                                {isSprint && displayLines >= SPRINT_TARGET ? '40 LINES!' : 'GAME OVER'}
                            </h2>
                            {isSprint && displayLines >= SPRINT_TARGET && (
                                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b', fontFamily: 'monospace', marginBottom: '12px', lineHeight: 1 }}>
                                    {formatSprintTime(sprintTime)}
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: '24px', marginBottom: '20px', textAlign: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                                <div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Score</div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-primary)', lineHeight: 1 }}>{displayScore}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Lines</div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1 }}>{displayLines}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Level</div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1 }}>{displayLevel}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '200px' }}>
                                <button className="btn-primary" onClick={() => startGame(gameMode)} style={{ fontSize: '1rem', padding: '12px', borderRadius: '50px', width: '100%' }}>
                                    <Play size={18} /> Play Again
                                </button>
                                <button className="btn-ghost" onClick={() => setGamePhase('IDLE')} style={{ fontSize: '0.85rem', padding: '10px', borderRadius: '50px', width: '100%', border: '1px solid var(--border-color)' }}>
                                    Change Mode
                                </button>
                            </div>
                        </div>
                    )}

                    {isPaused && (
                        <div style={{ position: 'absolute', inset: '4px', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: 'var(--radius-sm)' }}>
                            <h2 style={{ color: 'var(--text-main)', fontSize: '2.5rem', margin: '0 0 24px 0' }}>PAUSED</h2>
                            <button className="btn-primary" onClick={togglePause} style={{ fontSize: '1.1rem', padding: '14px 36px', borderRadius: '50px' }}>
                                <Play size={20} /> Resume
                            </button>
                        </div>
                    )}
                </div>

                {/* ── RIGHT COLUMN: Next Queue + Stats ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '150px', flexShrink: 0 }}>
                    {/* Next Queue */}
                    <div className="glass-card" style={{ padding: '8px' }}>
                        <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px', textAlign: 'center' }}>Next</div>
                        <div style={{ ...previewBoxStyle, marginBottom: '4px' }}>
                            <canvas ref={el => nextCanvasRefs.current[0] = el} width={PREVIEW_CELL * 4 + 4} height={PREVIEW_CELL * 4 + 4} style={{ display: 'block' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px' }}>
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} style={{ ...previewBoxStyle, opacity: 0.5, padding: '2px' }}>
                                    <canvas ref={el => nextCanvasRefs.current[i] = el} width={PREVIEW_CELL_SM * 4 + 4} height={PREVIEW_CELL_SM * 4 + 4} style={{ display: 'block' }} />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="glass-card" style={{ padding: '8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', textAlign: 'right' }}>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Score</div>
                                <div style={{ color: 'var(--accent-primary)', fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.1 }}>{displayScore.toLocaleString()}</div>
                            </div>
                            <div style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', textAlign: 'right' }}>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Lines</div>
                                <div style={{ color: 'var(--text-main)', fontSize: '1rem', fontWeight: 700, lineHeight: 1.1 }}>{displayLines}{isSprint ? <span style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>/{SPRINT_TARGET}</span> : ''}</div>
                            </div>
                            <div style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', textAlign: 'right' }}>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Level</div>
                                <div style={{ color: 'var(--text-main)', fontSize: '1rem', fontWeight: 700, lineHeight: 1.1 }}>{displayLevel}</div>
                                <div style={{ height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', marginTop: '6px' }}>
                                    <div style={{ height: '100%', width: `${levelProgress * 100}%`, background: 'var(--accent-primary)', transition: 'width 0.3s' }} />
                                </div>
                                <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: '3px' }}>{linesInLevel}/10</div>
                            </div>
                            
                            {isSprint && (isPlaying || isPaused || isOver) && (
                                <div style={{ padding: '4px 6px', background: 'rgba(245,158,11,0.06)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(245,158,11,0.2)', textAlign: 'right', marginTop: '4px' }}>
                                    <div style={{ color: '#f59e0b', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}><Timer size={11} /> Time</div>
                                    <div style={{ color: '#f59e0b', fontSize: '0.9rem', fontWeight: 700, fontFamily: 'monospace', lineHeight: 1 }}>{formatSprintTime(sprintTime)}</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
);
};

export default Tetris;
