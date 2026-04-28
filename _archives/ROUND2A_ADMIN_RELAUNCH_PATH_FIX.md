# DCC Round 2A - Admin Relaunch Path Fix

## Fix
DCC failed to relaunch as administrator when the project path contained spaces, such as:

```text
E:\Code_HQ\Drive Cleaner by Clark
```

PowerShell `Start-Process -ArgumentList` was receiving the Electron app path without preserved command-line quoting, so Electron tried to launch:

```text
E:\Code_HQ\Drive
```

instead of the full folder path.

## Change
- Added `quoteWindowsProcessArg()` in `main.js`.
- Admin relaunch now wraps each Electron argument in explicit Windows command-line quotes before passing it to `Start-Process`.
- Updated `scripts/dcc-audit.js` to check for the fix.

## Test
Run:

```bat
npm test
npm start
```

When Windows asks for administrator approval, accept it. DCC should relaunch from the full project path correctly.
