# DCC Round 11I - Branding Lock / No Regeneration

This hotfix stops `scripts/generate-icon.ps1` from regenerating the old DCC icon and installer art.

The canonical branding is now:
- `assets/dcc.ico`
- `assets/icon.png`
- `assets/dcc-logo.png`
- `assets/installerHeader.bmp`
- `assets/installerSidebar.bmp`

`generate-icon.ps1` now only verifies those assets and copies the installer BMP files to `build/` for compatibility. It does not draw or overwrite the icon.

`build_all.bat` now runs `npm run branding:lock` before tests and immediately before packaging.
