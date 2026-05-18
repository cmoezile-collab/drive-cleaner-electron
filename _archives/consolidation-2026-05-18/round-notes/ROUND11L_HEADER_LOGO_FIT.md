# DCC Round 11L - Header Logo Fit

This patch fixes the titlebar logo after Round 11K made the correct asset appear but sized it too large for the header.

Changes:
- Uses `assets/dcc-logo-32.png` as the titlebar display source.
- Keeps `dcc-logo-64.png`, `dcc-logo.png`, and `icon.png` as fallbacks.
- Forces a compact 34px header logo with centered alignment.
- Adds a CSS override after the previous 44px Round 11K rule.
- Keeps the renderer security posture unchanged.

Run from the DCC project root:

```bat
node apply_round11L_header_logo_fit.js
npm run test:rc
npm run start
```
