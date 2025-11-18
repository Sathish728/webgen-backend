# webgen-backend/Dockerfile
# ✨ Multi-stage build for smaller image
FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache libc6-compat curl

WORKDIR /app

# ============= Dependencies Stage =============
FROM base AS dependencies

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# ============= Build Stage =============
FROM base AS build

COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Add any build steps here (e.g., TypeScript compilation)
# RUN npm run build

# ============= Production Stage =============
FROM node:18-alpine AS production

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy dependencies from dependencies stage
COPY --from=dependencies --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start application
CMD ["node", "server.js"]