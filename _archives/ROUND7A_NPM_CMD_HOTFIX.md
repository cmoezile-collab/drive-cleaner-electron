# DCC Round 7A - npm.cmd Detection Hotfix

Fixes Windows doctor / RC scripts that spawn `npm` directly instead of resolving `npm.cmd`.

## Apply

From the DCC project root:

```bat
node apply_round7A_npm_cmd_hotfix.js
npm test
npm run doctor
npm run test:rc
```

Or double-click:

```text
apply_round7A_npm_cmd_hotfix.bat
```
