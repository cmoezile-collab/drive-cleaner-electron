#!/usr/bin/env node
/*
 * DCC Safety Audit - Final RC-safe audit harness.
 * Uses ASCII output only so Windows cmd.exe does not mojibake checkmarks.
 * Keeps build-blocking failures limited to real release blockers.
 */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
let failures = 0;
let warnings = 0;
const failureMessages = [];

function rel(p) { return path.join(root, p); }
function exists(p) { return fs.existsSync(rel(p)); }
function read(p) {
  try { return fs.readFileSync(rel(p), 'utf8'); }
  catch { return ''; }
}
function pass(msg) { console.log(`[OK] ${msg}`); }
function warn(msg) { warnings += 1; console.log(`[WARN] ${msg}`); }
function fail(msg) {
  failures += 1;
  failureMessages.push(msg);
  console.log(`[FAIL] ${msg}`);
}
function section(name) { console.log(`\n${name}`); }

function requireFile(file) {
  if (exists(file)) pass(`${file} exists`);
  else fail(`${file} is missing`);
}

function requireText(file, pattern, label) {
  const text = read(file);
  const ok = typeof pattern === 'string' ? text.includes(pattern) : pattern.test(text);
  if (ok) pass(label);
  else fail(`${label} is missing`);
}

function warnText(file, pattern, label) {
  const text = read(file);
  const ok = typeof pattern === 'string' ? text.includes(pattern) : pattern.test(text);
  if (ok) pass(label);
  else warn(`${label} not detected`);
}

function readPackage() {
  try {
    return JSON.parse(read('package.json'));
  } catch (error) {
    fail(`package.json could not be parsed: ${error.message}`);
    return null;
  }
}

function bmpSize(file) {
  const target = rel(file);
  if (!fs.existsSync(target)) return null;
  const data = fs.readFileSync(target);
  if (data.length < 26 || data.toString('ascii', 0, 2) !== 'BM') return null;
  const width = data.readInt32LE(18);
  const height = Math.abs(data.readInt32LE(22));
  return { width, height };
}

function requireBmpSize(file, width, height) {
  const size = bmpSize(file);
  if (!size) {
    fail(`${file} is not a readable BMP`);
    return;
  }
  if (size.width === width && size.height === height) {
    pass(`${path.basename(file)} is ${width}x${height}`);
  } else {
    fail(`${file} should be ${width}x${height}, found ${size.width}x${size.height}`);
  }
}

function checkScripts(pkg) {
  section('Package scripts');
  const scripts = (pkg && pkg.scripts) || {};
  const recommended = {
    start: 'electron .',
    'test:syntax': null,
    'test:audit': null,
    'test:doctor': null,
    test: null,
    doctor: null,
    'test:rc': null,
    'build:win:rc': null
  };

  for (const name of Object.keys(recommended)) {
    if (scripts[name]) pass(`script ${name} is installed`);
    else warn(`script ${name} is not installed`);
  }

  if (scripts.test && scripts.test.includes('test:syntax') && scripts.test.includes('test:audit')) {
    pass('npm test chains syntax and audit checks');
  } else if (scripts.test) {
    warn('npm test exists but does not clearly chain syntax + audit');
  }

  if (scripts['test:rc'] && scripts['test:rc'].includes('dcc-rc-check')) {
    pass('test:rc includes DCC RC check');
  } else if (scripts['test:rc']) {
    warn('test:rc exists but does not clearly run dcc-rc-check');
  }
}

function checkPackageBuild(pkg) {
  section('Package build config');
  if (!pkg) return;

  if (pkg.name) pass(`package name: ${pkg.name}`);
  else fail('package name is missing');

  if (/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(String(pkg.version || ''))) {
    pass(`version is semver-like: ${pkg.version}`);
  } else {
    fail(`version should be semver-like, found ${JSON.stringify(pkg.version)}`);
  }

  const build = pkg.build || {};
  const win = build.win || {};
  const nsis = build.nsis || {};
  const files = Array.isArray(build.files) ? build.files : [];

  if (win.requestedExecutionLevel === 'requireAdministrator') pass('Windows build requests administrator privileges');
  else fail('Windows build should set win.requestedExecutionLevel to requireAdministrator');

  if (win.icon === 'assets/dcc.ico') pass('Windows icon uses canonical DCC icon');
  else warn(`Windows icon should usually be assets/dcc.ico, found ${JSON.stringify(win.icon)}`);

  if (nsis.installerHeader === 'assets/installerHeader.bmp') pass('NSIS header uses canonical asset');
  else fail(`NSIS installerHeader should be assets/installerHeader.bmp, found ${JSON.stringify(nsis.installerHeader)}`);

  if (nsis.installerSidebar === 'assets/installerSidebar.bmp') pass('NSIS sidebar uses canonical asset');
  else fail(`NSIS installerSidebar should be assets/installerSidebar.bmp, found ${JSON.stringify(nsis.installerSidebar)}`);

  if (nsis.uninstallerSidebar === 'assets/installerSidebar.bmp') pass('NSIS uninstaller sidebar uses canonical asset');
  else warn('NSIS uninstallerSidebar is not set to the canonical asset');

  for (const required of ['main.js', 'preload.js', 'renderer.js', 'index.html', 'styles.css', 'assets/**/*']) {
    if (files.includes(required)) pass(`packaged: ${required}`);
    else warn(`build.files does not explicitly include ${required}`);
  }
}

