# DCC Round 11C — Use Clark-Provided Icon

This hotfix uses the icon Clark provided directly as the canonical DCC identity.

Direction:
- DCC only
- dark background
- gold rounded-square frame
- 3D gold text look
- no diagonal stripes
- installer art simplified to match the VDC family

Apply from the DCC project root:

```bat
node apply_round11C_use_clark_icon.js
npm run branding:check
npm test
npm run doctor
npm run test:rc
npm start
```

Then rebuild with `build_all.bat`.

Windows may cache old icons. If Explorer/shortcut icons do not update immediately, rebuild, delete the old shortcut, and recreate it from the new install.
