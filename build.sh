#!/usr/bin/env bash
# Handsbreadth Task Server — Build Script
# Produces self-contained macOS executables using Node.js Single Executable Applications (SEA).
# Output is written to the build/ directory.

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────

APP_NAME="hb-task-server"
ENTRY="src/server.js"
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

node_version=$(node --version 2>/dev/null) || fail "Node.js not found. Install Node.js v20+."
node_major=$(echo "$node_version" | sed 's/v\([0-9]*\).*/\1/')
[[ "$node_major" -ge 20 ]] || fail "Node.js v20+ required (found $node_version)."
ok "Node.js $node_version"

npx postject --version &>/dev/null || fail "postject not found. Run: npm install -g postject"
ok "postject"

[[ -f "$ENTRY" ]] || fail "Entry point '$ENTRY' not found."

# ── Prepare build directory ───────────────────────────────────────────────────

step "Preparing build directory"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
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

# ── Generate SEA blob ─────────────────────────────────────────────────────────

step "Generating SEA blob"

cat > "$SEA_CONFIG" <<EOF
{
  "main": "$ENTRY",
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

  cp "$node_bin" "$out"

  npx postject "$out" NODE_SEA_BLOB "$SEA_BLOB" \
    --sentinel-fuse "$FUSE" \
    --macho-segment-name NODE_SEA

  codesign --sign - "$out"
  ok "Signed: $out"

  zip -j "$out.zip" "$out"
  ok "Archived: $out.zip"
}

# ── Build arm64 ───────────────────────────────────────────────────────────────

HOST_ARCH=$(uname -m)

if [[ "$HOST_ARCH" == "arm64" ]]; then
  build_binary "arm64" "$(which node)"
else
  log "Not on arm64 — skipping arm64 build (cross-compile not supported)."
fi

# ── Build x64 ────────────────────────────────────────────────────────────────

if [[ "$HOST_ARCH" == "x86_64" ]]; then
  build_binary "x64" "$(which node)"
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
rm -f "$SEA_CONFIG" "$SEA_BLOB"
ok "Removed $SEA_CONFIG and $SEA_BLOB"

# ── Done ──────────────────────────────────────────────────────────────────────

echo
echo "Build complete. Output:"
find "$BUILD_DIR" -not -name ".DS_Store" | sort | sed 's/^/  /'
echo
