.PHONY: help dev build test lint typecheck migrate seed logs deploy status clean backup reconcile

# Varsayılan hedef
help:
	@echo ""
	@echo "  BagajPark Geliştirici Komutları"
	@echo "  ================================"
	@echo ""
	@echo "  Geliştirme"
	@echo "    make dev           — Next.js dev server başlat"
	@echo "    make build         — Production build"
	@echo "    make lint          — ESLint çalıştır"
	@echo "    make typecheck     — TypeScript type kontrol"
	@echo ""
	@echo "  Veritabanı"
	@echo "    make migrate       — Prisma migration uygula"
	@echo "    make migrate-new   — Yeni migration oluştur (NAME=migration_adi)"
	@echo "    make studio        — Prisma Studio aç"
	@echo "    make seed          — Seed verisi yükle"
	@echo "    make reset-db      — DB sıfırla (dev only!)"
	@echo ""
	@echo "  Test"
	@echo "    make test          — Tüm testler"
	@echo "    make test-unit     — Sadece unit testler"
	@echo "    make test-e2e      — Playwright e2e"
	@echo ""
	@echo "  Docker"
	@echo "    make up            — Docker Compose başlat"
	@echo "    make down          — Docker Compose durdur"
	@echo "    make logs          — Uygulama logları izle"
	@echo "    make status        — Container durumları"
	@echo "    make clean         — Eski image'ları temizle"
	@echo ""
	@echo "  Prod / Ops"
	@echo "    make deploy        — Sunucuya manuel deploy"
	@echo "    make backup        — DB yedeği al"
	@echo "    make reconcile     — Ödeme reconcile çalıştır"
	@echo "    make ssh           — Sunucuya bağlan"
	@echo ""

# ── Geliştirme ──────────────────────────────────────────────
dev:
	npm run dev

build:
	npm run build

lint:
	npm run lint

typecheck:
	npm run typecheck

# ── Veritabanı ───────────────────────────────────────────────
migrate:
	npx prisma migrate deploy

migrate-new:
	@test -n "$(NAME)" || (echo "Kullanım: make migrate-new NAME=migration_adi" && exit 1)
	npx prisma migrate dev --name $(NAME)

studio:
	npx prisma studio

seed:
	npx prisma db seed

reset-db:
	@echo "⚠️  DB sıfırlanıyor (dev only)..."
	npx prisma migrate reset --force

generate:
	npx prisma generate

# ── Test ─────────────────────────────────────────────────────
test:
	npm run test

test-unit:
	npm run test:unit

test-e2e:
	npm run test:e2e

# ── Docker ───────────────────────────────────────────────────
up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f web

logs-all:
	docker compose logs -f

status:
	docker compose ps
	@echo ""
	@docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null || true

clean:
	docker image prune -f
	@echo "✅ Eski imajlar temizlendi"

clean-all:
	@echo "⚠️  Tüm kullanılmayan docker kaynakları temizleniyor..."
	docker system prune -f

# ── Prod / Ops ───────────────────────────────────────────────
SSH_HOST ?= root@178.104.144.3
SSH_PORT ?= 12022
APP_URL  ?= https://bagajpark.com

deploy:
	@echo "→ Sunucuya deploy ediliyor..."
	ssh $(SSH_HOST) -p $(SSH_PORT) "cd /root/emanetci && bash scripts/update.sh"

ssh:
	ssh $(SSH_HOST) -p $(SSH_PORT)

backup:
	ssh $(SSH_HOST) -p $(SSH_PORT) "cd /root/emanetci && bash scripts/backup.sh"

reconcile:
	@CRON_SECRET=$$(ssh $(SSH_HOST) -p $(SSH_PORT) "grep CRON_SECRET /root/emanetci/.env | cut -d= -f2-" 2>/dev/null); \
	if [ -z "$$CRON_SECRET" ]; then \
		echo "❌ CRON_SECRET alınamadı"; exit 1; \
	fi; \
	echo "→ Reconciliation tetikleniyor..."; \
	curl -sf -X POST $(APP_URL)/api/internal/reconcile-payments \
		-H "Authorization: Bearer $$CRON_SECRET" | python3 -m json.tool

disk:
	ssh $(SSH_HOST) -p $(SSH_PORT) "df -h / && docker system df"

tail-logs:
	ssh $(SSH_HOST) -p $(SSH_PORT) "docker logs emanetci-web-1 -f --tail 50"

health:
	@curl -sf $(APP_URL)/api/health/live | python3 -m json.tool
