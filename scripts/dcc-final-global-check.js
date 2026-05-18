#!/usr/bin/env node
/*
 * DCC Final Global Check - Round 11Q
 * Static release-readiness audit for safety, security, branding, UI polish, animation hygiene, and feature wiring.
 * This script does not run destructive drive actions.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = process.cwd();
const report = [];
let failures = 0;
let warnings = 0;
let passes = 0;

function rel(file) { return path.join(root, file); }
function exists(file) { return fs.existsSync(rel(file)); }
function read(file) { return exists(file) ? fs.readFileSync(rel(file), 'utf8') : ''; }
function writeLine(line = '') { console.log(line); report.push(line); }
function section(title) { writeLine(`\n=== ${title} ===`); }
function ok(message) { passes += 1; writeLine(`[OK] ${message}`); }
function warn(message, detail = '') { warnings += 1; writeLine(`[WARN] ${message}${detail ? ` :: ${detail}` : ''}`); }
function fail(message, detail = '') { failures += 1; writeLine(`[FAIL] ${message}${detail ? ` :: ${detail}` : ''}`); }
function check(condition, message, detail = '') { condition ? ok(message) : fail(message, detail); }
function soft(condition, message, detail = '') { condition ? ok(message) : warn(message, detail); }
function has(text, pattern) { return pattern instanceof RegExp ? pattern.test(text) : text.includes(pattern); }
function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function loadJson(file) {
  try {
    return JSON.parse(read(file));
  } catch (error) {
    fail(`${file} is readable JSON`, error.message);
    return null;
  }
}

function checkSyntax(file) {
  if (!exists(file)) {
    fail(`${file} exists for syntax check`);
    return;
  }
  try {
    execFileSync(process.execPath, ['--check', rel(file)], { stdio: 'pipe' });
    ok(`${file} syntax passes node --check`);
  } catch (error) {
    fail(`${file} syntax passes node --check`, String(error.stderr || error.message || error));
  }
}

function checkBmp(file, width, height) {
  if (!exists(file)) return fail(`${file} exists`);
  const buffer = fs.readFileSync(rel(file));
  if (buffer.length < 26) return fail(`${file} is a valid BMP`, `File is only ${buffer.length} bytes.`);
  const actualWidth = buffer.readInt32LE(18);
  const actualHeight = Math.abs(buffer.readInt32LE(22));
  check(actualWidth === width && actualHeight === height, `${file} is ${width}x${height}`, `Found ${actualWidth}x${actualHeight}`);
}

function sameFile(a, b) {
  if (!exists(a) || !exists(b)) return false;
  return fs.readFileSync(rel(a)).equals(fs.readFileSync(rel(b)));
}

function checkPackageAndBuild(pkg) {
  section('Package / build pipeline');
  check(Boolean(pkg), 'package.json loaded');
  if (!pkg) return;

  const scripts = pkg.scripts || {};
  check(scripts.start === 'electron .', 'start script launches Electron');
  check(has(String(scripts['test:syntax'] || ''), 'node --check main.js'), 'syntax test checks main.js');
  check(has(String(scripts['test:syntax'] || ''), 'node --check preload.js'), 'syntax test checks preload.js');
  check(has(String(scripts['test:syntax'] || ''), 'node --check renderer.js'), 'syntax test checks renderer.js');
  check(has(String(scripts['test:audit'] || ''), 'dcc-audit.js'), 'audit script is wired');
  check(scripts.doctor === 'node scripts/dcc-doctor.js', 'doctor script is wired');
  check(has(String(scripts['test:rc'] || ''), 'test:syntax') && has(String(scripts['test:rc'] || ''), 'test:audit') && has(String(scripts['test:rc'] || ''), 'test:doctor') && has(String(scripts['test:rc'] || ''), 'dcc-rc-check.js'), 'test:rc runs syntax, audit, doctor, and RC gate');
  check(has(String(scripts['build:win:rc'] || ''), 'test:rc'), 'build:win:rc runs RC gate first');
  check(has(String(scripts['branding:lock'] || ''), 'generate-icon.ps1') && has(String(scripts['branding:lock'] || ''), 'dcc-branding-check.js'), 'branding:lock verifies canonical branding');
  soft(has(String(scripts['test:global'] || ''), 'dcc-final-global-check.js'), 'test:global script is installed', 'Round 11Q apply script can add it.');
  soft(has(String(scripts['qa:final'] || ''), 'branding:lock') && has(String(scripts['qa:final'] || ''), 'test:rc') && has(String(scripts['qa:final'] || ''), 'test:global'), 'qa:final script chains branding lock, RC, and global audit', 'Round 11Q apply script can add it.');

  const build = pkg.build || {};
  const files = build.files || [];
  check(files.includes('index.html'), 'package includes index.html');
  check(files.includes('styles.css'), 'package includes styles.css');
  check(files.includes('renderer.js'), 'package includes renderer.js');
  check(files.includes('main.js'), 'package includes main.js');
  check(files.includes('preload.js'), 'package includes preload.js');
  check(files.includes('assets/**/*'), 'package includes assets/**/*');

  const win = build.win || {};
  const nsis = build.nsis || {};
  check(win.icon === 'assets/dcc.ico', 'Windows icon path is locked to assets/dcc.ico', `Found ${win.icon || '(missing)'}`);
  check(win.requestedExecutionLevel === 'requireAdministrator', 'Windows admin execution level is requireAdministrator', `Found ${win.requestedExecutionLevel || '(missing)'}`);
  check(Array.isArray(win.target) && win.target.includes('nsis') && win.target.includes('portable'), 'Windows build targets installer and portable');
  check(nsis.installerIcon === 'assets/dcc.ico', 'NSIS installer icon is DCC icon');
  check(nsis.uninstallerIcon === 'assets/dcc.ico', 'NSIS uninstaller icon is DCC icon');
  check(nsis.installerHeader === 'assets/installerHeader.bmp', 'NSIS installer header path is canonical');
  check(nsis.installerSidebar === 'assets/installerSidebar.bmp', 'NSIS installer sidebar path is canonical');
  check(nsis.uninstallerSidebar === 'assets/installerSidebar.bmp', 'NSIS uninstaller sidebar path is canonical');
}

