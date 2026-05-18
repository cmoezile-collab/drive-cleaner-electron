#!/usr/bin/env node
/*
 * DCC RC Gate - Round 11J
 * ASCII-only, explicit, less brittle release-candidate checks.
 */
const fs = require('fs');
const path = require('path');

const TITLE = 'DCC RC Gate';
const root = process.cwd();
let failures = 0;
let warnings = 0;

function rel(file) { return path.join(root, file); }
function exists(file) { return fs.existsSync(rel(file)); }
function read(file) { return exists(file) ? fs.readFileSync(rel(file), 'utf8') : ''; }
function section(name) { console.log(`\n${name}`); }
function ok(message) { console.log(`[OK] ${message}`); }
function warn(message) { warnings += 1; console.warn(`[WARN] ${message}`); }
function info(message) { console.log(`[INFO] ${message}`); }
function fail(message, detail = '') {
  failures += 1;
  console.error(`[FAIL] ${message}`);
  if (detail) console.error(`       ${detail}`);
}
function check(condition, message, detail = '') { condition ? ok(message) : fail(message, detail); }
function checkWarn(condition, message, detail = '') { condition ? ok(message) : warn(`${message}${detail ? ` - ${detail}` : ''}`); }
function has(text, pattern) { return pattern instanceof RegExp ? pattern.test(text) : text.includes(pattern); }

function loadPackage() {
  try {
    return JSON.parse(read('package.json'));
  } catch (error) {
    fail('package.json readable', error.message);
    return null;
  }
}

function checkBmp(relPath, width, height) {
  const file = rel(relPath);
  if (!fs.existsSync(file)) return fail(`${relPath} exists`);
  const buffer = fs.readFileSync(file);
  if (buffer.length < 26) return fail(`${relPath} is a valid BMP`, `File is only ${buffer.length} bytes.`);
  const actualWidth = buffer.readInt32LE(18);
  const actualHeight = Math.abs(buffer.readInt32LE(22));
  check(actualWidth === width && actualHeight === height, `${relPath} dimensions are ${width}x${height}`, `Found ${actualWidth}x${actualHeight}.`);
}

function sameFile(a, b) {
  if (!exists(a) || !exists(b)) return false;
  return fs.readFileSync(rel(a)).equals(fs.readFileSync(rel(b)));
}

function checkNpmScripts(pkg) {
  section('NPM scripts');
  if (!pkg) return;
  const scripts = pkg.scripts || {};
  check(scripts.doctor === 'node scripts/dcc-doctor.js', 'doctor script installed', `Found: ${scripts.doctor || '(missing)'}`);
  check(has(String(scripts['test:rc'] || ''), 'dcc-rc-check.js'), 'test:rc runs RC gate', `Found: ${scripts['test:rc'] || '(missing)'}`);
  check(has(String(scripts['test:rc'] || ''), 'test:syntax'), 'test:rc runs syntax checks', `Found: ${scripts['test:rc'] || '(missing)'}`);
  check(has(String(scripts['test:rc'] || ''), 'test:audit'), 'test:rc runs audit checks', `Found: ${scripts['test:rc'] || '(missing)'}`);
  check(has(String(scripts['test:rc'] || ''), 'test:doctor'), 'test:rc runs doctor checks', `Found: ${scripts['test:rc'] || '(missing)'}`);
  check(has(String(scripts['build:win:rc'] || ''), 'test:rc'), 'build:win:rc runs RC gates first', `Found: ${scripts['build:win:rc'] || '(missing)'}`);
  check(has(String(scripts['branding:lock'] || ''), 'generate-icon.ps1') && has(String(scripts['branding:lock'] || ''), 'dcc-branding-check.js'), 'branding:lock verifies canonical branding', `Found: ${scripts['branding:lock'] || '(missing)'}`);
}

function checkReleaseFiles() {
  section('Release files');
  ['build_all.bat', 'scripts/dcc-audit.js', 'scripts/dcc-doctor.js', 'scripts/dcc-rc-check.js', 'scripts/dcc-branding-check.js', 'scripts/generate-icon.ps1']
    .forEach((file) => check(exists(file), `${file} exists`));
  exists('RC_CHECKLIST.md') ? ok('RC_CHECKLIST.md exists') : info('RC_CHECKLIST.md not found; optional release note only');
  exists('ROUND7_RC_STABILIZATION.md') ? ok('ROUND7_RC_STABILIZATION.md exists') : info('ROUND7_RC_STABILIZATION.md not found; optional release note only');
}

