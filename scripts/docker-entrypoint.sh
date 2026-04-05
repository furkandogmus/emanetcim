#!/bin/sh
set -e
cd /app

if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  prisma migrate deploy || prisma db push --accept-data-loss
else
  prisma db push --accept-data-loss
fi

# Next.js standalone: trustHostHeader varsayılan false; ters vekil (nginx/ngrok) arkasında
# Host header'ı yerine bind adresi (0.0.0.0:3000) kullanılır → Auth.js URL'leri bozulur.
# Bu seçenek kullanıcı config'inden ayarlanamıyor (dahili), runtime'da patchliyoruz.
sed -i 's/"trustHostHeader":false/"trustHostHeader":true/' /app/server.js 2>/dev/null || true

exec node server.js
