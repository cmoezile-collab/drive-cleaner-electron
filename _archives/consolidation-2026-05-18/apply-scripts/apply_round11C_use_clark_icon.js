#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const here = __dirname;
function copy(rel) {
  const source = path.join(here, rel);
  const target = path.join(root, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  console.log(`  ✓ ${rel}`);
}

const assets = [
  'assets/dcc.ico',
  'assets/icon.png',
  'assets/dcc-logo.png',
  'assets/dcc-logo-256.png',
  'assets/dcc-logo-128.png',
  'assets/dcc-logo-64.png',
  'assets/dcc-logo-32.png',
  'assets/dcc-logo-16.png',
  'assets/dcc-mark.svg',
  'assets/installerHeader.bmp',
  'assets/installerSidebar.bmp',
  'assets/installerHeader_preview.png',
  'assets/installerSidebar_preview.png',
  'build/installerHeader.bmp',
  'build/installerSidebar.bmp'
];

console.log('DCC Round 11C: applying Clark-provided icon + installer branding');
for (const rel of assets) copy(rel);

const packagePath = path.join(root, 'package.json');
if (fs.existsSync(packagePath)) {
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  pkg.build = pkg.build || {};
  pkg.build.win = pkg.build.win || {};
  pkg.build.nsis = pkg.build.nsis || {};
  pkg.build.win.icon = 'assets/dcc.ico';
  pkg.build.nsis.installerIcon = 'assets/dcc.ico';
  pkg.build.nsis.uninstallerIcon = 'assets/dcc.ico';
  pkg.build.nsis.installerHeader = 'assets/installerHeader.bmp';
  pkg.build.nsis.installerSidebar = 'assets/installerSidebar.bmp';
  pkg.build.nsis.uninstallerSidebar = 'assets/installerSidebar.bmp';
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['branding:check'] = 'node scripts/dcc-branding-check.js';
  fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
  console.log('  ✓ package.json branding paths locked');
} else {
  console.warn('  ! package.json not found; copied assets only');
}

copy('scripts/dcc-branding-check.js');
console.log('\nDone. Run: npm run branding:check && npm test && npm run doctor && npm run test:rc');
