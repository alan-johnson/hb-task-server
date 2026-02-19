# hb-task-server™ - Handsbreadth™ Task Server

A REST API server that connects with Apple Reminders, Microsoft Tasks, and Google Tasks, providing task management across all three platforms. It is the server to the Handsbreadth hb-reminders Pebble watch application.

## Features

- ✅ **Apple Reminders** - Native integration via AppleScript (no authentication needed)
- ✅ **Reminders CLI** - Alternative Apple Reminders integration via command-line tool (no authentication needed)
- ✅ Unified REST API for any future providers
- ✅ Get task lists
- ✅ Get tasks within a list
- ✅ Get task details
- ✅ Mark tasks as complete
- ✅ Create new tasks

## Prerequisites

- **macOS** (for Apple Reminders integration)

## Installation

1. **Download from the GitHub Releases**
   ```bash
   cd hb-task-server
   ```

2. **Create a new folder** for the Task Server then copy the downloaded .zip file to the new folder.

3. **Configure environment variables**
   ```bash
   open .env
   ```
   
   Edit `.env` for your port and preferred provider (either `apple` using AppleScript or `reminders-cli`)

## Configuration

### Apple Reminders

No configuration needed! Apple Reminders works out of the box on macOS using AppleScript.

The first time you run the server, macOS may prompt you to grant access to Reminders. Click "OK" to allow access.

### Reminders CLI

An alternative provider for Apple Reminders that uses a command-line interface instead of AppleScript. This can be useful if you encounter issues with AppleScript permissions and is faster.

**Setup:**

1. Open the Terminal application then change the directory to the `providers` directory where you unzipped the **hb-task-server** files.
   ```bash
   cd <folder where you unzipped the files>/providers/reminders-cli
   ```

2. Verify it works and permit access to Apple Reminders:
   ```bash
   reminders show-lists
   ```

## Running the Server

Double-click on the hb-task-server application. This would be `hb-task-server-arm64` for new Macs with Apple Silicon CPUs or `hb-task-server-x64` for older Macs with Intel CPUs.

The server will start on `http://localhost:3000` (or the port specified in your .env file).

## API Documentation

### Authentication

#### Apple Reminders & Reminders CLI
No authentication required. Both work automatically on macOS.

### Endpoints

All endpoints support a `provider` query parameter: `?provider=apple` or `?provider=reminders-cli`

#### Get Available Providers
```bash
GET /api/providers
```

#### Get All Task Lists
```bash
GET /api/lists?provider=apple

# Examples:
curl http://localhost:3000/api/lists?provider=reminders-cli
curl http://localhost:3000/api/lists?provider=apple
```
Response - reminders-cli provider:
```json
{
  "provider":"reminders-cli",
  "lists":[
    {
      "id": "Tasks",
      "name": "Tasks"
    }
  ]
}
```

Response - apple provider:
```json
{
  "provider": "apple",
  "lists": [
    {
      "id": "x-apple-reminder://...",
      "name": "Personal"
    },
    {
      "id": "x-apple-reminder://...",
      "name": "Work"
    }
  ]
}
```

#### Get Tasks in a List
```bash
GET /api/lists/:listId/tasks?provider=apple
GET /api/lists/:listId/tasks?provider=reminders-cli

# Example:
curl "http://localhost:3000/api/lists/x-apple-reminder://ABC123/tasks?provider=apple"
```
Response - reminders-cli provider:
```json
{
  "provider":"reminders-cli",
  "listId":"PersonalExample",
  "count":1,
  "limit":50,
  "showCompleted":false,
  "tasks":
  [
    {
      "id": "93C41131-E8B1-4762-9E8F-FB4918C78AB3",
      "name": "Condo window dimensions",
      "completed": false,
      "notes": "This is a notes example. Max 255 characters",
      "dueDate": null,
      "priority": 5,
      "index": 0
    }
  ]
}
```

Response - apple provider:
```json
{
  "provider": "apple",
  "listId": "x-apple-reminder://ABC123",
  "tasks": [
    {
      "id": "x-apple-reminder://ABC123/DEF456",
      "name": "Buy groceries",
      "completed": false,
      "notes": "Milk, eggs, bread",
      "dueDate": "2026-02-05"
    }
  ]
}
```

