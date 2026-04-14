FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY packages/ ./packages/
RUN npm ci
COPY prisma/ ./prisma/
COPY prisma.config.ts ./
RUN npx prisma generate
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
COPY packages/ ./packages/
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/generated ./src/generated
COPY src/database/migrations ./dist/database/migrations

ENV NODE_ENV=production
EXPOSE 3001

# Default: API server. Override with ["node", "dist/worker.js"] for worker.
CMD ["node", "dist/index.js"]
