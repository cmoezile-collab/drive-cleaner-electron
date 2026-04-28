# DCC Round 4C Drive Doctor

This package does not change the app. It adds a standalone diagnostic harness to identify whether drive loading is failing in Windows enumeration, Electron IPC, or the renderer.

## Files

- `scripts/dcc-drive-doctor.js`
- `run_dcc_drive_doctor.bat`

## Run

Copy these into the Drive Cleaner project root, then run:

```bat
run_dcc_drive_doctor.bat
```

The script writes a timestamped log to:

```text
logs\dcc-drive-doctor-*.txt
```

## How to interpret

- If the doctor shows drives, but DCC still shows none, the OS enumeration works and the bug is in app IPC/renderer handling.
- If the doctor shows no drives, the issue is lower-level: PowerShell/WMIC/system environment/admin context.

Send the full output or the generated log after running it.
