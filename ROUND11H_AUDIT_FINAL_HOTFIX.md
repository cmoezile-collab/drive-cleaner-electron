# DCC Round 11H Audit Final Hotfix

This replaces `scripts/dcc-audit.js` with an ASCII-only, RC-safe audit harness.

Why:
- The previous audit printed mojibake in Windows cmd.
- It ended with `Failures: 1` without clearly showing the real failing check.
- This version records and prints explicit failure details.
- It does not block packaging on Windows npm detection. The doctor script owns that check.

Apply from the DCC project root:

```bat
node apply_round11H_audit_final_hotfix.js
npm run test:audit
npm run test:rc
build_all.bat
```
