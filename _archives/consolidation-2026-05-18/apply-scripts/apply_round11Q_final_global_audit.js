#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const patchRoot = __dirname;

function filePath(rel) { return path.join(root, rel); }
function srcPath(rel) { return path.join(patchRoot, rel); }
function copy(rel) {
  const src = srcPath(rel);
  const dest = filePath(rel);
  if (!fs.existsSync(src)) throw new Error(`Missing patch file: ${rel}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`[OK] copied ${rel}`);
}
function backup(rel, tag = 'round11Q') {
  const full = filePath(rel);
  if (!fs.existsSync(full)) return;
  const bak = `${full}.${tag}.bak`;
  if (!fs.existsSync(bak)) {
    fs.copyFileSync(full, bak);
    console.log(`[OK] backup ${rel}.${tag}.bak`);
  }
}
function patchPackageScripts() {
  const pkgFile = filePath('package.json');
  if (!fs.existsSync(pkgFile)) throw new Error('Missing package.json');
  backup('package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:global'] = 'node scripts/dcc-final-global-check.js';
  pkg.scripts['qa:final'] = 'npm run branding:lock && npm run test:rc && npm run test:global';
  fs.writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  console.log('[OK] patched package.json scripts: test:global, qa:final');
}

try {
  copy('scripts/dcc-final-global-check.js');
  copy('docs/DCC_FINAL_GLOBAL_QA_CHECKLIST.md');
  patchPackageScripts();
  console.log('\nDCC Round 11Q final global audit installed.');
  console.log('Run: npm run qa:final');
  console.log('Then run: npm run start');
} catch (error) {
  console.error(`[FAIL] ${error.message}`);
  process.exit(1);
}
