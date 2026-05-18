# DCC Round 11K - Header Logo Lock

Fixes the missing/broken logo in the app header/titlebar.

What it does:
- Copies canonical DCC logo PNG assets into `assets/`.
- Adds a runtime renderer lock that forces the header logo image to `assets/dcc-logo-64.png`, with fallbacks to `assets/dcc-logo.png` and `assets/icon.png`.
- Adds CSS sizing for the header logo so it appears as a clean 44px DCC mark.
- Best-effort normalizes a logo `src` in `index.html` if a logo-like image tag is found.
- Extends the branding check to include the header logo asset sizes.

Apply from the DCC project root:

```bat
node apply_round11K_header_logo_lock.js
npm run branding:lock
npm run test:rc
npm run start
```

If the dev app looks correct, run:

```bat
build_all.bat
```
