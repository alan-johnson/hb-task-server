## Handsbreadth Task Server

A local REST API for macOS that bridges Apple Reminders to your Pebble watch via the **Handsbreadth Pebble app** _(coming soon)_.

> **Requirements:** macOS on Apple Silicon (M1 / M2 / M3 / M4). Intel Mac support is planned for a future release.

---

## Installation

1. **Download** `hb-task-server-arm64.zip` from the Assets section below.

2. **Unzip** it into a permanent folder, for example `~/hb-task-server/`.

3. **Remove the quarantine attribute** so macOS will allow the binary to run:
   ```
   xattr -d com.apple.quarantine hb-task-server-arm64
   ```

4. **Configure** your settings — copy the template and open it:
   ```
   cp .env.example .env
   open .env
   ```
   Set `PORT` (default: `3000`) and `DEFAULT_PROVIDER` (default: `apple`). Save and close.

5. **Start the server:**
   ```
   ./hb-task-server-arm64
   ```
   On the first Reminders request, macOS will ask for permission — click **OK**.

A `README.txt` with full instructions is included in the zip.

---

## Auto-start on Login (optional)

A `com.handsbreadth.hb-task-server.plist` file is included in the zip.

1. Open it in a text editor and replace every instance of `YOUR_USERNAME` with your Mac username.
   _(Not sure of your username? Run `whoami` in Terminal.)_

2. Copy it to LaunchAgents and load it:
   ```
   cp com.handsbreadth.hb-task-server.plist ~/Library/LaunchAgents/
   launchctl load ~/Library/LaunchAgents/com.handsbreadth.hb-task-server.plist
   ```

3. The server will now start automatically every time you log in.

To stop and disable auto-start:
```
launchctl unload ~/Library/LaunchAgents/com.handsbreadth.hb-task-server.plist
```

---

## UpQ Bridge (optional)

If you subscribe to [UpQ](https://upq.io), you can connect this server to the UpQ cloud so your Pebble watch can reach Apple Reminders from anywhere.

1. Log in to UpQ and generate a bridge API key:
   ```
   POST /auth/bridge/key
   ```

2. Add the key and your UpQ server address to `.env`:
   ```
   BRIDGE_URL=wss://your-upq-domain.com/bridge
   BRIDGE_API_KEY=<key from step 1>
   ```

3. Restart the server. You will see `Bridge: connected to UpQ server` in the output.

---

## What's in the Zip

```
hb-task-server-arm64                        ← server binary (no Node.js required)
.env.example                                ← configuration template
README.txt                                  ← installation guide (this document)
LICENSE.txt
com.handsbreadth.hb-task-server.plist       ← launchd auto-start (optional)
providers/
  apple/                                    ← AppleScript provider (default)
  reminders-cli/
    reminders                               ← alternative CLI provider binary
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| "macOS cannot verify..." on hb-task-server-arm64 | `xattr -d com.apple.quarantine hb-task-server-arm64` |
| "AppleScript error: Not authorized" | System Settings → Privacy & Security → Automation → enable Terminal |
| "macOS cannot verify..." on reminders binary | `xattr -d com.apple.quarantine providers/reminders-cli/reminders` |
| "Permission denied" on reminders binary | `chmod +x providers/reminders-cli/reminders` |
| Port already in use | Change `PORT` in `.env` and restart |
