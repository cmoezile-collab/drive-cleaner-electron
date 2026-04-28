# DCC Round 7B — Settings Restore Hotfix

Round 7 RC stabilization accidentally shipped UI files from the pre-Settings branch. That removed the Settings sidebar entry and panel even though the backend/RC scripts were fine.

This hotfix restores the Round 6 Settings UI while keeping the Round 7/7A build, doctor, and RC gates intact.

Files included:
- index.html
- renderer.js
- styles.css

After applying, run:

```bat
npm test
npm run doctor
npm run test:rc
npm start
```

Verify:
- Sidebar shows Clean / Format / Settings
- Ctrl+1, Ctrl+2, Ctrl+3 switch tabs
- Settings buttons work: Status, Refresh Drives, Reset UI Preferences, Copy Clean Log, Copy Format Log
- Drives still load
- Safety rules still hold