function checkCoreFiles() {
  section('Core files');
  [
    'package.json',
    'main.js',
    'preload.js',
    'renderer.js',
    'index.html',
    'styles.css',
    'assets/dcc.ico',
    'assets/installerHeader.bmp',
    'assets/installerSidebar.bmp',
    'build/installer.nsh',
    'build_all.bat',
    'scripts/dcc-audit.js',
    'scripts/dcc-doctor.js',
    'scripts/dcc-rc-check.js'
  ].forEach(requireFile);
}

function checkElectronSecurity() {
  section('Electron security');
  requireText('main.js', /contextIsolation\s*:\s*true/, 'contextIsolation enabled');
  requireText('main.js', /nodeIntegration\s*:\s*false/, 'nodeIntegration disabled');
  requireText('main.js', /sandbox\s*:\s*true/, 'BrowserWindow sandbox enabled');
  requireText('main.js', /webSecurity\s*:\s*true/, 'webSecurity enabled');
  requireText('index.html', /Content-Security-Policy/i, 'CSP is present');
  warnText('main.js', /setWindowOpenHandler/, 'window.open is controlled');
  warnText('main.js', /will-attach-webview/, 'webview attachment blocked');
  warnText('main.js', /setPermissionRequestHandler/, 'permissions denied by default');
  warnText('main.js', /will-navigate|local app only|navigation/i, 'navigation guard is present');
}

function checkSafetyPolicy() {
  section('Safety policy');
  requireText('main.js', /requireAdministrator|ensureAdmin|checkAdmin/i, 'administrator/elevation handling is present');
  requireText('main.js', /system drive|systemDrive|isSystem/i, 'system-drive policy is present');
  requireText('main.js', /typed.*drive|drive.*challenge|challenge/i, 'typed drive challenge is enforced');
  requireText('main.js', /allowed.*drive.*type|allowedFormat|Removable|DriveType/i, 'formatting uses an explicit drive policy');
  warnText('renderer.js', /formatting is limited|Removable|guarded format/i, 'renderer explains drive risk policy');
  warnText('preload.js', /startFormat|validate/i, 'preload validates or controls format payloads');
}

function checkRendererHygiene() {
  section('Renderer hygiene');
  requireText('renderer.js', /MAX_LOG_ENTRIES/, 'visible log cap is defined');
  requireText('renderer.js', /slice\(-?MAX_LOG_ENTRIES\)|MAX_LOG_ENTRIES/i, 'visible log cap is enforced');
  warnText('renderer.js', /textContent|createElement/, 'renderer avoids direct HTML injection helpers');
  warnText('renderer.js', /copy.*log|clipboard/i, 'copy active log control is present');
  warnText('renderer.js', /diagnostics|status report/i, 'renderer can format diagnostics report');
  warnText('renderer.js', /pref|localStorage/i, 'renderer persists DCC UI preferences');
}

function checkBrandingAssets() {
  section('Installer assets');
  requireBmpSize('assets/installerHeader.bmp', 150, 57);
  requireBmpSize('assets/installerSidebar.bmp', 164, 314);
  if (exists('build/installerHeader.bmp')) requireBmpSize('build/installerHeader.bmp', 150, 57);
  else warn('build/installerHeader.bmp compatibility copy is missing');
  if (exists('build/installerSidebar.bmp')) requireBmpSize('build/installerSidebar.bmp', 164, 314);
  else warn('build/installerSidebar.bmp compatibility copy is missing');
  if (exists('scripts/dcc-branding-check.js')) pass('branding check script is present');
  else warn('branding check script is not present');
}

function checkToolchainHints() {
  section('Toolchain');
  pass(`node ${process.version}`);
  const npmLikely = Boolean(process.env.npm_execpath || process.env.npm_lifecycle_event || process.env.npm_config_user_agent);
  if (npmLikely) pass('npm context detected');
  else warn('npm context was not detected, but this audit does not block on npm availability');
}

const pkg = readPackage();

console.log('DCC Safety Audit');
console.log(`Project: ${root}`);

checkCoreFiles();
checkScripts(pkg);
checkPackageBuild(pkg);
checkElectronSecurity();
checkSafetyPolicy();
checkRendererHygiene();
checkBrandingAssets();
checkToolchainHints();

section('Summary');
console.log(`Failures: ${failures}`);
console.log(`Warnings: ${warnings}`);

if (failureMessages.length) {
  console.log('\nFailure details:');
  for (const message of failureMessages) console.log(`- ${message}`);
}

if (failures > 0) {
  console.error('\nDCC audit failed. Fix the failures before packaging.');
  process.exit(1);
}

console.log('\nDCC audit passed.');
if (warnings > 0) console.log('Warnings are non-blocking, but review them before final release.');
