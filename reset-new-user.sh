#!/usr/bin/env bash
# reset-new-user.sh
# Resets hb-task-server to a "new user" state for testing the getting started experience.
#
# What this script does:
#   1. Revokes macOS Reminders privacy permission (for the reminders-cli provider)
#   2. Revokes macOS Automation/AppleEvents permission (for the apple provider via osascript)
#   3. Re-adds the quarantine flag to the reminders binary (triggers Gatekeeper on next run)
#   4. Resets .env from .env.example (removes any bridge credentials)
#
# NOTE: Steps 1 and 2 use `tccutil reset`, which affects ALL apps for those services,
# not just hb-task-server. Each app will be re-prompted for permission on next use.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REMINDERS_BIN="$SCRIPT_DIR/src/providers/reminders-cli/reminders"
ENV_FILE="$SCRIPT_DIR/.env"
ENV_EXAMPLE="$SCRIPT_DIR/.env.example"

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
fi

# 4. Reset .env from .env.example
if [ -f "$ENV_EXAMPLE" ]; then
  echo "→ Resetting .env from .env.example..."
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  echo "  Done."
else
  echo "→ .env.example not found, skipping .env reset."
fi

echo ""
echo "Reset complete. Next steps to test the getting started experience:"
echo "  1. Start the server:  npm start"
echo "  2. Make a request — you will be prompted to grant permissions."
