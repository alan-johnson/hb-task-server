# Handsbreadth Task Server

A locally run REST API server for macOS that exposes Apple Reminders over HTTP. Designed to be called by AI assistants and other local tools that need read/write access to Apple Reminders.

---

## Providers

Two providers are available, both targeting Apple Reminders on macOS:

| Provider | Mechanism | Notes |
|----------|-----------|-------|
| `apple` | AppleScript | Default. No setup beyond granting Reminders access. |
| `reminders-cli` | CLI binary | Alternative if AppleScript permissions are problematic. |

---

## Installation

### Option A — Pre-built binary (recommended)

1. Download the latest release zip for your Mac:
   - `hb-task-server-arm64.zip` — Apple Silicon (M1/M2/M3/M4)
   - `hb-task-server-x64.zip` — Intel

2. Unzip into a folder. The zip contains:
   ```
   hb-task-server-arm64     ← the executable (no Node.js required)
   .env.example              ← configuration template
   providers/
   └── reminders-cli/
       └── reminders         ← CLI binary (only needed for reminders-cli provider)
   ```

3. Copy `.env.example` to `.env` and configure:
   ```bash
   cp .env.example .env
   ```
   ```
   PORT=3000
   DEFAULT_PROVIDER=apple
   ```

4. Run the server:
   ```bash
   ./hb-task-server-arm64
   ```

macOS will prompt for Reminders access on the first request — click **OK**.

### Option B — From source

Requires Node.js v18+.

```bash
npm install
npm start
```

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port the server listens on |
| `DEFAULT_PROVIDER` | `apple` | Provider used when none is specified in the request (`apple` or `reminders-cli`) |
| `BRIDGE_URL` | _(unset)_ | WebSocket URL of the UpQ cloud server bridge endpoint (e.g. `wss://your-upq-domain.com/bridge`) |
| `BRIDGE_API_KEY` | _(unset)_ | API key issued by UpQ for this device. If either bridge variable is unset, the bridge is disabled and the server runs standalone. |

---

## UpQ Bridge (optional)

The UpQ cloud server (`hb-task-server-enterprise`) can reach this local server's Apple Reminders data through a persistent outbound WebSocket connection. Because the local server initiates the connection, no inbound port forwarding or firewall changes are needed.

### Setup

1. Log in to your UpQ account and call:
   ```
   POST /auth/bridge/key
   Authorization: Bearer <your-jwt-token>
   ```
   Copy the `apiKey` from the response — it is shown only once.

2. Add to your local `.env`:
   ```
   BRIDGE_URL=wss://your-upq-domain.com/bridge
   BRIDGE_API_KEY=<key from step 1>
   ```

3. Restart `hb-task-server`. On startup it connects to UpQ automatically. You will see:
   ```
   Bridge: connecting to wss://your-upq-domain.com/bridge...
   Bridge: connected to UpQ server
   ```

4. In UpQ, set your default provider to `apple` and your Reminders lists will appear.

### How it works

```
UpQ cloud server  ←──── persistent WebSocket ────  hb-task-server (local)
  /api/lists?provider=apple                           Apple Reminders (macOS)
```

UpQ sends JSON-RPC requests over the socket; the local server executes them against Apple Reminders and returns the results. All Reminders data stays on-device — only task content crosses the connection in response to explicit requests.

---

## Running Automatically (optional)

By default you start the server by hand (`./hb-task-server-arm64`). To have macOS start it at login and restart it automatically if it ever crashes, run:

```bash
./install-launch-agent.sh
```

This registers a standard macOS LaunchAgent for you — see [AUTOSTART.md](AUTOSTART.md) for exactly what it does and how to undo it (`./install-launch-agent.sh --uninstall`).

---

## Provider Setup

### apple (default)

No setup required. On the first API request, macOS will prompt you to grant Reminders access to the terminal app running the server. Click **OK**.

If you accidentally denied it: **System Settings → Privacy & Security → Automation** and enable Reminders access for your terminal app.

### reminders-cli

The `reminders` CLI binary ships in `providers/reminders-cli/`. Before first use:

1. Remove the macOS quarantine attribute:
   ```bash
   xattr -d com.apple.quarantine providers/reminders-cli/reminders
   ```

