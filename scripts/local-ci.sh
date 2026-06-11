#!/bin/bash
# BagajPark Local CI Runner
# Runs GitHub Actions workflows locally via act + Docker
# Usage: ./scripts/local-ci.sh [web|mobile|all]

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_deps() {
  if ! command -v docker &>/dev/null; then
    error "Docker not found. Install Docker or OrbStack first."
    exit 1
  fi
  if ! docker info &>/dev/null; then
    error "Docker daemon not running."
    exit 1
  fi
  if ! command -v act &>/dev/null; then
    error "act not found. Install with: brew install act"
    exit 1
  fi
}

run_web_ci() {
  info "Running Web CI (lint → typecheck → test → build)..."
  act -W .github/workflows/ci.yml \
    --pull \
    --container-architecture linux/amd64 \
    --secret-file .env.ci 2>/dev/null || \
  act -W .github/workflows/ci.yml \
    --pull \
    --container-architecture linux/amd64
}

run_mobile_ci() {
  info "Running Mobile CI (analyze → test → build APK)..."
  act -W .github/workflows/mobile-ci.yml \
    --pull \
    --container-architecture linux/amd64 \
    --job build-android
}

case "${1:-all}" in
  web)
    check_deps
    run_web_ci
    ;;
  mobile)
    check_deps
    run_mobile_ci
    ;;
  all)
    check_deps
    run_web_ci
    run_mobile_ci
    ;;
  *)
    echo "Usage: $0 [web|mobile|all]"
    exit 1
    ;;
esac

info "Done."
