# hb-task-server Build Guide

Produces self-contained native executables using [Node.js Single Executable Applications (SEA)](https://nodejs.org/api/single-executable-applications.html), available in Node.js v20+.

---

## Prerequisites

- **macOS** (required — executables target macOS)
- **Node.js v20+** — `node --version`
- **postject** — injector tool: `npm install -g postject`

---

## Build Steps

Repeat for each target architecture (`arm64` for Apple Silicon, `x64` for Intel).

### 1. Create the SEA config

```json
// sea-config.json
{
  "main": "src/server.js",
  "output": "sea-prep.blob"
}
```

### 2. Generate the blob

```bash
node --experimental-sea-config sea-config.json
```

### 3. Copy the Node.js binary for the target architecture

**arm64 (Apple Silicon):**
```bash
cp $(which node) dist/hb-task-server-arm64
```

**x64 (Intel) — requires an x64 Node.js binary:**
```bash
cp /path/to/node-x64 dist/hb-task-server-x64
```

> To get an x64 Node.js binary on Apple Silicon, download the macOS x64 release from [nodejs.org](https://nodejs.org) and extract the `bin/node` executable.

### 4. Inject the blob

**arm64:**
```bash
npx postject dist/hb-task-server-arm64 NODE_SEA_BLOB sea-prep.blob \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
  --macho-segment-name NODE_SEA
```

**x64:**
```bash
npx postject dist/hb-task-server-x64 NODE_SEA_BLOB sea-prep.blob \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
  --macho-segment-name NODE_SEA
```

### 5. Re-sign the binary

macOS requires binaries to be signed after modification:

```bash
codesign --sign - dist/hb-task-server-arm64
codesign --sign - dist/hb-task-server-x64
```

### 6. Package for distribution

```bash
zip dist/hb-task-server-arm64.zip dist/hb-task-server-arm64
zip dist/hb-task-server-x64.zip dist/hb-task-server-x64
```

---

## Output

| File | Target |
|------|--------|
| `dist/hb-task-server-arm64` | Apple Silicon (M1/M2/M3) |
| `dist/hb-task-server-arm64.zip` | Distributable archive for Apple Silicon |
| `dist/hb-task-server-x64` | Intel Mac |
| `dist/hb-task-server-x64.zip` | Distributable archive for Intel |

---

## Notes

- The `dist/providers/` directory must be distributed alongside the binaries — it contains the `reminders-cli` binary and supporting files.
- The `.env` file is not bundled. Users configure their environment via a `.env` file placed in the same directory as the executable (see [QUICKSTART.md](QUICKSTART.md)).
- The blob (`sea-prep.blob`) is a build artifact and can be deleted after the build.