function checkFilesAndSyntax() {
  section('Files / syntax');
  [
    'main.js', 'preload.js', 'renderer.js', 'index.html', 'styles.css', 'package.json', 'build_all.bat',
    'scripts/dcc-audit.js', 'scripts/dcc-doctor.js', 'scripts/dcc-rc-check.js', 'scripts/dcc-branding-check.js', 'scripts/generate-icon.ps1'
  ].forEach((file) => check(exists(file), `${file} exists`));

  ['main.js', 'preload.js', 'renderer.js', 'scripts/dcc-audit.js', 'scripts/dcc-doctor.js', 'scripts/dcc-rc-check.js', 'scripts/dcc-branding-check.js', 'scripts/dcc-final-global-check.js']
    .filter((file) => exists(file))
    .forEach(checkSyntax);
}

function checkBranding() {
  section('Branding assets / installer art');
  [
    'assets/dcc.ico', 'assets/icon.png', 'assets/dcc-logo.png', 'assets/dcc-logo-64.png', 'assets/dcc-logo-32.png', 'assets/dcc-mark.svg',
    'assets/installerHeader.bmp', 'assets/installerSidebar.bmp', 'build/installerHeader.bmp', 'build/installerSidebar.bmp'
  ].forEach((file) => check(exists(file), `${file} exists`));

  if (exists('assets/installerHeader.bmp')) checkBmp('assets/installerHeader.bmp', 150, 57);
  if (exists('assets/installerSidebar.bmp')) checkBmp('assets/installerSidebar.bmp', 164, 314);
  if (exists('assets/installerHeader.bmp') && exists('build/installerHeader.bmp')) check(sameFile('assets/installerHeader.bmp', 'build/installerHeader.bmp'), 'build installer header matches assets header');
  if (exists('assets/installerSidebar.bmp') && exists('build/installerSidebar.bmp')) check(sameFile('assets/installerSidebar.bmp', 'build/installerSidebar.bmp'), 'build installer sidebar matches assets sidebar');

  const ps1 = read('scripts/generate-icon.ps1');
  check(has(ps1, /canonical|branding lock|no icon regeneration|does not regenerate/i), 'generate-icon.ps1 documents branding-lock behavior');
  check(has(ps1, /Copy-Item/i), 'generate-icon.ps1 copies installer BMPs to build folder');
  check(!has(ps1, /System\.Drawing|New-Object\s+Drawing\.Bitmap|FromImage\s*\(/i), 'old icon drawing routine is not present');
}

function checkBuildAll() {
  section('build_all.bat workflow');
  const bat = read('build_all.bat');
  check(Boolean(bat), 'build_all.bat readable');
  if (!bat) return;
  const firstBranding = bat.indexOf('npm run branding:lock');
  const rcGate = bat.indexOf('npm run test:rc');
  const finalBranding = bat.lastIndexOf('npm run branding:lock');
  const buildWin = Math.max(bat.indexOf('npm run build:win'), bat.indexOf('npm run build'));
  check(firstBranding >= 0, 'build_all runs branding:lock');
  check(rcGate >= 0, 'build_all runs test:rc');
  check(firstBranding >= 0 && rcGate > firstBranding, 'branding lock runs before RC gate');
  check(finalBranding > rcGate, 'branding lock runs again after RC gate');
  check(buildWin > finalBranding, 'Windows build starts after final branding lock');
  check(has(bat, /Manual QA still required/i), 'build_all reminds that manual QA is still required');
  check(!has(bat, /npm test(\s|$)/i) || has(bat, /npm run test:rc/i), 'build_all uses explicit RC gate instead of only generic npm test');
}

function checkElectronSecurity() {
  section('Electron security');
  const main = read('main.js');
  const preload = read('preload.js');
  const renderer = read('renderer.js');
  const html = read('index.html');

  check(has(main, /contextIsolation:\s*true/), 'contextIsolation enabled');
  check(has(main, /nodeIntegration:\s*false/), 'nodeIntegration disabled');
  check(has(main, /sandbox:\s*true/), 'sandbox enabled');
  check(has(main, /webSecurity:\s*true/), 'webSecurity enabled');
  check(has(main, /allowRunningInsecureContent:\s*false/), 'insecure content disabled');
  check(has(main, /setWindowOpenHandler/) && has(main, /action:\s*['"]deny['"]/), 'new windows are denied');
  check(has(main, /will-navigate/) && has(main, /preventDefault\s*\(/), 'unexpected navigation is blocked');
  check(has(main, /will-attach-webview/) && has(main, /preventDefault\s*\(/), 'webviews are blocked');
  check(has(main, /setPermissionRequestHandler/) && has(main, /callback\(false\)/), 'permission requests denied by default');
  check(has(main, /setPermissionCheckHandler\(\(\)\s*=>\s*false\)/), 'permission checks denied by default');
  check(has(main, /function\s+isTrustedSender/) && has(main, /event\.sender\s*===\s*mainWindow\.webContents/), 'IPC calls are restricted to trusted renderer');
  check(has(main, /secureHandle\s*\(/) && has(main, /Blocked untrusted renderer request/), 'secureHandle blocks untrusted renderer requests');

  check(has(preload, /contextBridge\.exposeInMainWorld\(['"]driveCleaner['"]/), 'preload exposes a limited driveCleaner API');
  check(!has(preload, /remote\s*=|require\(['"]electron['"]\)\.remote/), 'preload does not expose electron remote');
  check(has(preload, /normalizeDriveId/) && has(preload, /normalizeCleanPayload/) && has(preload, /normalizeFormatPayload/), 'preload sanitizes drive, clean, and format payloads');

  check(!/\.innerHTML\s*=|insertAdjacentHTML\s*\(/.test(renderer), 'renderer avoids direct HTML injection');
  check(!/eval\s*\(|new\s+Function\s*\(/.test(renderer), 'renderer avoids eval/new Function');
  check(has(renderer, /textContent\s*=/) && has(renderer, /safeText\s*\(/), 'renderer uses textContent and safeText for display text');

  check(has(html, /Content-Security-Policy/i), 'CSP meta tag exists');
  check(has(html, /default-src\s+['"]self['"]/i), 'CSP default-src self is set');
  check(has(html, /script-src\s+['"]self['"]/i), 'CSP script-src self is set');
  check(has(html, /connect-src\s+['"]none['"]/i), 'CSP connect-src none is set');
  check(has(html, /object-src\s+['"]none['"]/i), 'CSP object-src none is set');
  check(!/\son(?:click|error|load|mouseover|submit)\s*=/i.test(html), 'index.html has no inline event handlers');
  if (has(html, /img-src[^;]*file:/i)) {
    warn('CSP img-src includes file:', 'Acceptable for this local Electron app if required by packaged local assets; avoid using it for user-controlled image paths.');
  } else {
    ok('CSP img-src excludes file:');
  }
}

function checkDriveSafety() {
  section('Drive safety / destructive action gates');
  const main = read('main.js');
  const preload = read('preload.js');
  const renderer = read('renderer.js');

  const allowMatch = main.match(/FORMAT_ALLOWED_DRIVE_TYPES\s*=\s*new\s+Set\s*\(\s*\[([^\]]*)\]/m);
  const allowBody = allowMatch ? allowMatch[1] : '';
  check(Boolean(allowMatch) && /['"]Removable['"]/.test(allowBody) && !/['"](Fixed|Network|Optical|Unknown)['"]/.test(allowBody), 'format allowlist is removable-only', allowMatch ? `Allowlist: [${allowBody.trim()}]` : 'FORMAT_ALLOWED_DRIVE_TYPES missing');
  check(has(main, /FORMAT_BLOCKED_DRIVE_TYPES\s*=\s*new\s+Set/) && has(main, /Network/) && has(main, /Optical/) && has(main, /Unknown/), 'network, optical, and unknown drives are blocklisted for format');
  check(has(main, /isSystemDriveId\s*\(/) && has(main, /Formatting the Windows system drive is blocked/), 'system drive formatting is blocked');
  check(has(main, /shouldBlockSystemUnhide/) && has(main, /Unhide operations are blocked on the Windows system drive/), 'system-drive unhide/full clean is blocked');
  check(has(main, /requireKnownDrive\s*\(/) && has(main, /Drive .* is no longer connected/), 'selected drive must still be connected before action');
  check(has(main, /options\.challenge\s*!==\s*options\.driveId/) && has(main, /Format challenge failed/), 'format requires exact typed drive ID challenge');
  check(has(main, /taskState\.running/) && has(main, /Another task is already running/), 'concurrent tasks are blocked');
  check(has(main, /OUTPUT_CAP_CHARS/) && has(main, /appendCappedOutput/) && has(main, /output truncated/), 'child-process output is capped');
  check(has(main, /killProcessTree/) && has(main, /taskkill/), 'stop action can kill child process tree');
  check(has(main, /cleanupTaskArtifacts/) && has(main, /unlink/) && has(main, /scriptPath/), 'temporary diskpart script is cleaned up');
  check(has(main, /FAT32/) && has(main, /32GB/i), 'FAT32 size guard is present');
  check(has(renderer, /getDrivePolicy\s*\(/) && has(renderer, /formatDrive\.disabled\s*=\s*!policy\.canFormat/), 'renderer disables unsafe actions according to drive policy');
  check(has(renderer, /modalChallengeInput/) && has(renderer, /challengeText:\s*selectedDrive\.id/), 'format modal requires target drive challenge text');
  check(has(preload, /sanitizeLabel/) && has(main, /sanitizeVolumeLabel/), 'volume labels are sanitized in preload and main');
}

function checkUiLayout() {
  section('UI layout / spacing / typography');
  const html = read('index.html');
  const css = read('styles.css');
  check(has(html, /class=['"]brand-lockup['"]/) && has(html, /class=['"]brand-badge['"]/) && has(html, /class=['"]brand-copy['"]/) && has(html, /class=['"]brand-subtitle['"]/), 'header brand lockup markup exists');
  check(has(html, /src=['"]assets\/dcc-logo-(64|32)\.png['"]/), 'header logo points to DCC logo asset');
  soft(has(html, /src=['"]assets\/dcc-logo-64\.png['"]/), 'header uses 64px source asset for sharp 38px display', '32px source still works, but 64px source is sharper.');

  check(has(css, /ROUND11O HEADER EXACT FIT START/), 'Round 11O header exact-fit block is present');
  check(has(css, /ROUND11P FINAL SPACING \+ BUTTON ALIGNMENT START/), 'Round 11P final spacing/button block is present');
  check(has(css, /ROUND12 DENSITY EFFICIENCY PASS START/), 'Round 12 density efficiency block is present');
  check(has(css, /grid-template-rows:\s*58px\s+1px\s+minmax\(0,\s*1fr\)\s+64px/i), 'app grid reserves 58px header and 64px action bar');
  check(has(css, /\.titlebar\s*\{[\s\S]*?height:\s*58px\s*!important/i), 'titlebar locked to 58px height');
  check(has(css, /\.brand-lockup\s*\{[\s\S]*?grid-template-columns:\s*38px\s+minmax\(0,\s*auto\)/i), 'brand lockup reserves 38px logo column');
  check(has(css, /\.brand-badge\s*\{[\s\S]*?width:\s*38px\s*!important/i), 'brand badge locked to 38px');
  check(has(css, /\.brand-name\s*\{[\s\S]*?font-size:\s*19px\s*!important/i), 'brand name font size locked to final fit');
  check(has(css, /\.brand-subtitle\s*\{[\s\S]*?font-size:\s*9\.8px\s*!important/i), 'brand subtitle font size locked to final fit');
  check(has(css, /\.sidebar-section\s*>\s*\.card\s*\+\s*\.card\s*\{[\s\S]*?margin-top:\s*16px\s*!important/i), 'sidebar cards have 16px vertical spacing');
  check(has(css, /\.btn,[\s\S]*?\.titlebar-btn,[\s\S]*?\.choice-pill\s+span[\s\S]*?display:\s*inline-flex\s*!important/i), 'button labels use inline-flex centering');
  check(has(css, /\.btn\s*\{[\s\S]*?height:\s*38px/i), 'buttons have consistent 38px height');
  check(has(css, /\.btn\s*\{[\s\S]*?min-height:\s*34px\s*!important[\s\S]*?height:\s*34px\s*!important/i), 'density pass tightens standard button height to 34px');
  check(has(css, /\.card,\s*[\s\S]*?\.warning-card,\s*[\s\S]*?\.stat-card\s*\{[\s\S]*?padding:\s*18px\s*!important/i), 'density pass reduces card padding');
  check(has(css, /\.panel\s*\{[\s\S]*?gap:\s*14px\s*!important/i), 'density pass reduces panel spacing');
  check(has(css, /\.log-box\s*\{[\s\S]*?min-height:\s*162px\s*!important/i), 'density pass keeps logs useful without excess empty space');
  check(has(css, /\.action-bar\s*\{[\s\S]*?height:\s*64px\s*!important/i), 'density pass locks action bar to 64px');
  soft(!has(css, /ROUND11K|ROUND11L|ROUND11M|ROUND11N/), 'old Round 11 header override blocks are absent', 'If present, they may be harmless only if Round 11O comes after them. Prefer removing old blocks.');

  check(has(css, /--display:/) && has(css, /--sans:/) && has(css, /--mono:/), 'font variables are defined');
  check(has(css, /body\[data-theme=['"]light['"]/) && has(css, /color-scheme:\s*light/), 'light theme rules exist');
  check(has(css, /body\[data-theme=['"]light['"][\s\S]*?--bg:/), 'light theme token override exists');
  check(has(css, /@media\s*\(max-width:\s*1180px\)/), 'responsive rule exists for narrower windows');
}

function checkAnimationHygiene() {
  section('Animation / interaction hygiene');
  const css = read('styles.css');
  check(has(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/), 'reduced-motion media query exists');
  check(!has(css, /animation-iteration-count:\s*infinite|animation:\s*[^;]*infinite/i), 'no infinite CSS animations detected');
  check(!has(css, /transition:\s*all/i), 'no broad transition: all detected');

  const durations = [...css.matchAll(/(?:transition|animation)[^;{]*:\s*[^;]*?(\d+(?:\.\d+)?)(ms|s)/gi)]
    .map((match) => Number(match[1]) * (match[2].toLowerCase() === 's' ? 1000 : 1));
  const slow = durations.filter((value) => value > 400);
  soft(slow.length === 0, 'animation/transition durations stay <= 400ms', slow.length ? `Slow values: ${slow.join(', ')}ms` : '');
  check(has(css, /transform:\s*translateY\(-1px\)/) || has(css, /transform:\s*translateY\(/), 'micro-interactions use small transforms');
}

function checkFeatureWiring() {
  section('Feature wiring');
  const main = read('main.js');
  const preload = read('preload.js');
  const renderer = read('renderer.js');
  const html = read('index.html');

  const requiredIds = [
    'driveSelect', 'refreshDrives', 'targetSafety', 'targetBanner', 'btnUnhide', 'btnScan', 'btnFull', 'btnStop',
    'formatDrive', 'formatGuard', 'confirmModal', 'modalChallengeInput', 'diagnosticsModal', 'settingsStatusBtn',
    'appearanceModeSelect', 'accentColorPicker', 'cleanLog', 'formatLog'
  ];
  for (const id of requiredIds) check(has(html, new RegExp(`id=["']${escapeRegExp(id)}["']`)), `#${id} exists in index.html`);

  const channels = ['app:init', 'drives:list', 'app:diagnostics', 'appearance:set', 'clipboard:write', 'clean:start', 'format:start', 'task:stop'];
  for (const channel of channels) check(has(main, new RegExp(`secureHandle\\(['"]${escapeRegExp(channel)}['"]`)), `main handles ${channel}`);

  const apiMethods = ['getInitialState', 'refreshDrives', 'getDiagnostics', 'setAppearance', 'copyText', 'startClean', 'startFormat', 'stopTask', 'windowAction', 'onEvent'];
  for (const method of apiMethods) check(has(preload, new RegExp(`${escapeRegExp(method)}\\s*:`)), `preload exposes ${method}`);

  check(has(renderer, /bindEvents\s*\(/), 'renderer binds UI events');
  check(has(renderer, /refreshDrives\s*\(/), 'renderer wires refresh drives');
  check(has(renderer, /startClean\s*\(/), 'renderer wires clean actions');
  check(has(renderer, /confirmAndFormat\s*\(/), 'renderer wires format confirmation flow');
  check(has(renderer, /openDiagnostics\s*\(/), 'renderer wires diagnostics report');
  check(has(renderer, /applyTheme\s*\(/) && has(renderer, /accentColor/), 'renderer wires theme/accent controls');
  check(has(renderer, /MAX_LOG_ENTRIES/) && has(renderer, /getActiveLogText/), 'renderer wires capped logs and copy log');
}

function writeReport() {
  const file = rel('dcc-final-global-report.txt');
  try {
    fs.writeFileSync(file, `${report.join('\n')}\n`, 'utf8');
    writeLine(`\n[INFO] Report written to ${file}`);
  } catch (error) {
    warn('Could not write report file', error.message);
  }
}

writeLine('DCC FINAL GLOBAL CHECK - ROUND 11Q');
writeLine(`Project: ${root}`);
writeLine(`Time: ${new Date().toISOString()}`);

const pkg = loadJson('package.json');
checkFilesAndSyntax();
checkPackageAndBuild(pkg);
checkBranding();
checkBuildAll();
checkElectronSecurity();
checkDriveSafety();
checkUiLayout();
checkAnimationHygiene();
checkFeatureWiring();

section('Manual QA reminders');
writeLine('[INFO] Static checks cannot visually prove animation smoothness or pixel-perfect layout on your machine.');
writeLine('[INFO] Manually verify: header logo/text, sidebar spacing, footer button centering, dark/light/accent, drive refresh, status report, clean modal, format cancel path, and packaged installer branding.');
writeLine('[INFO] Do not test destructive format except on an expendable removable drive.');

section('Summary');
writeLine(`Passes: ${passes}`);
writeLine(`Warnings: ${warnings}`);
writeLine(`Failures: ${failures}`);
writeReport();

if (failures > 0) {
  writeLine('[FAIL] Global check failed. Fix every [FAIL] before packaging.');
  process.exit(1);
}
writeLine('[OK] Global check passed. Warnings are non-blocking but worth reviewing.');
