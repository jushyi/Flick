---
status: resolved
trigger: "EAS build fails with 'Stripping types is currently unsupported for files under node_modules' error"
created: 2026-03-18T00:00:00Z
updated: 2026-03-18T00:00:00Z
---

## Resolution

root_cause: Two Node 22+ incompatibilities with Expo SDK 54:
1. **expo-modules-core** publishes `"main": "src/index.ts"` — Node 22+ type stripping rejects .ts in node_modules
2. **expo-screen-capture** has no `app.plugin.js` and its ESM-syntax build output fails Node 24's require_module resolution (extensionless imports)

fix: Two patch-package patches that persist across npm install:
1. `expo-modules-core+3.0.29.patch` — Adds `"node"` condition in exports map pointing to `node-compat.js` (empty CJS stub). Metro ignores the `node` condition and still uses `src/index.ts`.
2. `expo-screen-capture+8.0.9.patch` — Adds `app.plugin.js` (no-op config plugin using `createRunOncePlugin`). Native code is autolinked via `expo-module.config.json` regardless.

verification: `npx expo config --json` exits 0 on Node v24.11.1. User to verify `eas build` succeeds.
files_changed: [patches/expo-modules-core+3.0.29.patch, patches/expo-screen-capture+8.0.9.patch, .nvmrc, .node-version]

## Upstream

Known issue: expo/expo#36683. Will be resolved when Expo publishes compiled JS entry points instead of raw TypeScript.
