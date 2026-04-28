# DCC Round 9 — Card Spacing + Typography

Final UI-system pass before logo and installer branding.

## Scope

- Normalizes card padding, panel gaps, sidebar rhythm, and settings card density.
- Adds a consistent font-size scale for captions, metadata, body text, controls, and headings.
- Tightens action bar, target banner, cards, stats, log boxes, modals, settings grid, and responsive behavior.
- Keeps all safety behavior unchanged.
- Keeps theme customization intact from Round 8 / 8A.

## Files

- `styles.css`

## Test

```bat
npm test
npm run doctor
npm run test:rc
npm start
```

Manual check:

- Clean panel card spacing.
- Format panel card spacing.
- Settings panel spacing and font sizes.
- Dark / Light / System modes.
- Accent color changes.
- Drive list loading.
- C: scan-only policy.
- Removable-only guarded format.
