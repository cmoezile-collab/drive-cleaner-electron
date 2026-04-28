# DCC Round 4D - Drive UI Binding Hotfix

## Problem
The STATUS report can see drives, but the drive selector stays empty.

That means the backend enumeration is working. The bug is in the renderer binding: one IPC path is returning a wrapped object response while the renderer still expects a plain array.

## Fix
This patch updates `renderer.js` in place by adding:

- `unwrapAppResponse()`
- `normalizeDriveListResponse()`
- normalized drive handling in `populateDrives()`
- normalized drive handling after `refreshDrives()`
- a visible bootstrap failure path

It creates a timestamped backup before writing.

## Apply
From the DCC project root:

```bat
node apply_round4D_drive_ui_binding_hotfix.js
npm test
npm start
```

Or double-click:

```bat
apply_round4D_drive_ui_binding_hotfix.bat
```

## Expected result
The same drives shown in STATUS should now appear in the Connected Drives dropdown.
