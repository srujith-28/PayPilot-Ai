# Multi-stage Dockerfile for PayPilot AI

# Stage 1: Build the client assets
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application source code
COPY . .

# Build the client distribution (Vite)
RUN npm run build

# Stage 2: Production runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built frontend assets and server files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src/server ./src/server
COPY --from=builder /app/src/data ./src/data
COPY --from=builder /app/src/utils ./src/utils
COPY --from=builder /app/src/types ./src/types
COPY --from=builder /app/metadata.json ./metadata.json

# Copy tsx and dependencies needed to run TypeScript server
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start production server
CMD ["npm", "run", "start"]
