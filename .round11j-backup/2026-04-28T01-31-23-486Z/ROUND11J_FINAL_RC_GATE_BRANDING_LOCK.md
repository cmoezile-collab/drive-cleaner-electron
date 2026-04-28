# DCC Round 11J - Final RC Gate + Branding Lock

This patch fixes the RC/doctor blocker without changing the app UI or the final DCC icon.

## What changed

- Replaces `scripts/dcc-rc-check.js` with an ASCII-only RC gate.
- Replaces `scripts/dcc-doctor.js` with an ASCII-only doctor check.
- Removes brittle checks that failed only because `build_all.bat` now runs `npm run test:rc` instead of literal `npm test` / `npm run doctor` strings.
- Keeps the real safety checks:
  - format allowlist is removable-only
  - system drive format blocking
  - typed drive challenge
  - renderer challenge modal
  - child-process output cap
  - renderer log cap
  - Electron IPC/security hygiene
- Keeps DCC branding locked:
  - `scripts/generate-icon.ps1` verifies and preserves canonical assets
  - installer BMPs are copied from `assets/` to `build/`
  - no old icon regeneration routine
- Updates `build_all.bat` so branding is locked before RC tests and again before packaging.

## Apply

From the DCC project root:

```bat
node apply_round11J_final_gate_branding_lock.js
npm run branding:lock
npm run doctor
npm run test:rc
build_all.bat
```

If anything fails, read the `[FAIL]` line directly above the summary. The gate now tells you exactly what failed.
