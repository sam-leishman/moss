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

# Install runtime and build dependencies for thumbnail generation
# - ffmpeg: video frame extraction
# - vips-dev: image processing library for sharp
# - python3, make, g++: required for sharp compilation
RUN apk add --no-cache ffmpeg vips-dev python3 make g++

# Create required directories
RUN mkdir -p /config /metadata /media

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install production dependencies only
# Use pre-built binaries for sharp to avoid compilation issues
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1
ENV npm_config_sharp_libvips_binary_host=https://github.com/lovell/sharp-libvips/releases
RUN pnpm install --prod --frozen-lockfile

# Copy built app from builder
COPY --from=builder /app/build ./build

# Expose port
EXPOSE 3000

# Declare volumes for persistent data
VOLUME ["/config", "/metadata"]

# Set environment variables
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

CMD ["node", "build"]