2. Verify it works:
   ```bash
   providers/reminders-cli/reminders show-lists
   ```

3. Grant permissions when prompted: **System Settings → Privacy & Security → Automation**

---

## API Reference

All endpoints accept an optional `?provider=apple|reminders-cli` query parameter. If omitted, `DEFAULT_PROVIDER` from `.env` is used.

### Health check
```
GET /health
```

### List providers
```
GET /api/providers
```

### Get all Reminders lists
```
GET /api/lists
GET /api/lists?provider=reminders-cli
```

### Get tasks in a list
```
GET /api/lists/:listId/tasks
GET /api/lists/:listId/tasks?showCompleted=true&limit=100
```

### Get a single task
```
GET /api/lists/:listId/tasks/:taskId
```

### Create a task
```
POST /api/lists/:listId/tasks
Content-Type: application/json

{
  "name": "Task title",
  "notes": "Optional notes",
  "dueDate": "2026-03-15"
}
```

### Complete a task
```
PATCH /api/lists/:listId/tasks/:taskId/complete
```

---

## Quick API Test

```bash
# Get all lists
curl http://localhost:3000/api/lists

# Get tasks (use a list ID returned above)
curl "http://localhost:3000/api/lists/LIST_ID/tasks"

# Create a task
curl -X POST "http://localhost:3000/api/lists/LIST_ID/tasks" \
  -H "Content-Type: application/json" \
  -d '{"name": "Call dentist", "notes": "Schedule checkup"}'

# Mark a task complete
curl -X PATCH "http://localhost:3000/api/lists/LIST_ID/tasks/TASK_ID/complete"
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "AppleScript error: Not authorized" | System Settings → Privacy & Security → Automation → enable Reminders for your terminal app |
| "macOS cannot verify that this app is free from malware" (reminders-cli) | `xattr -d com.apple.quarantine providers/reminders-cli/reminders` |
| "Permission denied" on reminders binary | `chmod +x providers/reminders-cli/reminders` |
| Port already in use | Change `PORT` in `.env` and restart |
| Lists or tasks not appearing | Confirm lists and tasks exist in the Reminders app |
| "Bridge: authentication failed" | Regenerate the key in UpQ (`POST /auth/bridge/key`) and update `BRIDGE_API_KEY` in `.env` |
| Bridge connects then immediately disconnects | The API key was revoked in UpQ — regenerate it |
| Bridge logs "connecting…" repeatedly | UpQ server is unreachable — check `BRIDGE_URL` and network connectivity |

---

## Building from Source

See [BUILD.md](BUILD.md) for instructions on producing the self-contained binary using Node.js Single Executable Applications (SEA).

---

## Versioning

Update the version in `package.json` using npm from the project root:

```bash
npm version patch   # bug fix:       1.0.3 → 1.0.4
npm version minor   # new feature:   1.0.3 → 1.1.0
npm version major   # breaking change: 1.0.3 → 2.0.0
```

This updates `package.json` and creates a git tag automatically. Alternatively, edit the `"version"` field in `package.json` directly.

---

## License

Copyright © 2026 HANDSBREADTH LLC. All rights reserved.

**This project is source-available, not open source.** The source code is
publicly viewable, but the software is proprietary and all patent rights are
expressly reserved. See [LICENSE.txt](LICENSE.txt) for the full terms.

**You may:**

- View, clone, and study the source
- Run and use it locally for your own personal or internal business purposes
- Modify it for your own internal use, or to prepare a contribution

**You may not:**

- Redistribute the software or your modifications, in source or binary form
- Host or offer it to third parties as a service
- Use it to build a competing product or service
- Remove or alter proprietary notices

No patent license is granted, whether express, implied, or by estoppel. See
Section 4 of [LICENSE.txt](LICENSE.txt).

For commercial licensing, redistribution rights, or a patent license, write to
the Licensing Department address in Section 13 of [LICENSE.txt](LICENSE.txt).

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before
opening a pull request.

All contributors must sign the [Contributor License Agreement](CLA.md), which
assigns copyright and patent rights in contributions to HANDSBREADTH LLC. A bot
checks this automatically on every pull request.

Found a security issue? Do not open a public issue — see the security section of
[CONTRIBUTING.md](CONTRIBUTING.md).
