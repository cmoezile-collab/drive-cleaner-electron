# DCC Round 11E - Package Scripts Restore

Restores the npm scripts overwritten by branding package.json while keeping the DCC/VDC-family installer branding configuration.

Includes patched doctor/RC scripts that resolve npm.cmd on Windows.

Apply after Round 11D.

Run:

```bat
npm run branding:check
npm test
npm run doctor
npm run test:rc
build_all.bat
```
