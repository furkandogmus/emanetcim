#!/usr/bin/env bash
# Uretim kanalina EAS Update (derlemesiz JS/gorsel yayini).
#
#   npm run update:production -- --message "kisa aciklama"
#
# `eas update`, eas.json'daki derleme `env`ini OKUMAZ ve EAS'ta tanimli ortam degiskeni
# yok. 2026-11-18'de bu yuzden yayinlanan guncelleme API adresi olarak varsayilan
# emulator adresini (10.0.2.2) tasidi; uygulama sunucuya baglanamaz oldu. Degerler burada
# eas.json'daki production profilinden okunur; eksikse yayin yapilmaz.
set -euo pipefail
cd "$(dirname "$0")/.."

# Surum sabit: `@latest` her yayinda farkli bir arac calistirirdi.
EAS_CLI_VERSION="27.11.0"

# Yayin ELDEKI degil, main'deki kodu gonderir: kirli agac ya da geride kalmis dal
# kullanicilara hic gozden gecirilmemis JS ulastirirdi.
# Izlenmeyen dosyalar (AGENTS.md, __pycache__ vb.) yayina girmez; yalnizca izlenen
# degisiklikler ve paketlenen klasorlerdeki (src, assets) izlenmeyen dosyalar engeller.
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "calisma agaci temiz degil; once commit'le ya da stash'le" >&2
  exit 1
fi
if [ -n "$(git ls-files --others --exclude-standard -- src assets)" ]; then
  echo "src/ ya da assets/ altinda izlenmeyen dosya var; commit'le ya da sil" >&2
  exit 1
fi
branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$branch" != "main" ]; then
  echo "yalnizca main'den yayinlanir (su an: $branch)" >&2
  exit 1
fi
git fetch --quiet origin main
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  echo "main origin/main ile ayni degil; once git pull" >&2
  exit 1
fi

# CI ile ayni kapi: tip, lint, locale paritesi, testler.
npm run verify

eval "$(node -e '
const env = require("./eas.json").build.production.env || {};
for (const k of ["EXPO_PUBLIC_API_BASE_URL", "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID"]) {
  if (!env[k]) { console.error(`eas.json production env: ${k} eksik`); process.exit(1); }
  console.log(`export ${k}=${JSON.stringify(env[k])}`);
}')"

case "$EXPO_PUBLIC_API_BASE_URL" in
  https://*) ;;
  *) echo "uretim API adresi https degil: $EXPO_PUBLIC_API_BASE_URL" >&2; exit 1 ;;
esac

# Kademeli yayin: ROLLOUT=10 npm run update:production -- --message "..." (yuzde 1-99).
rollout_args=()
if [ -n "${ROLLOUT:-}" ]; then
  case "$ROLLOUT" in
    [1-9]|[1-9][0-9]) rollout_args=(--rollout-percentage "$ROLLOUT") ;;
    *) echo "ROLLOUT 1-99 arasi tam sayi olmali: $ROLLOUT" >&2; exit 1 ;;
  esac
fi

# Eski ikiliye yayin: OTA_RUNTIME=0.3.0 npm run update:production -- --message "...".
# runtimeVersion = app.json surumu (appVersion politikasi); main'deki JS o ikiliyle
# uyumlu olmali (yeni yerel modul yoksa uyumludur). Surum yalnizca kapilardan SONRA ve
# gecici yazilir; cikista (hata dahil) geri alinir, agac temiz kalir.
if [ -n "${OTA_RUNTIME:-}" ]; then
  [[ "$OTA_RUNTIME" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "OTA_RUNTIME x.y.z olmali: $OTA_RUNTIME" >&2; exit 1; }
  cp app.json app.json.ota-bak
  trap 'mv app.json.ota-bak app.json' EXIT
  node -e '
    const fs = require("fs");
    const j = JSON.parse(fs.readFileSync("app.json", "utf8"));
    j.expo.version = process.argv[1];
    fs.writeFileSync("app.json", JSON.stringify(j, null, 2) + "\n");
  ' "$OTA_RUNTIME"
  echo "runtime: $OTA_RUNTIME (gecici)"
fi

echo "API: $EXPO_PUBLIC_API_BASE_URL"
npx -y "eas-cli@${EAS_CLI_VERSION}" update --channel production --environment production --non-interactive ${rollout_args[@]+"${rollout_args[@]}"} "$@"
