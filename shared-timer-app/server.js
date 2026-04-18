require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const rateLimit = require('express-rate-limit');

const dbLayer = require('./database');
const { safeStringify } = require('./utils/safeSerialization');

// ── Global Error Logging to DB ──────────────────────────────────────────────
const originalConsoleError = console.error;
console.error = function(...args) {
    if (dbLayer && dbLayer.logError) {
        // Extract string message (Safe JSON.stringify for circular objects)
        const msg = args.map(a => {
            if (typeof a === 'object' && a instanceof Error) return a.message;
            if (typeof a === 'object' && a !== null) {
                try { return safeStringify(a); }
                catch (e) { return '[Unserializable Object]'; }
            }
            return a;
        }).join(' ');
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
        const msg = reason instanceof Error ? reason.message : safeStringify(reason);
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
const { startLottoCron } = require('./cron/lottoDrawCron');

const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ limit: '200kb', extended: true }));

// Trust proxy so the rate limiter sees the real client IP (X-Forwarded-For) instead of Unraid's internal IP
app.set('trust proxy', 1);

// Security Header to suppress 'browsing-topics' warning and improve safety
app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'browsing-topics=()');
    next();
});

app.use('/api', (req, res, next) => {
    if (req.method !== 'GET') {
        return next();
    }

    if (req.path === '/pokemon') {
        res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    } else if (req.path === '/pokemon/configs' || req.path === '/navbar-settings' || req.path === '/changelog') {
        res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
    } else if (req.path === '/news') {
        res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=900');
    }

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
app.use(express.static(path.join(__dirname, 'dist'), {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
        // Assets are hashed, so they can be cached forever
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        // index.html should NEVER be cached to ensure users always get the latest build references
        if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

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
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    dbLayer.logSystemEvent('info', 'System', `Server listening on port ${PORT}`);
    apiController.initializeEsportsDb();
    startCron();
    startLottoCron(io);
});
