#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$repo_root"

if ! command -v bun >/dev/null 2>&1; then
  echo "bun is not available; skipped bun run fix" >&2
  echo "{}"
  exit 0
fi

if ! bun run fix >&2; then
  echo "bun run fix failed after file edit; run it manually for details" >&2
fi

echo "{}"
