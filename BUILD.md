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

### 4. Copy and prepare the Node.js binary

Strip the existing signature and extended attributes before injecting the blob.

**arm64 (Apple Silicon):**
```bash
cp $(which node) build/hb-task-server-arm64
chmod u+w build/hb-task-server-arm64
xattr -c build/hb-task-server-arm64
codesign --remove-signature build/hb-task-server-arm64
```

**x64 (Intel) — requires an x64 Node.js binary:**
```bash
cp /path/to/node-x64 build/hb-task-server-x64
chmod u+w build/hb-task-server-x64
xattr -c build/hb-task-server-x64
codesign --remove-signature build/hb-task-server-x64
```

> If the Node.js binary is a universal (fat) binary, thin it first:
> ```bash
> lipo -thin arm64 $(which node) -output build/hb-task-server-arm64
> ```

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

Each distributable zip should include the binary, providers, and supporting files:

```bash
# arm64 example — repeat for x64
mkdir -p build/.zip-staging-arm64
cp build/hb-task-server-arm64 build/.zip-staging-arm64/
cp build/.env.example build/.zip-staging-arm64/.env.example
cp QUICKSTART.md build/.zip-staging-arm64/README.txt
cp LICENSE.txt build/.zip-staging-arm64/LICENSE.txt
cp com.handsbreadth.hb-task-server.plist build/.zip-staging-arm64/
cp -r build/providers build/.zip-staging-arm64/providers
(cd build/.zip-staging-arm64 && zip -r ../hb-task-server-arm64.zip .)
rm -rf build/.zip-staging-arm64
```

---

## Output

| File | Target |
|------|--------|
| `build/hb-task-server-arm64` | Apple Silicon (M1/M2/M3/M4) |
| `build/hb-task-server-arm64.zip` | Distributable archive for Apple Silicon |
| `build/hb-task-server-x64` | Intel Mac |
| `build/hb-task-server-x64.zip` | Distributable archive for Intel |
| `build/providers/` | Provider files |
| `build/.env.example` | Environment config template |

Each `.zip` contains the binary, `providers/`, `.env.example`, `README.txt`, `LICENSE.txt`, and `com.handsbreadth.hb-task-server.plist`.

---

## GitHub Release Process

Requires the [GitHub CLI](https://cli.github.com) (`gh`), authenticated to the repo.

### 1. Bump the version

Update `"version"` in `package.json`, then commit and push:

```bash
git add package.json
git commit -m "bump version to 1.x.x"
git push
```

### 2. Build the artifacts

```bash
npm run build
```

For a full release (both architectures), also build the x64 binary on an Intel Mac or via cross-compilation:

```bash
NODE_X64=/path/to/node-x64 npm run build
```

### 3. Tag the release

```bash
git tag v1.x.x
git push origin v1.x.x
```

### 4. Create the GitHub release

Use `RELEASE_NOTES.md` as the release body and attach the zip artifacts:

```bash
gh release create v1.x.x \
  --title "v1.x.x" \
  --notes-file RELEASE_NOTES.md \
  build/hb-task-server-arm64.zip \
  build/hb-task-server-x64.zip
```

Omit the `x64` zip if only building for Apple Silicon.

> The release body (`RELEASE_NOTES.md`) is shown verbatim on the GitHub Releases page and inside the zip as `README.txt`.

---

## Notes

- The `build/providers/` directory contains the `reminders-cli` binary and supporting files. It is automatically bundled into each distributable zip by the build script.
- The `.env` file is not bundled. Users configure their environment via a `.env` file placed in the same directory as the executable (see [QUICKSTART.md](QUICKSTART.md)).
- The blob (`sea-prep.blob`) is a temporary build artifact — the build script removes it automatically.
