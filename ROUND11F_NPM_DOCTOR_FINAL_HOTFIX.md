# DCC Round 11F - npm Doctor Final Hotfix

Fixes the remaining doctor failure where the script reported `npm is not available` even though npm commands run correctly.

Cause: `dcc-doctor.js` defined the Windows `npm.cmd` helper but still called `run('npm', ...)` directly.

Apply from the DCC project root:

```bat
node apply_round11F_npm_doctor_hotfix.js
npm run doctor
npm run test:rc
build_all.bat
```
