#!/usr/bin/env bash
# Handsbreadth Task Server — LaunchAgent installer
#
# Registers the server as a macOS LaunchAgent so it starts automatically at
# login and restarts automatically if it ever crashes. This is optional —
# the server runs exactly the same without it if you'd rather start it by
# hand each time. See AUTOSTART.md for what this actually does.
#
# Usage:
#   ./install-launch-agent.sh              install (or re-install after moving the folder)
#   ./install-launch-agent.sh --uninstall  remove the LaunchAgent

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLIST_NAME="com.handsbreadth.hb-task-server.plist"
PLIST_TEMPLATE="$SCRIPT_DIR/$PLIST_NAME"
PLIST_DEST="$HOME/Library/LaunchAgents/$PLIST_NAME"
LABEL="com.handsbreadth.hb-task-server"

log()  { echo "  $*"; }
step() { echo; echo "▶ $*"; }
ok()   { echo "  ✓ $*"; }
fail() { echo; echo "✗ $*" >&2; exit 1; }

uninstall() {
  step "Removing LaunchAgent"
  launchctl unload "$PLIST_DEST" 2>/dev/null || true
  rm -f "$PLIST_DEST"
  ok "Unloaded and removed $PLIST_DEST"
  echo
  echo "The server binary and your .env are untouched — only the auto-start"
  echo "registration was removed. Run this script again (without --uninstall)"
  echo "to re-enable it."
  exit 0
}

[[ "${1:-}" == "--uninstall" || "${1:-}" == "-u" ]] && uninstall

# ── Preflight ─────────────────────────────────────────────────────────────────

step "Checking prerequisites"

[[ "$(uname -s)" == "Darwin" ]] || fail "This installs a macOS LaunchAgent — not applicable on this OS."

[[ -f "$PLIST_TEMPLATE" ]] || fail "$PLIST_NAME not found next to this script. Run it from the folder you unzipped the release into."
ok "Found $PLIST_NAME"

BINARY=""
for candidate in "$SCRIPT_DIR"/hb-task-server-arm64 "$SCRIPT_DIR"/hb-task-server-x64; do
  [[ -x "$candidate" ]] && BINARY="$candidate" && break
done
[[ -n "$BINARY" ]] || fail "No hb-task-server binary found next to this script (looked for hb-task-server-arm64 / hb-task-server-x64). If you just downloaded the release, run 'xattr -r -d com.apple.quarantine .' and 'chmod +x hb-task-server-*' first."
ok "Found binary: $(basename "$BINARY")"

# ── Write the plist with real values in place of the template placeholders ────

step "Writing LaunchAgent"

mkdir -p "$HOME/Library/LaunchAgents"

sed \
  -e "s#/Users/YOUR_USERNAME/hb-task-server/hb-task-server-arm64#$BINARY#" \
  -e "s#/Users/YOUR_USERNAME/hb-task-server#$SCRIPT_DIR#" \
  -e "s#/Users/YOUR_USERNAME/Library/Logs#$HOME/Library/Logs#g" \
  "$PLIST_TEMPLATE" > "$PLIST_DEST"

ok "Wrote $PLIST_DEST"
log "Binary:           $BINARY"
log "Working directory: $SCRIPT_DIR"
log "Crash/startup log: $HOME/Library/Logs/hb-task-server.log"

# ── Load it ─────────────────────────────────────────────────────────────────

step "Loading LaunchAgent"

# Unload first in case this is a re-install (e.g. the folder moved) — a stale
# registration under the same label would otherwise silently keep pointing
# at the old path.
launchctl unload "$PLIST_DEST" 2>/dev/null || true
launchctl load -w "$PLIST_DEST"

sleep 1
if launchctl list | grep -q "$LABEL"; then
  ok "Loaded and running — the server will now start at login and restart automatically if it crashes"
else
  log "Loaded, but not showing in 'launchctl list' yet. Check $HOME/Library/Logs/hb-task-server.log if the server doesn't come up."
fi

echo
echo "To undo this later: $0 --uninstall"
