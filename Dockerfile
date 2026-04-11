# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm install --ignore-scripts

FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# build-time placeholders (runtime compose ile değiştirilir)
ENV IYZICO_API_KEY=build_placeholder
ENV IYZICO_SECRET_KEY=build_placeholder
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/placeholder?schema=public"
ENV RESEND_API_KEY=build_placeholder
ENV RESEND_WEBHOOK_SECRET=build_placeholder
# next build (production) — requireProdSecrets + iyzipay modülü için placeholder (runtime compose ile değiştirilir)
RUN npx prisma generate
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# HOSTNAME=0.0.0.0 kullanmayın: bazı ortamlarda istek URL’si 0.0.0.0:3000 olarak üretilip
# Auth callbackUrl’e karışabiliyor. Standalone varsayılanı tüm arayüzlere dinlemeye yeter.
# prisma.config.ts + global `prisma` CLI modül çözümlemesi
ENV NODE_PATH=/usr/local/lib/node_modules
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs
RUN mkdir -p /home/nextjs && chown nextjs:nodejs /home/nextjs
ENV HOME=/home/nextjs
RUN npm install -g prisma@7.7.0 && npm cache clean --force

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/node_modules/dotenv ./node_modules/dotenv
# Next standalone bazen @swc/helpers izini düşürür (reactCompiler); runtime için gerekli
COPY --from=builder /app/node_modules/@swc ./node_modules/@swc
# next.config serverExternalPackages: Next trace tam ağacı kopyalamaz; iyzipay ctor fs.readdirSync(lib/resources) kullanır
COPY --from=builder /app/node_modules/iyzipay ./node_modules/iyzipay
COPY --from=builder /app/node_modules/@netgsm ./node_modules/@netgsm
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
ENTRYPOINT ["/docker-entrypoint.sh"]
