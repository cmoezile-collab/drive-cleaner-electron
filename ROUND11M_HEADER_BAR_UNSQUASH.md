# DCC Round 11M - Header Bar Unsquash

Fixes the compact titlebar after the DCC logo was restored:

- Keeps the titlebar at a stable 60px height.
- Uses the existing DCC logo asset as a small titlebar mark.
- Prevents the logo from stretching into the text rail.
- Restores the intended two-line brand lockup:
  - DRIVE CLEANER | BY CLARK
  - UNHIDE · SCAN · FORMAT · PROTECT
- Pushes status/window controls to the far right so they do not squeeze the brand text.

Apply from the project root:

```bat
node apply_round11M_header_bar_unsquash.js
npm run test:rc
npm run start
```
