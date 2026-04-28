# DCC 1.0 RC Checklist

## Automated gates

Run these from the project root before packaging:

```bat
npm install
npm test
npm run doctor
npm run build:win:rc
```

Or use:

```bat
build_all.bat
```

## Manual safety checks

- Launch the app and approve administrator elevation.
- Confirm **STATUS** opens and copies a report cleanly.
- Confirm drives load in the target dropdown.
- Select the Windows system drive and confirm only Scan is allowed.
- Select a fixed non-system drive and confirm Format is blocked.
- Select a removable disposable drive and confirm guarded Format is available.
- Confirm Format requires two confirmations and the exact typed drive ID.
- Confirm Stop Task is enabled during an active task.
- Confirm Copy Active Log, Copy Clean Log, and Copy Format Log work.
- Confirm Reset UI Preferences does not start any operation.

## Packaged build checks

- Test the portable EXE from `dist`.
- Test the setup installer from `dist`.
- Confirm installed app still requests/admin-runs correctly.
- Confirm installer header/sidebar branding appears correctly.
- Confirm the installed app detects drives and preserves safety rules.
- Uninstall and confirm the app removes cleanly.

## Release freeze

Once this checklist passes, freeze DCC 1.0 RC. New feature ideas go to DCC 1.1.
