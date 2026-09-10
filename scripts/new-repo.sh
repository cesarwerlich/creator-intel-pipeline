#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <target-dir> [project-name]" >&2
}

if [ "${1:-}" = "" ]; then
  usage
  exit 1
fi

target_dir="$1"
project_name="${2:-$(basename "$target_dir")}"
template_dir="$(cd "$(dirname "$0")/.." && pwd)"

mkdir -p "$target_dir"

copy_missing() {
  src="$1"
  dest="$2"
  if [ -e "$dest" ]; then
    echo "skip existing: $dest"
    return
  fi
  mkdir -p "$(dirname "$dest")"
  cp -R "$src" "$dest"
  echo "created: $dest"
}

find "$template_dir" -mindepth 1 -maxdepth 1 | while IFS= read -r item; do
  base="$(basename "$item")"
  copy_missing "$item" "$target_dir/$base"
done

if grep -q '^# Project Name$' "$target_dir/README.md" 2>/dev/null; then
  tmp_file="$(mktemp)"
  sed "s/^# Project Name$/# ${project_name}/" "$target_dir/README.md" > "$tmp_file"
  mv "$tmp_file" "$target_dir/README.md"
fi

chmod +x "$target_dir"/scripts/*.sh 2>/dev/null || true

echo "Initialized $project_name at $target_dir"
