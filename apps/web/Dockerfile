FROM node:22-alpine AS base

WORKDIR /app


FROM base AS deps

COPY package.json package-lock.json ./

RUN npm ci


FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules

COPY . .

#
# Variables necesarias únicamente para que
# Next.js pueda importar módulos del servidor
# durante `next build`.
#
# Son valores ficticios de compilación.
# Las credenciales reales se inyectan
# posteriormente en runtime mediante
# docker-compose.
#
ENV POSTGRES_HOST=postgres
ENV POSTGRES_PORT=5432
ENV POSTGRES_DB=finora
ENV POSTGRES_USER=finora
ENV POSTGRES_PASSWORD=build-only-placeholder

ENV OPENAI_API_KEY=sk-build-only-placeholder

ENV MINIO_ENDPOINT=http://minio:9000
ENV MINIO_ACCESS_KEY=build-only-placeholder
ENV MINIO_SECRET_KEY=build-only-placeholder

ENV N8N_DOCUMENT_PROCESSING_WEBHOOK_URL=http://host.docker.internal:5678/webhook/build-placeholder

RUN npm run build


FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup \
  --system \
  --gid 1001 \
  nodejs

RUN adduser \
  --system \
  --uid 1001 \
  nextjs

COPY --from=builder \
  /app/public \
  ./public

COPY --from=builder \
  --chown=nextjs:nodejs \
  /app/.next/standalone \
  ./

COPY --from=builder \
  --chown=nextjs:nodejs \
  /app/.next/static \
  ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]