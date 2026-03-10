# hb-task-server Build Guide

Produces self-contained native executables using [Node.js Single Executable Applications (SEA)](https://nodejs.org/api/single-executable-applications.html), available in Node.js v20+.

---

## Prerequisites

- **macOS** (required — executables target macOS)
- **Node.js v20+ from [nodejs.org](https://nodejs.org)** — `node --version`
  > **Homebrew Node.js is not supported.** Homebrew strips the SEA fuse from its Node.js builds, causing the build to fail. Install Node.js from nodejs.org and ensure it appears first on your `PATH`.
- **postject** — must be installed globally (not via `npx`, which will hang):
  ```bash
  npm install -g postject
  ```
- **esbuild** — installed automatically via `npm install` (listed in `devDependencies`)
  > Node.js SEA's `require()` only supports built-in modules. esbuild bundles the app and all third-party dependencies into a single file before the SEA blob is generated.

---

## Using the Build Script

The easiest way to build is with the included script, which automates all steps below:

```bash
npm run build
# or directly:
./build.sh
```

Output is written to `build/`. To cross-compile x64 on Apple Silicon, set `NODE_X64` to an x64 Node.js binary:

```bash
NODE_X64=/path/to/node-x64 npm run build
```

> To get an x64 Node.js binary on Apple Silicon, download the macOS x64 release from [nodejs.org](https://nodejs.org) and extract the `bin/node` executable.

---

## Manual Build Steps

Repeat for each target architecture (`arm64` for Apple Silicon, `x64` for Intel).

### 1. Bundle the application

Node.js SEA's `require()` only supports built-in modules, so all third-party dependencies must be inlined first:

```bash
./node_modules/.bin/esbuild src/server.js --bundle --platform=node --outfile=server.bundle.js
```

### 2. Create the SEA config

```json
// sea-config.json
{
  "main": "server.bundle.js",
  "output": "sea-prep.blob"
}
```

### 3. Generate the blob

```bash
node --experimental-sea-config sea-config.json
```

### 4. Copy the Node.js binary for the target architecture

**arm64 (Apple Silicon):**
```bash
cp $(which node) build/hb-task-server-arm64
```

**x64 (Intel) — requires an x64 Node.js binary:**
```bash
cp /path/to/node-x64 build/hb-task-server-x64
```

### 5. Inject the blob

Use `postject` directly — do not use `npx postject`, as it will hang if the package is not already installed globally.

**arm64:**
```bash
postject build/hb-task-server-arm64 NODE_SEA_BLOB sea-prep.blob \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
  --macho-segment-name NODE_SEA
```

**x64:**
```bash
postject build/hb-task-server-x64 NODE_SEA_BLOB sea-prep.blob \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
  --macho-segment-name NODE_SEA
```

### 6. Re-sign the binary

macOS requires binaries to be signed after modification:

```bash
codesign --sign - build/hb-task-server-arm64
codesign --sign - build/hb-task-server-x64
```

### 7. Package for distribution

```bash
zip -j build/hb-task-server-arm64.zip build/hb-task-server-arm64
zip -j build/hb-task-server-x64.zip build/hb-task-server-x64
```

---

## Output

| File | Target |
|------|--------|
| `build/hb-task-server-arm64` | Apple Silicon (M1/M2/M3) |
| `build/hb-task-server-arm64.zip` | Distributable archive for Apple Silicon |
| `build/hb-task-server-x64` | Intel Mac |
| `build/hb-task-server-x64.zip` | Distributable archive for Intel |
| `build/providers/` | Provider files (must be distributed alongside binaries) |
| `build/.env.example` | Environment config template |

---

## Notes

- The `build/providers/` directory must be distributed alongside the binaries — it contains the `reminders-cli` binary and supporting files.
- The `.env` file is not bundled. Users configure their environment via a `.env` file placed in the same directory as the executable (see [QUICKSTART.md](QUICKSTART.md)).
- The blob (`sea-prep.blob`) is a temporary build artifact — the build script removes it automatically.
