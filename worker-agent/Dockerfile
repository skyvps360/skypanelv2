# SkyPanelV2 Worker Agent Dockerfile
FROM node:18-alpine

# Install required system packages
RUN apk add --no-cache \
    git \
    docker \
    docker-cli \
    tar \
    curl

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S worker -u 1001

# Create workspace directory with proper permissions
RUN mkdir -p /tmp/skypanel-builds && \
    chown -R worker:nodejs /tmp/skypanel-builds

# Copy built application
COPY --chown=worker:nodejs dist ./dist

# Switch to non-root user
USER worker

# Create logs directory
RUN mkdir -p logs

# Expose status port (optional)
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/status || exit 1

# Start the worker agent
CMD ["node", "dist/index.js"]