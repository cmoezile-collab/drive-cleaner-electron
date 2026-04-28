# DCC Round 10 — Final Motion + Softness Polish

This pass is CSS-only plus audit checks.

## Goals
- Make the UI feel less sharp and less brittle.
- Smooth tab, modal, toast, button, and progress motion.
- Reduce heavy visual churn and avoid broad `transition: all` behavior.
- Preserve reduced-motion accessibility.
- Preserve all safety behavior. No clean, scan, format, drive, or IPC rules changed.

## Files
- `styles.css`
- `scripts/dcc-audit.js`

## Test
```bat
npm test
npm run doctor
npm run test:rc
npm start
```

Manual check: Clean, Format, Settings, Status modal, confirmation modal, toasts, light/dark/system, accent switching, and keyboard navigation.
