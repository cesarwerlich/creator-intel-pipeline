#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

ran=0

run_if_script_exists() {
  script_name="$1"
  if command -v npm >/dev/null 2>&1 && npm run | grep -E "^[[:space:]]+${script_name}$" >/dev/null 2>&1; then
    npm run "$script_name"
    ran=1
  fi
}

echo "Running stack-aware checks..."

if [ -f package.json ]; then
  echo "Detected Node project."
  run_if_script_exists lint
  run_if_script_exists typecheck
  run_if_script_exists test
  run_if_script_exists build
fi

if [ -f pyproject.toml ]; then
  echo "Detected Python project."
  if command -v ruff >/dev/null 2>&1; then
    ruff check .
    ran=1
  fi
  if command -v pytest >/dev/null 2>&1; then
    pytest
    ran=1
  fi
fi

if [ -f go.mod ]; then
  echo "Detected Go project."
  go test ./...
  ran=1
fi

if [ -f Cargo.toml ]; then
  echo "Detected Rust project."
  cargo test
  ran=1
fi

if [ "$ran" -eq 0 ]; then
  echo "No runnable stack checks detected. Add project-specific checks here as the repo takes shape."
fi

echo "Checks complete."
