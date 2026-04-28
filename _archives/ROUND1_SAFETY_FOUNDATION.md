# DCC Round 1 — Safety Foundation

This patch starts the Drive Cleaner by Clark hardening workflow.

## Focus
- Electron window security baseline
- CSP
- Trusted IPC sender gate
- Main-process payload validation
- System-drive protection for destructive operations
- Child-process output cap
- Installer branding wiring
- DCC audit + build_all workflow

## Apply
Copy these files into the Drive Cleaner project root and overwrite existing files.

## Test
```bat
npm install
npm test
npm start
```

For packaging:
```bat
build_all.bat
```

## Manual safety checks
- Confirm app launches as admin.
- Confirm drives refresh.
- Confirm scan-only works on a safe target.
- Confirm unhide/full clean is blocked on the Windows system drive.
- Confirm format is blocked on the Windows system drive.
- Only test format on disposable media.
