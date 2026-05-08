#!/bin/bash

# Pre-commit hook for BagajPark Monorepo
# Runs linter and formatter based on changed files

STAGED_FILES=$(git diff --cached --name-only)

# --- MOBILE (FLUTTER) ---
if echo "$STAGED_FILES" | grep -q "mobile/"; then
  echo "🚀 Running Mobile Linter & Formatter..."
  cd mobile
  
  echo "  - Formatting Dart files..."
  dart format lib test --set-exit-if-changed
  if [ $? -ne 0 ]; then
    echo "  ❌ Dart formatting issues found. Please run 'dart format lib test' and stage the changes."
    exit 1
  fi

  echo "  - Analyzing Dart code..."
  flutter analyze
  if [ $? -ne 0 ]; then
    echo "  ❌ Flutter analysis failed."
    exit 1
  fi
  
  cd ..
fi

# --- WEB (NEXT.JS) ---
if echo "$STAGED_FILES" | grep -E "\.(ts|tsx|js|jsx|mjs)$" | grep -qv "mobile/"; then
  echo "🌐 Running Web Linter & Typecheck..."
  
  echo "  - Running ESLint..."
  npm run lint
  if [ $? -ne 0 ]; then
    echo "  ❌ Web linting failed."
    exit 1
  fi

  echo "  - Running Typecheck..."
  npm run typecheck
  if [ $? -ne 0 ]; then
    echo "  ❌ Web typecheck failed."
    exit 1
  fi
fi

echo "✅ Pre-commit checks passed!"
exit 0
