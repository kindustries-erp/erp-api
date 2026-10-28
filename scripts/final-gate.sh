#!/usr/bin/env bash
set -euo pipefail

export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1536}"

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

if [ -n "$(git status --short)" ]; then
  echo "Final Gate requires a clean working tree after commit/rebase." >&2
  exit 1
fi

bun run build
bun run check:style
bunx jest --forceExit

commit_hash="$(git rev-parse HEAD)"
marker_dir="$repo_root/.git/erp-final-gate"
mkdir -p "$marker_dir"
touch "$marker_dir/$commit_hash"
echo "Final Gate passed for $commit_hash"
