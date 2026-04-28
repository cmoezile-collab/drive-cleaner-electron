#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = process.cwd();
let failures = 0;
function pass(m){ console.log(`[OK] ${m}`); }
function fail(m){ failures += 1; console.error(`[FAIL] ${m}`); }
function exists(rel){ return fs.existsSync(path.join(root, rel)); }
function checkBmp(rel, w, h){
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return fail(`${rel} missing`);
  const b = fs.readFileSync(file);
  if (b.length < 26) return fail(`${rel} is too small to be a BMP`);
  const width = b.readInt32LE(18);
  const height = Math.abs(b.readInt32LE(22));
  if (width === w && height === h) pass(`${rel} is ${w}x${h}`);
  else fail(`${rel} should be ${w}x${h}, found ${width}x${height}`);
}
function sameFile(a,b){
  const pa = path.join(root,a), pb = path.join(root,b);
  if (!fs.existsSync(pa) || !fs.existsSync(pb)) return false;
  return fs.readFileSync(pa).equals(fs.readFileSync(pb));
}
console.log('DCC branding check');
[
  'assets/dcc.ico','assets/icon.png','assets/dcc-logo.png','assets/dcc-logo-256.png','assets/dcc-logo-128.png','assets/dcc-logo-64.png','assets/dcc-mark.svg',
  'assets/installerHeader.bmp','assets/installerSidebar.bmp',
  'build/installerHeader.bmp','build/installerSidebar.bmp'
].forEach(rel => exists(rel) ? pass(`${rel} exists`) : fail(`${rel} missing`));
checkBmp('assets/installerHeader.bmp',150,57);
checkBmp('assets/installerSidebar.bmp',164,314);
if (sameFile('assets/installerHeader.bmp','build/installerHeader.bmp')) pass('build header matches canonical assets header'); else fail('build header does not match assets header');
if (sameFile('assets/installerSidebar.bmp','build/installerSidebar.bmp')) pass('build sidebar matches canonical assets sidebar'); else fail('build sidebar does not match assets sidebar');
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  const nsis = (pkg.build && pkg.build.nsis) || {};
  const win = (pkg.build && pkg.build.win) || {};
  if (win.icon === 'assets/dcc.ico') pass('Windows icon path uses assets/dcc.ico'); else fail('Windows icon path is not assets/dcc.ico');
  if (nsis.installerIcon === 'assets/dcc.ico') pass('NSIS installer icon uses assets/dcc.ico'); else fail('NSIS installer icon is not assets/dcc.ico');
  if (nsis.installerHeader === 'assets/installerHeader.bmp') pass('NSIS header path locked to assets'); else fail('NSIS header path is not assets/installerHeader.bmp');
  if (nsis.installerSidebar === 'assets/installerSidebar.bmp') pass('NSIS sidebar path locked to assets'); else fail('NSIS sidebar path is not assets/installerSidebar.bmp');
  if (nsis.uninstallerSidebar === 'assets/installerSidebar.bmp') pass('NSIS uninstaller sidebar path locked to assets'); else fail('NSIS uninstaller sidebar is not assets/installerSidebar.bmp');
} catch (e) { fail(`package.json check failed: ${e.message}`); }
console.log(`\nFailures: ${failures}`);
if (failures) process.exit(1);
console.log('DCC branding check passed.');
