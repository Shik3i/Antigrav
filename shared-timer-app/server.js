require('dotenv').config();

// ── Global BigInt safety patch ──────────────────────────────────────────────
// SQLite3 can return JavaScript BigInt for INTEGER columns in newer versions.
// JSON.stringify throws on BigInt by default, which crashes socket.io emits.
// This patch converts any BigInt to a regular Number before serialization.
const _origStringify = JSON.stringify;
JSON.stringify = function (value, replacer, space) {
    const safeReplacer = (key, val) => {
        if (typeof val === 'bigint') return Number(val);
        return typeof replacer === 'function' ? replacer(key, val) : val;
    };
    const combined = replacer && Array.isArray(replacer) ? replacer : safeReplacer;
    return _origStringify(value, combined, space);
};
// ────────────────────────────────────────────────────────────────────────────
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const dbLayer = require('./database');

// ── Global Error Logging to DB ──────────────────────────────────────────────
const originalConsoleError = console.error;
console.error = function(...args) {
    if (dbLayer && dbLayer.logError) {
        // Extract string message
        const msg = args.map(a => (typeof a === 'object' && a instanceof Error) ? a.message : (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ');
        // Find Error object for stack trace
        const errObj = args.find(a => typeof a === 'object' && a instanceof Error);
        const stack = errObj ? errObj.stack : undefined;
        // Don't log this failure to dbLayer to avoid infinite loops
        dbLayer.logError(msg, stack, 'console.error').catch(e => originalConsoleError('[DB Log Failed]', e.message));
    }
    originalConsoleError.apply(console, args);
};

process.on('uncaughtException', (err) => {
    originalConsoleError('FATAL UNCAUGHT EXCEPTION:', err);
    if (dbLayer && dbLayer.logError) {
        dbLayer.logError('FATAL UNCAUGHT EXCEPTION: ' + err.message, err.stack, 'process.on').finally(() => {
            process.exit(1);
        });
    } else {
        process.exit(1);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    originalConsoleError('FATAL UNHANDLED REJECTION:', reason);
    if (dbLayer && dbLayer.logError) {
        const msg = reason instanceof Error ? reason.message : JSON.stringify(reason);
        const stack = reason instanceof Error ? reason.stack : undefined;
        dbLayer.logError('FATAL UNHANDLED REJECTION: ' + msg, stack, 'process.on');
    }
});
// ────────────────────────────────────────────────────────────────────────────

const roomManager = require('./roomManager');
const apiRoutes = require('./routes/api');
const apiController = require('./controllers/apiController');
const setupSocketHandlers = require('./sockets/socketHandler');
const { startCron } = require('./cron/betResolver');

const app = express();
app.use(cors());
app.use(express.json());

// Trust proxy so the rate limiter sees the real client IP (X-Forwarded-For) instead of Unraid's internal IP
app.set('trust proxy', 1);

// Security Header to suppress 'browsing-topics' warning and improve safety
app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'browsing-topics=()');
    next();
});

// DDoS Protection: Limit requests from same IP
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per window (each page load uses ~10 calls)
    message: { error: 'Too many requests from this IP, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiter to all /api routes
app.use('/api', apiLimiter);

// Serve static compiled frontend files
app.use(express.static(path.join(__dirname, 'dist')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all for home server
        methods: ["GET", "POST"]
    }
});

// Make io accessible in controllers
app.set('io', io);

// REST API Routes
app.use('/api', apiRoutes);

// WebSocket Events
setupSocketHandlers(io);

// Global Error Handler
app.use((err, req, res, next) => {
    const errorMsg = err.message || err;
    console.error('Server Error:', errorMsg);

    // Log to Database
    dbLayer.logError(
        errorMsg.toString(),
        err.stack,
        `Path: ${req.path}, Method: ${req.method}, User: ${req.user?.userId || 'Guest'}`
    ).catch(e => console.error('Failed to log error to DB:', e));

    res.status(500).json({ error: 'Internal Server Error' });
});

// Create a default public room on startup used to be here, removed to prevent unwanted "general" rooms

// Catch-all route to serve the React app for any other URL (client-side routing)
app.get('*catchall', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    apiController.initializeEsportsDb();
    startCron();
});
