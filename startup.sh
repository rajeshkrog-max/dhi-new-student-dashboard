#!/bin/sh
set -eu
cd /workspace
LOG=/tmp/app-startup.log
node scripts/preview.mjs stop || true
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
# The repo is one pnpm workspace (spec 0006). Use the pnpm version pinned in package.json.
# npm ships with Node, so it can install pnpm even where Corepack is missing.
PNPM_VERSION="$(node -p "require('./package.json').packageManager.split('@')[1]")"
command -v pnpm >/dev/null 2>&1 || npm install -g "pnpm@$PNPM_VERSION" >>"$LOG" 2>&1
# A no-op when everything is already installed. If it fails (for example offline), start with what is there.
pnpm install --frozen-lockfile >>"$LOG" 2>&1 || echo "[startup] pnpm install failed, starting with what is installed" >>"$LOG"
pnpm run dev >>"$LOG" 2>&1 &
