# DCC Final Global QA Checklist - Round 11Q

Run this from the DCC project root:

```bat
npm run branding:lock
npm run test:rc
npm run test:global
npm run start
```

## Visual QA

- Header logo appears sharp and centered.
- `DRIVE CLEANER | by Clark` is not clipped.
- Subtitle reads `UNHIDE · SCAN · FORMAT · PROTECT` and has breathing room.
- Left sidebar cards have visible vertical spacing.
- Footer action buttons are centered vertically and horizontally.
- Dark mode, light mode, and accent changes do not leak old gold/yellow styling except inside fixed bitmap/logo assets.
- Window at 1280x860 looks clean.
- Window at minimum size still keeps controls usable.

## Interaction QA

- Refresh Drives works.
- Target banner updates when drive selection changes.
- System drive blocks unhide, full clean, and format.
- Fixed drive blocks format.
- Removable drive allows guarded format.
- Clean buttons disable while a task is running.
- Stop button enables during a running task.
- Copy Active Log and Clear Active Log work.
- Status report opens, copies, and closes.
- Settings tab controls persist safely.

## Format safety QA

- Format warning is visible.
- Format requires confirmation.
- Format requires exact drive ID typed.
- Canceling format performs no action.
- Only test real formatting on an expendable removable drive.

## Build QA

- `npm run branding:lock` passes.
- `npm run test:rc` passes.
- `npm run test:global` passes.
- `build_all.bat` runs gate checks before packaging.
- Installer header/sidebar show the final DCC branding.
- Installed app icon, portable app icon, and taskbar icon show final DCC branding.

## Release note

A clean static audit is not the same as a full manual QA pass. Treat the final global check as the gatekeeper, then do the visual/behavior checklist once in dev and once in the packaged app.