function checkSafetyGates() {
  section('Critical safety gates');
  const main = read('main.js');
  const renderer = read('renderer.js');
  const preload = read('preload.js');

  check(Boolean(main), 'main.js readable');
  check(Boolean(renderer), 'renderer.js readable');
  check(Boolean(preload), 'preload.js readable');

  const allowMatch = main.match(/FORMAT_ALLOWED_DRIVE_TYPES\s*=\s*new\s+Set\s*\(\s*\[([^\]]*)\]/m);
  const allowBody = allowMatch ? allowMatch[1] : '';
  check(Boolean(allowMatch) && /['\"]Removable['\"]/.test(allowBody) && !/['\"](Fixed|Network|Optical|Unknown)['\"]/.test(allowBody),
    'format allowlist is removable-only',
    allowMatch ? `Allowlist body: [${allowBody.trim()}]` : 'FORMAT_ALLOWED_DRIVE_TYPES not found.');

  check(has(main, /FORMAT_BLOCKED_DRIVE_TYPES\s*=\s*new\s+Set/i) && has(main, /Network/i) && has(main, /Optical/i),
    'network/optical format blocklist is present');
  check(has(main, /isSystemDriveId\s*\(/) && has(main, /canFormat\s*=\s*!isSystem/),
    'system drive format blocking is present');
  check(has(main, /requireKnownDrive\s*\(/) && has(main, /Drive .* is no longer connected/i),
    'main process requires known connected drive');
  check(has(main, /options\.challenge\s*!==\s*options\.driveId/) || has(main, /Format challenge failed/i),
    'main process enforces typed challenge');
  check(has(renderer, /modalChallengeInput/) && has(renderer, /challengeText:\s*selectedDrive\.id/),
    'renderer shows typed challenge input');
  check(has(renderer, /getDrivePolicy\s*\(/) && has(renderer, /type === ['\"]Fixed['\"]/),
    'renderer displays drive policy');
  check(has(renderer, /updateTargetSafety\s*\(/) && has(renderer, /formatDrive\.disabled\s*=\s*!policy\.canFormat/),
    'renderer updates target safety and action states');
  check(has(main, /OUTPUT_CAP_CHARS/) && has(main, /appendCappedOutput\s*\(/) && has(main, /sink\.totalChars/),
    'child process output cap is present');
  check(has(renderer, /MAX_LOG_ENTRIES/) && has(renderer, /children\.length\s*>\s*MAX_LOG_ENTRIES/),
    'renderer log cap is present');
  check(has(preload, /contextBridge\.exposeInMainWorld/) && has(preload, /normalizeDriveId/),
    'preload exposes sanitized IPC bridge');
}

function checkElectronSecurity() {
  section('Electron/security hygiene');
  const main = read('main.js');
  const renderer = read('renderer.js');
  const html = read('index.html');

  check(has(main, /contextIsolation:\s*true/), 'contextIsolation is enabled');
  check(has(main, /nodeIntegration:\s*false/), 'nodeIntegration is disabled');
  check(has(main, /sandbox:\s*true/), 'renderer sandbox is enabled');
  check(has(main, /webSecurity:\s*true/), 'webSecurity is enabled');
  check(has(main, /setWindowOpenHandler/) && has(main, /action:\s*['\"]deny['\"]/), 'external window opens are denied');
  check(has(main, /will-navigate/) && has(main, /preventDefault\s*\(/), 'unexpected navigation is blocked');
  check(has(main, /setPermissionRequestHandler/) && has(main, /callback\(false\)/), 'permission requests are denied');
  check(has(main, /isTrustedSender/) && has(main, /Blocked untrusted renderer request/), 'IPC sender trust check is present');
  check(!/\.innerHTML\s*=|insertAdjacentHTML\s*\(/.test(renderer), 'renderer avoids direct HTML injection');
  check(Boolean(html), 'index.html readable');
  if (html) {
    check(!/\son(?:click|error|load|mouseover|submit)\s*=/i.test(html), 'index.html avoids inline event handlers');
    check(has(html, /default-src\s+['\"]self['\"]/i), 'CSP default-src self is set');
  }
}

function checkBrandingAndBuild(pkg) {
  section('Branding/build gates');
  const buildAll = read('build_all.bat');
  const generateIcon = read('scripts/generate-icon.ps1');

  if (pkg) {
    const build = pkg.build || {};
    const win = build.win || {};
    const nsis = build.nsis || {};
    check(win.icon === 'assets/dcc.ico', 'Windows icon path uses assets/dcc.ico', `Found: ${win.icon || '(missing)'}`);
    check(win.requestedExecutionLevel === 'requireAdministrator', 'Windows admin execution level is configured', `Found: ${win.requestedExecutionLevel || '(missing)'}`);
    check(nsis.installerIcon === 'assets/dcc.ico', 'NSIS installer icon uses assets/dcc.ico', `Found: ${nsis.installerIcon || '(missing)'}`);
    check(nsis.uninstallerIcon === 'assets/dcc.ico', 'NSIS uninstaller icon uses assets/dcc.ico', `Found: ${nsis.uninstallerIcon || '(missing)'}`);
    check(nsis.installerHeader === 'assets/installerHeader.bmp', 'installer header points to assets', `Found: ${nsis.installerHeader || '(missing)'}`);
    check(nsis.installerSidebar === 'assets/installerSidebar.bmp', 'installer sidebar points to assets', `Found: ${nsis.installerSidebar || '(missing)'}`);
    check(nsis.uninstallerSidebar === 'assets/installerSidebar.bmp', 'uninstaller sidebar points to assets', `Found: ${nsis.uninstallerSidebar || '(missing)'}`);
  }

  ['assets/dcc.ico', 'assets/icon.png', 'assets/dcc-logo.png', 'assets/dcc-mark.svg', 'assets/installerHeader.bmp', 'assets/installerSidebar.bmp']
    .forEach((file) => check(exists(file), `${file} exists`));
  if (exists('assets/installerHeader.bmp')) checkBmp('assets/installerHeader.bmp', 150, 57);
  if (exists('assets/installerSidebar.bmp')) checkBmp('assets/installerSidebar.bmp', 164, 314);
  check(exists('build/installerHeader.bmp'), 'build/installerHeader.bmp exists');
  check(exists('build/installerSidebar.bmp'), 'build/installerSidebar.bmp exists');
  if (exists('assets/installerHeader.bmp') && exists('build/installerHeader.bmp')) check(sameFile('assets/installerHeader.bmp', 'build/installerHeader.bmp'), 'build header matches canonical assets header');
  if (exists('assets/installerSidebar.bmp') && exists('build/installerSidebar.bmp')) check(sameFile('assets/installerSidebar.bmp', 'build/installerSidebar.bmp'), 'build sidebar matches canonical assets sidebar');

  check(has(generateIcon, /preserve canonical assets|no icon regeneration/i) && has(generateIcon, /Copy-Item/i),
    'generate-icon.ps1 is branding lock, not icon generator');
  check(!has(generateIcon, /System\.Drawing|New-Object\s+Drawing\.Bitmap|FromImage\s*\(/i),
    'old generated icon drawing routine is disabled');

  const firstBranding = buildAll.indexOf('npm run branding:lock');
  const rcGate = buildAll.indexOf('npm run test:rc');
  const finalBranding = buildAll.lastIndexOf('npm run branding:lock');
  const buildWin = buildAll.indexOf('npm run build:win');
  check(firstBranding >= 0 && rcGate > firstBranding, 'build_all runs branding lock before RC gate');
  check(rcGate >= 0, 'build_all runs RC gate');
  check(finalBranding > rcGate && buildWin > finalBranding, 'build_all re-locks branding before packaging');
  check(has(buildAll, /Manual QA still required/i), 'build_all reminds manual QA');
}

console.log(TITLE);
console.log(`Project: ${root}`);
const pkg = loadPackage();
if (pkg) ok('package.json readable');
checkReleaseFiles();
checkNpmScripts(pkg);
checkSafetyGates();
checkBrandingAndBuild(pkg);
checkElectronSecurity();

section('Summary');
console.log(`Failures: ${failures}`);
console.log(`Warnings: ${warnings}`);
if (failures > 0) {
  console.error('DCC RC gate failed. Fix the [FAIL] lines above before packaging.');
  process.exit(1);
}
console.log('DCC RC gate passed.');
if (warnings > 0) console.log('Warnings are informational and did not block this gate.');
