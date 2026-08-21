#!/bin/sh
set -e
cd /app

# Standalone modunda server.js patch'lemesi (sadece dosya varsa)
[ -f /app/server.js ] && sed -i 's/"trustHostHeader":false/"trustHostHeader":true/' /app/server.js || true

# Prisma migration'larını uygula. Sessizce yutulmuyor: migrate deploy basarisiz olursa
# container baslamiyor — yanlis/eksik semayla sessizce ayakta kalmak, gurultulu bir
# crash-loop'tan daha kotu (2026-08-21: bu tam olarak sessizce oluyordu, prisma.config.ts
# imaja hic girmemisti).
echo "==> Running prisma migrate deploy..."
npx prisma migrate deploy

# Eğer dışarıdan bir komut verilmişse (ör: npm run dev), onu çalıştır.
# Verilmemişse varsayılan olarak server.js ile başlat.
if [ "$#" -gt 0 ]; then
  exec "$@"
else
  exec node server.js
fi
