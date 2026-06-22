# ── Stage 1: Build frontend ──────────────────────────────────
FROM node:24.17.0-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY scripts/require-node-24.js scripts/
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Production image ────────────────────────────────
FROM node:24.17.0-alpine

WORKDIR /app

# Copy EVERYTHING from the build context (dockerignore handles exclusions)
COPY . .

# Install production deps only
RUN npm ci --omit=dev

# Copy the built frontend from stage 1
COPY --from=builder /app/dist ./dist

# The SQLite DB will be stored in /app/data so we can mount it
RUN mkdir -p /app/data
ENV DB_PATH=/app/data/timer.db

EXPOSE 3001

CMD ["node", "server.js"]
