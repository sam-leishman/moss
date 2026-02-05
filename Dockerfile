# Build stage
FROM node:20-alpine AS builder

# Metadata
LABEL org.opencontainers.image.title="Moss"
LABEL org.opencontainers.image.description="Media organization and streaming service"
LABEL org.opencontainers.image.version="0.0.1"
LABEL org.opencontainers.image.vendor="Moss"

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the app
RUN pnpm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install su-exec for stepping down from root
RUN apk add --no-cache su-exec

# Create default moss user and required directories
RUN addgroup -g 1000 moss 2>/dev/null || addgroup moss && \
    adduser -D -u 1000 -G moss moss 2>/dev/null || adduser -D -G moss moss && \
    mkdir -p /config /metadata /media && \
    chown -R moss:moss /app /config /metadata /media

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built app from builder
COPY --from=builder /app/build ./build

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port
EXPOSE 3000

# Declare volumes for persistent data
VOLUME ["/config", "/metadata"]

# Set environment variables
ENV NODE_ENV=production
ENV PUID=1000
ENV PGID=1000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Entrypoint handles UID/GID mapping and drops privileges
ENTRYPOINT ["/docker-entrypoint.sh"]
