#!/usr/bin/env bash
#
# Build Haroopad's distributable binaries into dist/.
#
#   ./build.sh            Linux AppImage + tar.gz, then the Windows .exe files
#   ./build.sh linux      Linux only
#   ./build.sh win        Windows only
#   ./build.sh clean      remove dist/ first, then build everything
#
# Produces in dist/:
#   Haroopad-<version>.AppImage      portable Linux build (chmod +x and run)
#   haroopad-<version>.tar.gz        the same build as a plain archive
#   Haroopad Setup <version>.exe     Windows installer (NSIS, per-user)
#   Haroopad <version>.exe           Windows portable executable
#
# The Windows target needs Wine. If Wine is not installed this script falls
# back to building it inside the electronuserland/builder:wine container, which
# only needs Docker. That is how the shipped .exe files were produced.

set -euo pipefail

cd "$(dirname "$0")"

WINE_IMAGE="electronuserland/builder:wine"

log() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die() { printf '\nerror: %s\n' "$*" >&2; exit 1; }

version() { node -p "require('./package.json').version"; }

ensure_deps() {
  if [ ! -d node_modules ]; then
    log "Installing dependencies"
    npm install
  fi
}

build_linux() {
  log "Building Linux targets (AppImage, tar.gz)"
  npx electron-builder --linux --publish never
}

build_win_native() {
  log "Building Windows targets with local Wine"
  npx electron-builder --win --publish never
}

build_win_docker() {
  log "Building Windows targets in Docker ($WINE_IMAGE)"

  # electron-builder writes caches under $HOME; give the container a writable
  # one inside the project so it does not try to mkdir /.cache as our uid.
  mkdir -p .cache/dockerhome

  docker run --rm \
    -v "$PWD":/project \
    -w /project \
    -e HOME=/project/.cache/dockerhome \
    -e XDG_CACHE_HOME=/project/.cache \
    -e ELECTRON_CACHE=/project/.cache/electron \
    -e ELECTRON_BUILDER_CACHE=/project/.cache/electron-builder \
    --user "$(id -u):$(id -g)" \
    "$WINE_IMAGE" \
    /bin/bash -c "npx electron-builder --win --publish never"
}

build_win() {
  if command -v wine >/dev/null 2>&1; then
    build_win_native
  elif command -v docker >/dev/null 2>&1; then
    echo "Wine not found; using Docker instead."
    build_win_docker
  else
    die "the Windows build needs either Wine or Docker installed"
  fi
}

summary() {
  log "Artifacts in dist/"
  ls -lh dist/*.AppImage dist/*.tar.gz dist/*.exe 2>/dev/null || true
}

target="${1:-all}"

case "$target" in
  clean)
    log "Removing dist/"
    rm -rf dist
    target=all
    ;;
esac

ensure_deps

case "$target" in
  linux) build_linux ;;
  win|windows) build_win ;;
  all) build_linux; build_win ;;
  *) die "unknown target '$target' (use: linux, win, clean, or no argument)" ;;
esac

summary
log "Haroopad $(version) build complete"
