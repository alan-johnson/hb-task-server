# Contributing to hb-task-server

Thanks for your interest in the project. Contributions are welcome, and this
guide covers what you need to know before opening a pull request.

## Read this first

**This is not an open source project.** The source is publicly viewable under a
source-available license, but it is proprietary software owned by HANDSBREADTH
LLC. Two consequences matter for contributors:

1. **Contributions are assigned to Handsbreadth.** By submitting a pull request
   you assign copyright and patent rights in your contribution to Handsbreadth.
   You must sign the [CLA](CLA.md) before your PR can be merged.
2. **All patent rights are reserved.** Nothing in the license, and nothing about
   having a PR merged, grants you any patent license. See Section 4 of
   [LICENSE.txt](LICENSE.txt).

You may clone the repo, run it locally, and modify it for your own internal use.
You may **not** redistribute it, host it as a service, or use it to build a
competing product. Full terms in [LICENSE.txt](LICENSE.txt).

If those terms don't work for you, please don't submit a contribution — no hard
feelings, and bug reports are still very welcome.

---

## Signing the CLA

Every contributor must sign the [Contributor License Agreement](CLA.md) once.
After you open your first PR, comment on it with exactly:

```
I have read the CLA Document and I hereby sign the CLA
```

The CLA bot records your signature against your GitHub account and it covers all
your future contributions. If you're contributing on behalf of an employer, use
the Entity signature block in Schedule A of the CLA and make sure whoever signs
is authorized to bind the company.

---

## Before you start

**Open an issue first** for anything beyond a small fix. This saves you from
building something that doesn't fit the project's direction. Handsbreadth is
under no obligation to merge any contribution, and a heads-up avoids wasted work
on both sides.

Small, self-contained PRs get reviewed faster than large ones. If a change
touches the provider interface, the bridge, or the build, discuss it in an issue
before writing code.

### Good candidates

- Bug fixes with a clear reproduction
- New task providers — **open an issue first**, see scope below
- Error handling and input validation improvements
- Documentation fixes and clarifications
- macOS compatibility fixes

### Out of scope

This project's scope is **Apple Reminders, exposed over a local REST API**.

- **Google Tasks and Microsoft To Do providers are not planned.** Earlier issues
  proposing them were closed as out of scope; PRs adding them will not be
  merged.
- New providers for other systems are considered case by case, but are not
  automatically welcome. Open an issue and get agreement before writing code —
  each provider is ongoing maintenance and permissions surface, so demand has to
  justify it.

### Please discuss first

- New API endpoints or changes to existing request/response shapes
- Changes to the bridge protocol in [src/bridge.js](src/bridge.js)
- Build system changes — the SEA build is finicky, see [BUILD.md](BUILD.md)
- New runtime dependencies (they all get bundled into the executable)

---

## Development setup

