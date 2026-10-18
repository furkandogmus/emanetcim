#!/bin/bash

# Pre-commit hook for BagajPark Monorepo
# Runs linter and formatter based on changed files

STAGED_FILES=$(git diff --cached --name-only)

# --- WEB (NEXT.JS) ---
if echo "$STAGED_FILES" | grep -qE "\.(ts|tsx|js|jsx|mjs)$"; then
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
