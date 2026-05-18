# DCC Round 11Q - Final Global Audit

This patch adds a final static QA gate for DCC.

It adds:

- `scripts/dcc-final-global-check.js`
- `docs/DCC_FINAL_GLOBAL_QA_CHECKLIST.md`
- `test:global` npm script
- `qa:final` npm script

It does not alter app behavior, UI, safety logic, assets, or build output.

Recommended command:

```bat
npm run qa:final
```

Then run the packaged app and complete the manual QA checklist.
