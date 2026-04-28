# DCC Round 11G npm Doctor Bulletproof Hotfix

This fixes the remaining false doctor failure where npm exists, but the doctor script says `npm is not available`.

The replacement doctor accepts npm detection through:
- `npm_execpath`
- `npm_config_user_agent`
- `node <npm_execpath> --version`
- `npm.cmd --version`
- `npm --version`
- `cmd.exe /d /s /c "npm --version"`
- `where npm` / `where npm.cmd`

If npm cannot be verified by child_process but npm scripts are clearly running, the doctor reports a warning instead of a build-blocking failure.

Apply from the DCC project root:

```bat
node apply_round11G_doctor_bulletproof.js
npm run doctor
npm run test:rc
build_all.bat
```
