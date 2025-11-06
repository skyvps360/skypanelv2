# syntax=docker/dockerfile:1.7

ARG VITE_API_URL=/api
ARG VITE_COMPANY_NAME=SkyPanelV2

FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_COMPANY_NAME=${VITE_COMPANY_NAME}

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV PORT=3001

# Copy production dependencies and compiled assets
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY api ./api
COPY package*.json ./

EXPOSE 3001
CMD ["node", "--import", "tsx", "api/server.ts"]
