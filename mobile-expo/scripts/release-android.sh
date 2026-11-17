#!/usr/bin/env bash
# Android surumu: yerelde imzali .aab uret, Play API ile test izine gonder.
# EAS bulut kuyrugu ve `eas submit` kuyrugu saatlerce bekleyebiliyor (2026-11-17);
# bu yol ikisini de atlar. Imza anahtari yine EAS'tan gelir.
#
#   npm run release:android            # kapali test (alpha)
#   TRACK=internal npm run release:android
#
# Gerekenler (yerelde, git'e girmez): google-services.json, play-service-account.json,
# JDK 17, Android SDK, python3 + cryptography. Surum adi app.json'dan; surum kodu EAS'ta artar.
set -euo pipefail
cd "$(dirname "$0")/.."

for f in google-services.json play-service-account.json release-notes.tr.txt; do
  [[ -e "$f" ]] || { echo "eksik: $f" >&2; exit 1; }
done

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
# Yerel derleme yalnizca git'teki dosyalari kopyalar; gitignore'daki Firebase dosyasi
# bu degiskenle bulunur (app.config.js).
export GOOGLE_SERVICES_JSON="$PWD/google-services.json"

version="$(node -p "require('./app.json').expo.version")"
out="build/bagajpark-${version}.aab"
mkdir -p build

npx -y eas-cli@latest build --platform android --profile production --local --non-interactive --output "$out"
python3 -I scripts/play-upload.py play-service-account.json "$out" "$version" "${TRACK:-alpha}" release-notes.tr.txt
