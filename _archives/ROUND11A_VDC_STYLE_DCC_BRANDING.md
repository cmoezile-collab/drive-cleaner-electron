# DCC Round 11A - VDC-style Branding Consistency Hotfix

This replaces the previous DCC branding with a minimal icon direction matching VDC:

- dark rounded-square plate
- metallic gold frame
- centered DCC initials
- no underline or extra text inside the app icon
- installer header/sidebar regenerated from the same visual language

Apply after Round 11 and overwrite existing assets.

Run:

```bat
node scripts\dcc-branding-check.js
npm test
npm run doctor
npm run test:rc
npm start
```
