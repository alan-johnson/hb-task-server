# hb-task-server Quick Start

## Prerequisites

- **macOS** (required for Apple Reminders integration)

---

## Installation

1. **Download** the latest release from GitHub Releases.
2. **Create a folder** for the Task Server, then copy the downloaded `.zip` file into it and unzip it.
3. **Configure** the environment file:
   ```bash
   open .env
   ```
   Set your preferred port and provider (`apple` or `reminders-cli`):
   ```
   PORT=3000
   DEFAULT_PROVIDER=apple
   ```

---

## Running the Server

Double-click the **hb-task-server** application:

- `hb-task-server-arm64` — Apple Silicon Macs (M1/M2/M3)
- `hb-task-server-x64` — Intel Macs

The server starts at `http://localhost:3000` (or the port set in `.env`).

---

## Provider Setup

### Apple Reminders (default)

No setup needed. On the first request, macOS will prompt you to grant Reminders access — click **OK**.

If you accidentally denied it: **System Settings → Privacy & Security → Automation** and enable access for your Terminal app.

### Reminders CLI (alternative)

Faster than AppleScript and useful if you have AppleScript permission issues.

1. Open Terminal and navigate to the provider folder:
   ```bash
   cd <folder where you unzipped>/providers/reminders-cli
   ```
2. Verify access and grant permissions:
   ```bash
   reminders show-lists
   ```

---

## Quick API Test

```bash
# Get all task lists
curl http://localhost:3000/api/lists?provider=apple

# Get tasks from a list (use an ID returned above)
curl "http://localhost:3000/api/lists/LIST_ID/tasks?provider=apple"

# Create a task
curl -X POST "http://localhost:3000/api/lists/LIST_ID/tasks?provider=apple" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test task", "notes": "Created via API"}'

# Mark a task complete
curl -X PATCH "http://localhost:3000/api/lists/LIST_ID/tasks/TASK_ID/complete?provider=apple"
```

---

## API Endpoints

```
GET    /api/providers
GET    /api/lists?provider=apple|reminders-cli
GET    /api/lists/:listId/tasks?provider=apple|reminders-cli
GET    /api/lists/:listId/tasks/:taskId?provider=apple|reminders-cli
POST   /api/lists/:listId/tasks?provider=apple|reminders-cli
PATCH  /api/lists/:listId/tasks/:taskId/complete?provider=apple|reminders-cli
```

---

## Connect to UpQ (optional)

If you have an UpQ account and want your Reminders accessible from the UpQ web dashboard:

1. Log in to UpQ and generate a bridge API key:
   ```
   POST /auth/bridge/key
   ```
2. Add the returned key and your UpQ server address to `.env`:
   ```
   BRIDGE_URL=wss://your-upq-domain.com/bridge
   BRIDGE_API_KEY=<key>
   ```
3. Restart the server. It connects to UpQ automatically in the background.

See [README.md](README.md) for full details.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| "AppleScript error: Not authorized" | System Settings → Privacy & Security → Automation → enable Terminal |
| "macOS cannot verify that this app is free from malware" | Run `xattr -d com.apple.quarantine providers/reminders-cli/reminders` |
| "Permission denied" on reminders binary | Run `chmod +x providers/reminders-cli/reminders` |
| Port already in use | Change `PORT` in `.env` and restart the server |

For full documentation, see [README.md](README.md).
