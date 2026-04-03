#!/bin/sh
set -e
cd /app

if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  prisma migrate deploy
else
  prisma db push
fi

exec node server.js
