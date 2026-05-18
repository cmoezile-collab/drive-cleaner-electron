# DCC Round 7 — RC Stabilization

This round adds release-candidate discipline around Drive Cleaner by Clark without changing destructive-operation behavior.

## Added

- `scripts/dcc-doctor.js` for local environment, package, security, safety, and installer sanity checks.
- `scripts/dcc-rc-check.js` for release-candidate gates.
- `RC_CHECKLIST.md` for final manual QA before packaging.
- `npm run doctor`, `npm run test:doctor`, `npm run build:win:rc`.
- `build_all.bat` now runs doctor checks and uses the gated RC build command.

## Safety behavior

No safety policies were loosened. Formatting remains limited to removable drives and still requires the exact typed drive-ID challenge.
