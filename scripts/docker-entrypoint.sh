#!/bin/sh
set -e
cd /app

# Standalone modunda server.js patch'lemesi (sadece dosya varsa)
[ -f /app/server.js ] && sed -i 's/"trustHostHeader":false/"trustHostHeader":true/' /app/server.js || true

# Prisma migration'larını uygula
echo "==> Running prisma migrate deploy..."
npx prisma migrate deploy || echo "WARNING: prisma migrate failed (continuing...)"

# Eğer dışarıdan bir komut verilmişse (ör: npm run dev), onu çalıştır.
# Verilmemişse varsayılan olarak server.js ile başlat.
if [ "$#" -gt 0 ]; then
  exec "$@"
else
  exec node server.js
fi
