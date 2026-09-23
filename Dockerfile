# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,id=bagajpark-deps,target=/root/.npm npm ci --ignore-scripts --no-audit --no-fund

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma
COPY prisma.config.ts ./
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/placeholder?schema=public"
ENV RESEND_API_KEY=build_placeholder
ENV RESEND_WEBHOOK_SECRET=build_placeholder
ARG NEXT_PUBLIC_BETA_BADGE
ENV NEXT_PUBLIC_BETA_BADGE=${NEXT_PUBLIC_BETA_BADGE}
# NEXT_PUBLIC_* degerleri `next build` aninda pakete GOMULUR; compose ile
# calisma zamaninda vermek ise yaramaz (2026-09-23'e kadar Plausible, Crisp ve
# web push bu yuzden prod'da hic calismadi). Degerler CI'da GitHub repo
# degiskenlerinden gelir; `next-public-build-args` testi eksigi yakalar.
ARG NEXT_PUBLIC_PLAUSIBLE_DOMAIN
ENV NEXT_PUBLIC_PLAUSIBLE_DOMAIN=${NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
ARG NEXT_PUBLIC_CRISP_WEBSITE_ID
ENV NEXT_PUBLIC_CRISP_WEBSITE_ID=${NEXT_PUBLIC_CRISP_WEBSITE_ID}
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=${NEXT_PUBLIC_VAPID_PUBLIC_KEY}
RUN npx prisma generate
COPY . .
RUN --mount=type=cache,target=/app/.next/cache npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
# NOT: standalone'in kendi budanmış node_modules'ının üzerine builder'ın TAM node_modules'ı
# kopyalanıyor — `prisma` CLI + `dotenv` (devDependencies, standalone tracer bunları
# içermiyordu) olmadan `prisma migrate deploy` container içinde "datasource.url property
# is required in your Prisma config file" hatasıyla SESSİZCE başarısız oluyordu
# (entrypoint'teki `|| echo WARNING` bunu yutuyordu — hem Hetzner hem AWS'de tespit edildi,
# 2026-08-21). Imaj büyüyor ama migration'ların gerçekten çalışması bundan daha önemli.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/docker-entrypoint.sh"]
