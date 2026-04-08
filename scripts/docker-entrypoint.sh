#!/bin/sh
set -e
cd /app

if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  prisma migrate deploy || prisma db push --accept-data-loss
else
  prisma db push --accept-data-loss
fi

# Standalone modunda server.js patch'lemesi (sadece dosya varsa)
[ -f /app/server.js ] && sed -i 's/"trustHostHeader":false/"trustHostHeader":true/' /app/server.js || true

# Eğer dışarıdan bir komut verilmişse (ör: npm run dev), onu çalıştır.
# Verilmemişse varsayılan olarak server.js ile başlat.
if [ "$#" -gt 0 ]; then
  exec "$@"
else
  exec node server.js
fi
