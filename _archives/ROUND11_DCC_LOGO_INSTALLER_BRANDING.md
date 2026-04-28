# DCC Round 11 — Logo + Installer Branding

This patch replaces the DCC visual identity with a clean Clark-product style:

- `assets/dcc.ico` — Windows app / installer icon
- `assets/icon.png` — large PNG source
- `assets/dcc-logo.png` — titlebar/preview logo
- `assets/dcc-mark.svg` — vector fallback mark
- `assets/installerHeader.bmp` — NSIS header, 150 × 57
- `assets/installerSidebar.bmp` — NSIS sidebar, 164 × 314
- `build/installerHeader.bmp` and `build/installerSidebar.bmp` — compatibility copies
- `package.json` — NSIS installer artwork paths now point to `assets/`
- `scripts/dcc-branding-check.js` — optional verification helper

Apply after Round 10A.

Recommended checks:

```bat
node scripts\dcc-branding-check.js
npm test
npm run doctor
npm run test:rc
npm start
```

Then build with:

```bat
build_all.bat
```

Windows may cache old icons. If the icon does not update immediately, rebuild, delete old shortcuts, and relaunch the rebuilt artifact.
