#!/usr/bin/env bash
# Handsbreadth Task Server — Build Script
# Produces self-contained macOS executables using Node.js Single Executable Applications (SEA).
# Output is written to the build/ directory.

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────

APP_NAME="hb-task-server"
ENTRY="src/server.js"
BUNDLE="server.bundle.js"
BUILD_DIR="build"
SEA_CONFIG="sea-config.json"
SEA_BLOB="sea-prep.blob"
FUSE="NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"

# ── Helpers ───────────────────────────────────────────────────────────────────

log()  { echo "  $*"; }
step() { echo; echo "▶ $*"; }
ok()   { echo "  ✓ $*"; }
fail() { echo; echo "✗ $*" >&2; exit 1; }

# ── Preflight ─────────────────────────────────────────────────────────────────

step "Checking prerequisites"

node_version=$(node --version 2>/dev/null) || fail "Node.js not found. Install Node.js v20+ from https://nodejs.org"
node_major=$(echo "$node_version" | sed 's/v\([0-9]*\).*/\1/')
[[ "$node_major" -ge 20 ]] || fail "Node.js v20+ required (found $node_version)."
ok "Node.js $node_version"

# Verify SEA fuse is present — Homebrew Node.js strips it out
NODE_BIN_CHECK=$(node -e "process.stdout.write(process.execPath)")
grep -qc "$FUSE" "$NODE_BIN_CHECK" 2>/dev/null || \
  fail "SEA fuse not found in Node.js binary at $NODE_BIN_CHECK.
  Homebrew Node.js does not support SEA builds.
  Install the official Node.js from https://nodejs.org and ensure it is first on your PATH."

command -v postject &>/dev/null || fail "postject not found. Run: npm install -g postject"
ok "postject"

[[ -f "$ENTRY" ]] || fail "Entry point '$ENTRY' not found."

# ── Prepare build directory ───────────────────────────────────────────────────

step "Preparing build directory"
# Preserve .env if it exists (contains user-configured API keys)
if [[ -f "$BUILD_DIR/.env" ]]; then
  cp "$BUILD_DIR/.env" /tmp/.hb-task-server-env-backup
fi
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
if [[ -f /tmp/.hb-task-server-env-backup ]]; then
  cp /tmp/.hb-task-server-env-backup "$BUILD_DIR/.env"
  rm /tmp/.hb-task-server-env-backup
  log ".env preserved"
fi
ok "build/ ready"

# ── Copy providers ────────────────────────────────────────────────────────────

step "Copying providers"
if [[ -d "dist/providers" ]]; then
  cp -r dist/providers "$BUILD_DIR/providers"
  # Remove .DS_Store files from the copied providers
  find "$BUILD_DIR/providers" -name ".DS_Store" -delete
  ok "Providers copied to $BUILD_DIR/providers/"
else
  log "Warning: dist/providers not found — skipping."
fi

# Copy .env.example for reference
cp .env.example "$BUILD_DIR/.env.example"
ok ".env.example copied"

# ── Bundle application ────────────────────────────────────────────────────────

step "Bundling application"
# SEA require() only supports built-in modules; esbuild inlines all dependencies
./node_modules/.bin/esbuild "$ENTRY" \
  --bundle \
  --platform=node \
  --outfile="$BUNDLE"
ok "Bundle written: $BUNDLE"

# ── Generate SEA blob ─────────────────────────────────────────────────────────

step "Generating SEA blob"

cat > "$SEA_CONFIG" <<EOF
{
  "main": "$BUNDLE",
  "output": "$SEA_BLOB"
}
EOF

node --experimental-sea-config "$SEA_CONFIG"
ok "Blob generated: $SEA_BLOB"

# ── Build function ────────────────────────────────────────────────────────────

build_binary() {
  local arch="$1"
  local node_bin="$2"
  local out="$BUILD_DIR/$APP_NAME-$arch"

  step "Building $arch binary"

  [[ -f "$node_bin" ]] || { log "Node binary not found at '$node_bin' — skipping $arch."; return 0; }

  # Thin universal binaries to the target arch so postject finds exactly one fuse
  if lipo -info "$node_bin" 2>/dev/null | grep -q "Non-fat"; then
    cp "$node_bin" "$out"
  else
    lipo -thin "$arch" "$node_bin" -output "$out"
  fi
  chmod u+w "$out"
  xattr -c "$out"
  codesign --remove-signature "$out"

  postject "$out" NODE_SEA_BLOB "$SEA_BLOB" \
    --sentinel-fuse "$FUSE" \
    --macho-segment-name NODE_SEA

  codesign --sign - "$out"
  ok "Signed: $out"

  # Package binary + providers + env example into a single distributable zip
  local zip_staging="$BUILD_DIR/.zip-staging-$arch"
  mkdir -p "$zip_staging"
  cp "$out" "$zip_staging/"
  cp "$BUILD_DIR/.env.example" "$zip_staging/.env.example"
  [[ -d "$BUILD_DIR/providers" ]] && cp -r "$BUILD_DIR/providers" "$zip_staging/providers"
  (cd "$zip_staging" && zip -r "../$(basename "$out").zip" .)
  rm -rf "$zip_staging"
  ok "Archived: $out.zip"
}

# ── Build arm64 ───────────────────────────────────────────────────────────────

HOST_ARCH=$(uname -m)
NODE_BIN="$NODE_BIN_CHECK"

if [[ "$HOST_ARCH" == "arm64" ]]; then
  build_binary "arm64" "$NODE_BIN"
else
  log "Not on arm64 — skipping arm64 build (cross-compile not supported)."
fi

# ── Build x64 ────────────────────────────────────────────────────────────────

if [[ "$HOST_ARCH" == "x86_64" ]]; then
  build_binary "x64" "$NODE_BIN"
else
  # Allow override via NODE_X64 env var for cross-compilation
  if [[ -n "${NODE_X64:-}" ]]; then
    build_binary "x64" "$NODE_X64"
  else
    log "Skipping x64 (not on Intel). To cross-compile, set NODE_X64=/path/to/x64/node."
  fi
fi

# ── Clean up temp files ───────────────────────────────────────────────────────

step "Cleaning up"
rm -f "$SEA_CONFIG" "$SEA_BLOB" "$BUNDLE"
ok "Removed $SEA_CONFIG, $SEA_BLOB, $BUNDLE"

# ── Done ──────────────────────────────────────────────────────────────────────

echo
echo "Build complete. Output:"
find "$BUILD_DIR" -not -name ".DS_Store" | sort | sed 's/^/  /'
echo
