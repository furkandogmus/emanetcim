#!/usr/bin/env bash
# SSH ile sunucuda hızlı güncelleme (git pull + docker compose --build).
#
# Kullanım (VM'de, örn. /opt/emanetci):
#   ./scripts/vm-update.sh
#   ./scripts/vm-update.sh /opt/emanetci
#
# Ortam değişkenleri:
#   BRANCH=develop     Hangi branch çekilecek (varsayılan: develop)
#   SKIP_GIT=1         Sadece imajı yeniden derle ve ayağa kaldır (pull yok)

set -euo pipefail

ROOT="${1:-${REPO_ROOT:-/opt/emanetci}}"
BRANCH="${BRANCH:-develop}"

cd "$ROOT" || {
  echo "vm-update: dizin açılamadı: $ROOT" >&2
  exit 1
}

if [[ ! -f docker-compose.yml ]]; then
  echo "vm-update: $ROOT içinde docker-compose.yml yok." >&2
  exit 1
fi

ENV_FILE="docker-compose.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "vm-update: uyarı: $ENV_FILE yok; compose varsayılanlarla çalışır." >&2
fi

# Docker Compose v2: yalnızca --env-file docker-compose.env verilirse proje kökündeki .env
# interpolasyon için yüklenmeyebilir → GOOGLE_CLIENT_ID / AUTH_PUBLIC_HOST boş kalır.
# Önce .env, sonra docker-compose.env (sonraki dosya aynı anahtarları ezer).
compose() {
  local args=()
  if [[ -f "$ROOT/.env" ]]; then
    args+=(--env-file "$ROOT/.env")
  fi
  if [[ -f "$ROOT/$ENV_FILE" ]]; then
    args+=(--env-file "$ROOT/$ENV_FILE")
  fi
  if [[ ${#args[@]} -gt 0 ]]; then
    docker compose "${args[@]}" "$@"
  else
    docker compose "$@"
  fi
}

if [[ "${SKIP_GIT:-0}" != "1" ]]; then
  if [[ ! -d .git ]]; then
    echo "vm-update: .git yok; SKIP_GIT=1 ile sadece build deneyin veya repo klonlayın." >&2
    exit 1
  fi
  echo "==> git: origin $BRANCH çekiliyor"
  git fetch origin
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH"
else
  echo "==> git atlandı (SKIP_GIT=1)"
fi

echo "==> docker compose up -d --build"
compose up -d --build

echo "==> durum"
compose ps

echo "==> bitti ($(date -u +%Y-%m-%dT%H:%M:%SZ))"
