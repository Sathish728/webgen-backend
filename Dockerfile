# webgen-backend/Dockerfile

FROM node:18-alpine AS base


RUN apk add --no-cache libc6-compat curl

WORKDIR /app


FROM base AS dependencies


COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
FROM base AS build

COPY package*.json ./
RUN npm ci


COPY . .






FROM node:18-alpine AS production


WORKDIR /app


RUN apk add --no-cache curl


RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001


COPY --from=dependencies --chown=nodejs:nodejs /app/node_modules ./node_modules


COPY --chown=nodejs:nodejs . .


USER nodejs


EXPOSE 4000


HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# ✨ FIXED: Use your actual entry point (check your package.json "main" or "start" script)
CMD ["node", "src/server.js"]