#### Get Task Details
```bash
GET /api/lists/:listId/tasks/:taskId?provider=reminders-cli
GET /api/lists/:listId/tasks/:taskId?provider=apple

# Example:
curl "http://localhost:3000/api/lists/Personal/tasks/93C41131-E8B1-4762-9E8F-FB4918C78AB3?provider=reminders-cli"
curl "http://localhost:3000/api/lists/x-apple-reminder://ABC123/tasks/x-apple-reminder://ABC123/DEF456?provider=apple"
```

#### Create a New Task
```bash
POST /api/lists/:listId/tasks?provider=apple
Content-Type: application/json

{
  "name": "New task",
  "notes": "Task description",
  "dueDate": "2026-02-10"
}

# Example:
curl -X POST "http://localhost:3000/api/lists/x-apple-reminder://ABC123/tasks?provider=apple" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Call dentist",
    "notes": "Schedule annual checkup"
  }'
```

#### Mark Task as Complete
```bash
PATCH /api/lists/:listId/tasks/:taskId/complete?provider=apple

# Example:
curl -X PATCH "http://localhost:3000/api/lists/x-apple-reminder://ABC123/tasks/x-apple-reminder://ABC123/DEF456/complete?provider=apple"
```

Response:
```json
{
  "provider": "apple",
  "listId": "x-apple-reminder://ABC123",
  "taskId": "x-apple-reminder://ABC123/DEF456",
  "success": true,
  "message": "Task marked as complete"
}
```

## Usage Examples

### Using with curl

```bash
# Get all lists from Apple Reminders
curl http://localhost:3000/api/lists?provider=apple

# Get all lists using the reminders CLI
curl http://localhost:3000/api/lists?provider=reminders-cli

# Complete a task using reminders CLI
curl -X PATCH \
  "http://localhost:3000/api/lists/Reminders/tasks/51951E24-3DC1-4835-9DEE-E8FEEE440550/complete?provider=reminders-cli"
```

### Using with JavaScript/Fetch

```javascript
// Get lists
const response = await fetch('http://localhost:3000/api/lists?provider=reminders-cli');
const data = await response.json();
console.log(data.lists);

// Create a task
const createTask = await fetch(
  'http://localhost:3000/api/lists/LIST_ID/tasks?provider=reminders-cli',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'New Task',
      notes: 'Task description'
    })
  }
);
const newTask = await createTask.json();

// Mark as complete
await fetch(
  `http://localhost:3000/api/lists/LIST_ID/tasks/${newTask.task.id}/complete?provider=reminders-cli`,
  { method: 'PATCH' }
);
```

## Troubleshooting

### Apple Reminders

**Problem:** "AppleScript error: Not authorized"
- **Solution:** Grant Terminal access to Reminders in System Settings > Privacy & Security > Automation

**Problem:** Lists or tasks not appearing
- **Solution:** Make sure you have lists and tasks in the Reminders app

### Reminders CLI

**Problem:** "macOS cannot verify that this app is free from malware"
- **Solution:** Run `xattr -d com.apple.quarantine src/providers/reminders-cli/reminders`

**Problem:** "Permission denied"
- **Solution:** Run `chmod +x src/providers/reminders-cli/reminders`

**Problem:** "Command failed" or "No reminder found"
- **Solution:** Make sure the list name is correct (case-sensitive) and grant permissions in System Settings > Privacy & Security > Automation

## Architecture

```
hb-task-server/
├── src/
│   ├── server.js                 # Main Express server
│   └── providers/
│       ├── apple/
│       │   ├── apple.js          # Apple Reminders provider (AppleScript)
│       │   └── README.md         # Apple provider documentation
│       └── reminders-cli/
│           ├── reminders-cli.js  # Reminders CLI provider
│           ├── reminders         # CLI executable
│           └── README.md         # CLI provider documentation
│       
├── package.json
├── .env.example
└── README.md
```

## Security Considerations

This is a personal server. We advise not to expose the hb-task-server™ to the internet which could put your information at risk.

## License

MIT

## Contributing

Feel free to submit issues and enhancement requests!
