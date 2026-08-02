# Running hb-task-server Automatically (Optional)

By default you start the server by hand each time:

```bash
./hb-task-server-arm64
```

That's completely fine for casual use. If you'd rather it just start on its own — every login, and again automatically if it ever crashes — this page covers the one-command way to set that up.

**This is entirely optional.** Nothing else about the server changes if you skip it.

---

## What this actually is

macOS has a built-in mechanism called **`launchd`** for running background services — it's what starts things like Spotlight indexing or iCloud sync. You register a service with it using a small XML file (a **LaunchAgent**, `.plist`), and `launchd` takes care of starting it, restarting it if it dies, and starting it again the next time you log in.

This release ships a template LaunchAgent file: `com.handsbreadth.hb-task-server.plist`. It can't be used as-is — it has placeholder text (`YOUR_USERNAME`) instead of your actual Mac username and the actual folder you unzipped the server into, because `launchd` requires a real, fully-written-out path.

`install-launch-agent.sh` fills in those placeholders for you and registers the result with `launchd`. That's the entire script — it doesn't touch the server's code or behavior, it just automates the manual edit-the-plist-and-run-launchctl steps a user would otherwise have to do by hand.

## What running it does, step by step

1. Looks in its own folder for the `hb-task-server-arm64` (or `-x64`) binary, to confirm it's being run from an actual unzipped release.
2. Copies `com.handsbreadth.hb-task-server.plist`, replacing the placeholder paths with:
   - the real path to the binary it just found,
   - the real folder you unzipped the server into (used as the working directory),
   - your real home folder (for the crash/startup log path).
3. Writes that filled-in copy to `~/Library/LaunchAgents/com.handsbreadth.hb-task-server.plist` — the standard place macOS looks for a per-user background service.
4. Runs `launchctl load -w` on it, which tells `launchd` to start the server now and remember to start it again at every future login.

## What changes for you afterward

- The server starts automatically the next time you log in — no need to open Terminal and run it yourself.
- If the server process ever crashes, `launchd` restarts it within a few seconds (`KeepAlive` in the plist).
- Startup messages and anything the server prints outside its own log file (crash traces, for instance) land in `~/Library/Logs/hb-task-server.log`. The server's own request/connection logs still go to the `logs/` folder next to the binary, exactly as before — this is a separate, secondary log for the process itself.
- You won't see a Terminal window for it anymore; it runs invisibly in the background. To confirm it's running:
  ```bash
  launchctl list | grep com.handsbreadth.hb-task-server
  ```

## Running it

```bash
cd <the folder you unzipped the server into>
./install-launch-agent.sh
```

If you ever move the folder to a different location, just run it again from the new location — it re-registers with the corrected path.

## Undoing it

```bash
./install-launch-agent.sh --uninstall
```

This unloads the LaunchAgent and removes it from `~/Library/LaunchAgents/`. It does **not** delete the server binary, your `.env`, or anything in `logs/` — it only turns off the auto-start/auto-restart behavior. Afterward you're back to starting the server manually.