**Requirements:** macOS, and Node.js v20+ **from [nodejs.org](https://nodejs.org)**.

> Homebrew's Node.js will not work for builds — it strips the SEA fuse. Regular
> development is fine, but `npm run build` will fail.

```bash
git clone https://github.com/<owner>/hb-task-server.git
cd hb-task-server
npm install
cp .env.example .env
npm run dev          # nodemon, restarts on save
```

The server listens on `http://localhost:3000` by default. On the first request
macOS prompts for Reminders access — approve it, or the Apple provider fails.

To verify things work:

```bash
curl http://localhost:3000/api/providers
curl http://localhost:3000/api/lists?provider=apple
```

To build native executables:

```bash
npm install -g postject   # required, and don't use npx — it hangs
npm run build             # output in build/
```

See [BUILD.md](BUILD.md) for the full build story including cross-compiling x64.

---

## Project layout

```
src/
├── server.js                      Express app, routes, provider registry
├── bridge.js                      Outbound WebSocket client (UpQ integration)
├── logger.js                      Logging helpers
└── providers/
    ├── apple/apple.js             AppleScript provider (default)
    └── reminders-cli/             CLI-binary provider
```

---

## Adding a provider

Providers are classes with a common interface. To add one:

1. Create `src/providers/<name>/<name>.js` exporting a class with these methods:

   ```js
   async getLists()
   async getTasks(listId, options = {})
   async getTask(listId, taskId)
   async createTask(listId, taskData)
   async updateTask(listId, taskId, taskData)
   async completeTask(listId, taskId)
   async deleteTask(listId, taskId)
   ```

   Use [src/providers/apple/apple.js](src/providers/apple/apple.js) as the
   reference implementation.

2. Register it in the `providers` map in [src/server.js](src/server.js), and add
   its name to the list returned by `GET /api/providers`.

3. Add a `README.md` in the provider folder describing any setup or permissions
   it needs.

4. Document it in the provider table in [README.md](README.md).

Return shapes must match the existing providers — the API contract is
provider-agnostic and clients depend on that.

---

## Coding conventions

Match the surrounding code. The existing style is:

- CommonJS (`require`, `module.exports`) — **not** ESM. The SEA build depends on
  this.
- Two-space indentation, semicolons, single quotes.
- `async`/`await` over promise chains.
- Errors thrown with useful messages; the route layer converts them to HTTP
  responses.
- Log through [src/logger.js](src/logger.js) rather than `console.log`.

Keep new dependencies to a minimum — everything gets bundled into the shipped
executable, so each one adds weight and build risk.

---

## Testing

There's no automated test suite yet. Before opening a PR, verify manually against
both providers:

```bash
npm start

curl http://localhost:3000/api/providers
curl "http://localhost:3000/api/lists?provider=apple"
curl "http://localhost:3000/api/lists/LIST_ID/tasks?provider=apple"

curl -X POST "http://localhost:3000/api/lists/LIST_ID/tasks?provider=apple" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test task", "notes": "Created via API"}'

curl -X PATCH "http://localhost:3000/api/lists/LIST_ID/tasks/TASK_ID/complete?provider=apple"
```

Repeat with `provider=reminders-cli`. Say in your PR description what you tested
and on which macOS version and chip (Apple Silicon or Intel).

Contributions that add a real test harness are welcome — open an issue to discuss
the approach first.

---

## Pull request process

1. Branch from `main` with a descriptive name (`fix/applescript-escaping`,
   `feat/todoist-provider`).
2. Keep the PR focused on one thing.
3. Update the docs — [README.md](README.md), [QUICKSTART.md](QUICKSTART.md), or
   [BUILD.md](BUILD.md) — when behavior changes.
4. Write a clear PR description: what changed, why, and how you tested it.
5. Sign the CLA (see above) if you haven't already.
6. Be ready for review feedback.

Do **not** include in a PR:

- `.env` files, API keys, bridge keys, or any other credential
- `node_modules/`, `build/`, `dist/`, or `.DS_Store`
- Personal Reminders data, list IDs, or task content from your own account
- Unrelated reformatting that buries the actual change

Commits are squashed on merge, so don't worry about polishing history.

---

## Reporting bugs

Open an issue with:

- macOS version and chip (Apple Silicon / Intel)
- How you're running it: `npm start` from source, or a release binary
- Which provider (`apple` or `reminders-cli`)
- Steps to reproduce, expected vs. actual behavior
- Relevant log output

**Redact before posting.** Logs and API responses can contain your actual task
content and bridge credentials. Scrub `BRIDGE_API_KEY` and anything personal.

---

## Security issues

**Do not open a public issue for a security vulnerability.** Email the address in
[LICENSE.txt](LICENSE.txt) Section 13 with details and reproduction steps, and
allow reasonable time for a fix before disclosing publicly.

Note that this server exposes your Apple Reminders over local HTTP, and the
bridge makes an outbound authenticated WebSocket connection. Findings in either
area are taken seriously.

---

## Questions

Open an issue for technical questions. For licensing questions — commercial use,
redistribution, or a patent license — write to the Licensing Department address
in [LICENSE.txt](LICENSE.txt) Section 13. Requests must be in writing; informal
approvals aren't binding.
