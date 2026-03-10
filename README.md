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

---

## Building from Source

See [BUILD.md](BUILD.md) for instructions on producing the self-contained binary using Node.js Single Executable Applications (SEA).

---

## License

Copyright © 2026 Handsbreadth Software LLC. All rights reserved.
