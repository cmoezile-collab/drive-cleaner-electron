# DCC Round 4 — Operation Hardening + Log Utility

This pass tightens DCC before deeper UI/branding work.

## Changes

- Formatting is now limited to removable drives in this release.
- Fixed/internal non-system drives may still be scanned, unhidden, or full-cleaned, but format is blocked.
- Main-process format validation now enforces the same removable-only policy as the renderer.
- Format confirmation now shows target drive ID, type, label, size, filesystem, format type, and volume label before the final challenge.
- Fixed duplicate `Guarded format` text in the allowed-action banner.
- Added `COPY ACTIVE LOG` so clean/format logs can be copied for troubleshooting.
- Added visible log capping to prevent unlimited DOM growth during long scans.
- Audit expanded to cover the new safety and utility checks.

## Test

Run:

```bat
npm test
npm start
```

Manual checks:

1. Select C: and confirm scan-only remains.
2. Select a non-system fixed drive if present and confirm format is blocked.
3. Select a removable drive and confirm guarded format is available.
4. Confirm the allowed-action banner does not repeat `Guarded format`.
5. Add a few log entries and test `COPY ACTIVE LOG`.
