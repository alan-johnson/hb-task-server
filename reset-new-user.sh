#!/usr/bin/env bash
# reset-new-user.sh
# Resets hb-task-server to a "new user" state for testing the getting started experience.
#
# What this script does:
#   1. Revokes macOS Reminders privacy permission (for the reminders-cli provider)
#   2. Revokes macOS Automation/AppleEvents permission (for the apple provider via osascript)
#   3. Re-adds the quarantine flag to build/providers/reminders-cli/reminders (triggers Gatekeeper on next run)
#   4. Resets build/.env from build/.env.example (removes any bridge credentials)
#
# NOTE: Steps 1 and 2 use `tccutil reset`, which affects ALL apps for those services,
# not just hb-task-server. Each app will be re-prompted for permission on next use.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
REMINDERS_BIN="$BUILD_DIR/providers/reminders-cli/reminders"
ENV_FILE="$BUILD_DIR/.env"
ENV_FILE_BACKUP="$BUILD_DIR/.env.backup"
ENV_EXAMPLE="$BUILD_DIR/.env.example"

echo "hb-task-server: resetting to new user state"
echo ""

# 1. Revoke Reminders permission (used by reminders-cli provider via EventKit)
echo "→ Revoking Reminders privacy permission (affects all apps)..."
tccutil reset Reminders
echo "  Done."

# 2. Revoke Automation/AppleEvents permission (used by apple provider via osascript)
echo "→ Revoking Automation privacy permission (affects all apps)..."
tccutil reset AppleEvents
echo "  Done."

# 3. Re-add quarantine flag to the reminders binary so Gatekeeper prompts again
if [ -f "$REMINDERS_BIN" ]; then
  echo "→ Re-adding quarantine flag to reminders binary..."
  # Remove any existing quarantine value first
  xattr -d com.apple.quarantine "$REMINDERS_BIN" 2>/dev/null || true
  # Write a quarantine value that Gatekeeper will check on next execution
  xattr -w com.apple.quarantine "0081;00000000;reset-new-user;" "$REMINDERS_BIN"
  echo "  Done: $REMINDERS_BIN"
else
  echo "→ Reminders binary not found at expected path, skipping quarantine reset."
  echo "  Expected: $REMINDERS_BIN"
  echo "  Run 'npm run build' first."
fi

# 4. Reset .env from .env.example
if [ -f "$ENV_EXAMPLE" ]; then
  if [ -f "$ENV_FILE" ]; then
    echo "→ Backing up build/.env to build/.env.backup..."
    cp "$ENV_FILE" "$ENV_FILE_BACKUP"
  fi
  echo "→ Resetting build/.env from build/.env.example..."
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  echo "  Done."
else
  echo "→ build/.env.example not found, skipping .env reset."
  echo "  Run 'npm run build' first."
fi

echo ""
echo "Reset complete. Next steps to test the getting started experience:"
echo "  1. cd build"
echo "  2. ./hb-task-server-arm64"
echo "  3. Make a request — you will be prompted to grant permissions."
