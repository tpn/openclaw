#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_MANAGER="$(node -p "require('./package.json').packageManager || ''")"
PACK_DIR="${OPENCLAW_PACK_DIR:-$ROOT_DIR/.artifacts/source-builds}"
INSTALL_NPM="${OPENCLAW_INSTALL_NPM:-npm}"
GLOBAL_PREFIX="${OPENCLAW_GLOBAL_PREFIX:-}"

if [[ "$PACKAGE_MANAGER" != pnpm@* ]]; then
  echo "Expected package.json#packageManager to be pnpm@<version>" >&2
  exit 1
fi

PNPM_VERSION="${PACKAGE_MANAGER#pnpm@}"

mkdir -p "$PACK_DIR"
cd "$ROOT_DIR"

npm exec --yes "pnpm@$PNPM_VERSION" install
npm exec --yes "pnpm@$PNPM_VERSION" -- build

tarball="$("$INSTALL_NPM" pack --silent --ignore-scripts "$ROOT_DIR" --pack-destination "$PACK_DIR" | tail -n 1 | tr -d '\r')"
tarball_path="$PACK_DIR/$tarball"

if [[ -z "$tarball" || ! -f "$tarball_path" ]]; then
  echo "npm pack failed: expected tarball under $PACK_DIR" >&2
  exit 1
fi

install_cmd=("$INSTALL_NPM" install -g)
if [[ -n "$GLOBAL_PREFIX" ]]; then
  install_cmd+=(--prefix "$GLOBAL_PREFIX")
fi
install_cmd+=("$tarball_path")
"${install_cmd[@]}"

echo "Installed $tarball_path"
if [[ -n "$GLOBAL_PREFIX" ]]; then
  echo "Global prefix: $GLOBAL_PREFIX"
fi
