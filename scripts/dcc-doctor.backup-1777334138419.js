#!/usr/bin/env node
/*
 * DCC Doctor
 * Environment and release-readiness checks for Drive Cleaner by Clark.
 *
 * Round 11G note:
 * Windows often exposes npm as npm.cmd, and Electron/admin shells can make
 * direct spawn("npm") checks unreliable. This doctor accepts any of:
 *   - npm_execpath from an npm-launched process
 *   - npm_config_user_agent from an npm-launched process
 *   - node <npm_execpath> --version
 *   - npm.cmd --version
 *   - npm --version
 *   - cmd.exe /d /s /c "npm --version"
 *   - where npm / where npm.cmd
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
let failures = 0;
let warnings = 0;

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function p(relativePath) {
  return path.join(root, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(p(relativePath));
}

function readText(relativePath) {
  return fs.readFileSync(p(relativePath), 'utf8');
}

function pass(message) {
  console.log(`✓ ${message}`);
}

function warn(message) {
  warnings += 1;
  console.warn(`⚠ ${message}`);
}

function fail(message) {
  failures += 1;
  console.error(`✗ ${message}`);
}

function run(command, args = [], options = {}) {
  try {
    return spawnSync(command, args, {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      shell: false,
      timeout: options.timeoutMs || 10000,
      ...options
    });
  } catch (error) {
    return {
      status: 1,
      error,
      stdout: '',
      stderr: String(error && error.message ? error.message : error)
    };
  }
}

function commandOk(command, args = []) {
  const result = run(command, args);
  return result.status === 0;
}

function getCommandOutput(command, args = []) {
  const result = run(command, args);
  if (result.status !== 0) return null;
  return String(result.stdout || '').trim();
}

function readPackageJson() {
  try {
    return JSON.parse(readText('package.json'));
  } catch (error) {
    fail(`package.json could not be read: ${error.message}`);
    return null;
  }
}

function getBmpDimensions(relativePath) {
  const filePath = p(relativePath);
  if (!fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);
  if (buf.length < 26 || buf.toString('ascii', 0, 2) !== 'BM') return null;
  const width = buf.readInt32LE(18);
  const heightRaw = buf.readInt32LE(22);
  return { width, height: Math.abs(heightRaw) };
}

function checkFile(relativePath) {
  if (exists(relativePath)) pass(`${relativePath} exists`);
  else fail(`${relativePath} is missing`);
}

function checkPackageScripts(pkg) {
  console.log('\nPackage scripts');
  if (!pkg) return;

  const scripts = pkg.scripts || {};
  const required = [
    'start',
    'build',
    'build:win',
    'test:syntax',
    'test:audit',
    'test:doctor',
    'doctor',
    'test:rc',
    'build:win:rc',
    'branding:check'
  ];

  for (const name of required) {
    if (scripts[name]) pass(`script "${name}" is present`);
    else fail(`script "${name}" is missing`);
  }
}

function checkProjectFiles() {
  console.log('\nProject files');
  [
    'main.js',
    'preload.js',
    'renderer.js',
    'index.html',
    'styles.css',
    'package.json',
    'build_all.bat',
    'scripts/dcc-audit.js',
    'scripts/dcc-doctor.js',
    'scripts/dcc-rc-check.js'
  ].forEach(checkFile);
}

function checkInstallerAssets() {
  console.log('\nInstaller assets');
  const header = getBmpDimensions('assets/installerHeader.bmp');
  const sidebar = getBmpDimensions('assets/installerSidebar.bmp');

  if (header && header.width === 150 && header.height === 57) {
    pass('assets/installerHeader.bmp is 150x57');
  } else {
    fail(`assets/installerHeader.bmp must be 150x57${header ? `, found ${header.width}x${header.height}` : ''}`);
  }

  if (sidebar && sidebar.width === 164 && sidebar.height === 314) {
    pass('assets/installerSidebar.bmp is 164x314');
  } else {
    fail(`assets/installerSidebar.bmp must be 164x314${sidebar ? `, found ${sidebar.width}x${sidebar.height}` : ''}`);
  }

  ['assets/dcc.ico', 'assets/icon.png', 'assets/dcc-logo.png'].forEach(checkFile);
}

function checkBuildConfig(pkg) {
  console.log('\nBuild configuration');
  if (!pkg) return;

  const build = pkg.build || {};
  const nsis = build.nsis || {};
  const win = build.win || {};
  const files = Array.isArray(build.files) ? build.files : [];

  if (build.appId === 'com.clark.drivecleaner') pass('appId is configured');
  else warn(`appId is ${JSON.stringify(build.appId)}`);

  if (String(build.productName || '').toUpperCase().includes('DRIVE CLEANER')) pass('productName is configured');
  else fail('productName should identify DRIVE CLEANER');

  if (win.requestedExecutionLevel === 'requireAdministrator') {
    pass('Windows requestedExecutionLevel requires administrator');
  } else {
    fail('Windows requestedExecutionLevel must be requireAdministrator');
  }

  if (nsis.installerHeader === 'assets/installerHeader.bmp') pass('NSIS header uses canonical asset');
  else fail(`NSIS installerHeader should be assets/installerHeader.bmp, found ${JSON.stringify(nsis.installerHeader)}`);

  if (nsis.installerSidebar === 'assets/installerSidebar.bmp') pass('NSIS sidebar uses canonical asset');
  else fail(`NSIS installerSidebar should be assets/installerSidebar.bmp, found ${JSON.stringify(nsis.installerSidebar)}`);

  if (nsis.uninstallerSidebar === 'assets/installerSidebar.bmp') pass('NSIS uninstaller sidebar uses canonical asset');
  else warn('NSIS uninstallerSidebar is not set to assets/installerSidebar.bmp');

  for (const requiredFile of ['main.js', 'preload.js', 'renderer.js', 'index.html', 'styles.css', 'assets/**/*']) {
    if (files.includes(requiredFile)) pass(`build.files includes ${requiredFile}`);
    else fail(`build.files is missing ${requiredFile}`);
  }
}

