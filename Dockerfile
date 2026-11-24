FROM node:26.13.1-bookworm-slim AS dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --no-audit --no-fund && npm cache clean --force
FROM dependencies AS application
COPY --chown=node:node . .
ARG API_ORIGIN=http://api:3001
ENV API_ORIGIN=$API_ORIGIN
RUN npm run db:generate && npm run build && mkdir -p backend/uploads && chown -R node:node frontend/.next backend/uploads
ENV NODE_ENV=production
USER node
CMD ["node", "backend/dist/main.js"]
