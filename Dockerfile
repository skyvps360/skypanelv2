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
RUN npm run build

FROM node:22-slim AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY tsconfig.json ./tsconfig.json
COPY vite.config.ts ./vite.config.ts
COPY tailwind.config.js ./tailwind.config.js
COPY postcss.config.js ./postcss.config.js
COPY eslint.config.js ./eslint.config.js
COPY ecosystem.config.cjs ./ecosystem.config.cjs
COPY components.json ./components.json
COPY --from=build /app/dist ./dist
COPY api ./api
COPY scripts ./scripts
COPY migrations ./migrations

EXPOSE 3001
RUN chown -R node:node /app
USER node

CMD ["node", "--import", "tsx", "api/server.ts"]