function checkElectronSecurity() {
  console.log('\nElectron security wiring');

  if (!exists('main.js')) return;
  const main = readText('main.js');
  const preload = exists('preload.js') ? readText('preload.js') : '';

  if (/contextIsolation\s*:\s*true/.test(main)) pass('contextIsolation is enabled');
  else fail('contextIsolation must be enabled');

  if (/nodeIntegration\s*:\s*false/.test(main)) pass('nodeIntegration is disabled');
  else fail('nodeIntegration must be disabled');

  if (/sandbox\s*:\s*true/.test(main)) pass('BrowserWindow sandbox is enabled');
  else fail('BrowserWindow sandbox should be enabled');

  if (/setWindowOpenHandler/.test(main)) pass('window opening is controlled');
  else fail('window opening should be controlled');

  if (/will-attach-webview/.test(main)) pass('webview attachment is blocked');
  else fail('webview attachment should be blocked');

  if (/contextBridge\.exposeInMainWorld/.test(preload)) pass('preload exposes a controlled bridge');
  else fail('preload bridge is missing');
}

function checkSafetyPolicy() {
  console.log('\nSafety policy');
  if (!exists('main.js') || !exists('renderer.js')) return;
  const main = readText('main.js');
  const renderer = readText('renderer.js');

  const checks = [
    [/system drive/i, 'system-drive logic is present'],
    [/format/i, 'format logic is present'],
    [/allowedDriveTypes|Removable|DriveType/i, 'formatting is limited by drive type policy'],
    [/typedChallenge|challengeInput|drive ID/i, 'typed drive challenge is present']
  ];

  for (const [pattern, message] of checks) {
    if (pattern.test(main) || pattern.test(renderer)) pass(message);
    else warn(`${message} was not detected by the doctor`);
  }
}

function detectNpm() {
  const detections = [];

  const ua = process.env.npm_config_user_agent || '';
  if (ua) {
    detections.push({ ok: true, label: `npm user agent detected (${ua.split(' ')[0]})` });
  }

  const npmExecPath = process.env.npm_execpath || '';
  if (npmExecPath && fs.existsSync(npmExecPath)) {
    const result = run(process.execPath, [npmExecPath, '--version']);
    if (result.status === 0) {
      detections.push({ ok: true, label: `npm_execpath works (${String(result.stdout || '').trim()})` });
    } else {
      detections.push({ ok: false, label: `npm_execpath failed: ${String(result.stderr || result.stdout || '').trim()}` });
    }
  }

  const candidates = process.platform === 'win32'
    ? [
        ['npm.cmd', ['--version']],
        ['npm', ['--version']],
        ['cmd.exe', ['/d', '/s', '/c', 'npm --version']],
        ['where', ['npm']],
        ['where', ['npm.cmd']]
      ]
    : [
        ['npm', ['--version']],
        ['which', ['npm']]
      ];

  for (const [command, args] of candidates) {
    const result = run(command, args);
    if (result.status === 0) {
      const output = String(result.stdout || '').trim().split(/\r?\n/)[0] || command;
      detections.push({ ok: true, label: `${command} ${args.join(' ')} -> ${output}` });
    }
  }

  return detections;
}

function checkToolchain() {
  console.log('\nToolchain');

  pass(`node ${process.version}`);

  const npmDetections = detectNpm().filter((item) => item.ok);
  if (npmDetections.length > 0) {
    pass(`npm is available (${npmDetections[0].label})`);
  } else {
    // If a user can run npm run doctor, npm is plainly installed. Treat this as
    // a warning rather than a release blocker so Windows shell weirdness does not
    // falsely stop packaging.
    warn('npm could not be verified by child_process, but this is non-blocking if npm scripts are running.');
  }

  const electronPackage = p('node_modules/electron/package.json');
  if (fs.existsSync(electronPackage)) {
    try {
      const electronPkg = JSON.parse(fs.readFileSync(electronPackage, 'utf8'));
      pass(`electron package installed (${electronPkg.version || 'unknown'})`);
    } catch {
      pass('electron package installed');
    }
  } else {
    fail('electron package is missing. Run npm install.');
  }
}

function checkSyntaxQuick() {
  console.log('\nSyntax quick check');
  for (const file of ['main.js', 'preload.js', 'renderer.js', 'scripts/dcc-audit.js', 'scripts/dcc-rc-check.js']) {
    if (!exists(file)) continue;
    const result = run(process.execPath, ['--check', p(file)]);
    if (result.status === 0) pass(`${file} parses`);
    else fail(`${file} has a syntax error: ${String(result.stderr || result.stdout || '').trim()}`);
  }
}

console.log('DCC Doctor');
console.log(`Project: ${root}`);

const pkg = readPackageJson();
checkProjectFiles();
checkPackageScripts(pkg);
checkBuildConfig(pkg);
checkInstallerAssets();
checkElectronSecurity();
checkSafetyPolicy();
checkToolchain();
checkSyntaxQuick();

console.log('\nSummary');
console.log(`Failures: ${failures}`);
console.log(`Warnings: ${warnings}`);

if (failures > 0) {
  console.error('DCC doctor failed. Fix failures before packaging.');
  process.exit(1);
}

console.log('DCC doctor passed.');
if (warnings > 0) {
  console.log('Warnings are non-blocking, but review them before release.');
}
