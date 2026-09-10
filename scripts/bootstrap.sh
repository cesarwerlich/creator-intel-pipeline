#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Bootstrapping project..."

if [ -f package.json ]; then
  if [ -f package-lock.json ]; then
    npm ci
  elif [ -f pnpm-lock.yaml ] && command -v pnpm >/dev/null 2>&1; then
    pnpm install --frozen-lockfile
  elif [ -f yarn.lock ] && command -v yarn >/dev/null 2>&1; then
    yarn install --frozen-lockfile
  else
    npm install
  fi
fi

if [ -f pyproject.toml ]; then
  if command -v uv >/dev/null 2>&1; then
    uv sync
  else
    echo "Python project detected. Install dependencies with your chosen Python environment manager." >&2
  fi
fi

if [ -f go.mod ]; then
  go mod download
fi

if [ -f Cargo.toml ]; then
  cargo fetch
fi

if [ ! -f .env ] && [ -f .env.example ]; then
  echo "No .env found. Copy .env.example to .env if this project needs local secrets."
fi

echo "Bootstrap complete. Run ./scripts/check.sh to verify the project works."
