## Handsbreadth Task Server

A local macOS REST API server for Pebble watches. Together, with the **hb-reminders** Pebble watch app, displays Apple Reminders on your Pebble watch enabling you to view and manage your Reminders tasks on your Pebble watch.

> **Requirements:** macOS on Apple Silicon (M1 / M2 / M3 / M4). Intel Mac support is planned for a future release.

---

## Installation

1. **Download** `hb-task-server-arm64.zip` from the Assets section below.

2. **Unzip** it into a permanent folder, for example `~/hb-task-server/`.

3. **Remove the quarantine attribute** so macOS will allow the binary to run. Start **Terminal**, change to the folder from step 2, then run:
   ```
   cd ~/hb-task-server/
   xattr -r -d com.apple.quarantine .
   ```
   If you see `No such xattr`, the file is already clear — continue to step 4.

4. **Configure** your settings — copy the template and open it. In Terminal, type:
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

To have the server start automatically at login — and restart itself if it ever crashes — run the installer included in the zip:

```
./install-launch-agent.sh
```

This registers a standard macOS LaunchAgent for you; no manual editing required. See `AUTOSTART.md` (also included in the zip) for exactly what it does.

To stop and disable auto-start:
```
./install-launch-agent.sh --uninstall
```

---

## UpQ Bridge (optional)

If you subscribe to [UpQ](https://tasks.handsbreadth.com), you can connect this server to the UpQ cloud so your Pebble watch can reach Apple Reminders from anywhere. The UpQ server also pulls your Apple Reminders, Microsoft Tasks and Google Tasks together into one easily managed list. Also, UpQ automatically prioritizes your tasks into what needs your attention now versus what can wait until later.

1. Go to https://tasks.handsbreadth.com then register to create an account. A free trial is available!

2. Log in to UpQ.  

3. Click the Settings button, if you are not already there.

4. In the Apple Reminders section, click the **Generate Key** button. The key will be displayed on screen.

5. Copy the displayed key then edit the `.env` file:
   ```
   BRIDGE_URL=ws://tasks.handsbreadth.com/bridge
   BRIDGE_API_KEY=<key from step 4>
   ```

6. Restart the local **hb-task-server** server. You will see `Bridge: connected to UpQ server` in the output.

---

## What's in the Zip

```
hb-task-server-arm64                        ← server binary (no Node.js required)
.env.example                                ← configuration template
README.txt                                  ← installation guide (this document)
LICENSE.txt
com.handsbreadth.hb-task-server.plist       ← launchd auto-start template (used by install-launch-agent.sh)
install-launch-agent.sh                     ← optional auto-start installer
AUTOSTART.md                                ← what install-launch-agent.sh does
providers/
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
| Port already in use | Change the `PORT` value in `.env` and restart |
