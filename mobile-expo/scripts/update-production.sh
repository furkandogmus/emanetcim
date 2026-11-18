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

echo "API: $EXPO_PUBLIC_API_BASE_URL"
npx -y eas-cli@latest update --channel production --environment production --non-interactive "$@"
