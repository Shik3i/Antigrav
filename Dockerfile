# ── Stage 1: Build frontend ──────────────────────────────────
FROM node:24.17.0-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps --ignore-scripts

COPY . .
RUN npm run build

# ── Stage 2: Production image ────────────────────────────────
FROM node:24.17.0-alpine

WORKDIR /app

# Copy package files and install production deps only
COPY package.json package-lock.json* ./
# Skip preinstall script for production build
RUN npm ci --omit=dev --legacy-peer-deps --ignore-scripts \
    && npm cache clean --force

# Copy the built frontend from stage 1
COPY --from=builder /app/dist ./dist

# Copy server files
COPY server.js ./
COPY roomManager.js ./
COPY sanitize.js ./
COPY jwtSecret.js ./
COPY detect_react_error.js ./
COPY socketEvents.json ./
COPY database/ ./database/
COPY routes/ ./routes/
COPY controllers/ ./controllers/
COPY services/ ./services/
COPY sockets/ ./sockets/
COPY config/ ./config/
COPY utils/ ./utils/
COPY cron/ ./cron/
COPY public/ ./public/
COPY assets_static/ ./assets_static/

# The SQLite DB will be stored in /app/data so we can mount it
RUN mkdir -p /app/data
ENV DB_PATH=/app/data/timer.db

EXPOSE 3001

CMD ["node", "server.js"]
