# syntax=docker/dockerfile:1.7

FROM node:22-slim AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM deps AS build
COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
# Build both frontend (Vite) and backend (TypeScript compilation)
RUN npm run build

FROM node:22-slim AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built frontend (from Vite build)
COPY --from=build /app/dist ./dist

# Copy compiled backend (TypeScript -> JavaScript in api/)
COPY --from=build /app/api ./api

# Copy src/ directory (needed by backend for theme presets)
COPY --from=build /app/src ./src

# Copy migration scripts and SQL files
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/migrations ./migrations

# Copy necessary config files for runtime
COPY tsconfig.json ./
COPY ecosystem.config.cjs ./

# Create entrypoint script for migrations + server startup
RUN echo '#!/bin/sh\n\
set -e\n\
echo "🔄 Running database migrations..."\n\
# Ensure we use environment variables from docker-compose, not .env file\n\
export NODE_ENV="${NODE_ENV:-production}"\n\
node scripts/run-migration.js || echo "⚠️ Migrations failed or already applied"\n\
echo "🚀 Starting application server..."\n\
exec node --import tsx api/server.ts\n\
' > /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

EXPOSE 3001
RUN chown -R node:node /app
USER node

ENTRYPOINT ["/app/docker-entrypoint.sh"]
