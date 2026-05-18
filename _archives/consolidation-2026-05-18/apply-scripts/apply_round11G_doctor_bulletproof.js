#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const src = path.join(__dirname, 'scripts', 'dcc-doctor.js');
const destDir = path.join(root, 'scripts');
const dest = path.join(destDir, 'dcc-doctor.js');

if (!fs.existsSync(path.join(root, 'package.json'))) {
  console.error('Run this from the DCC project root. package.json was not found.');
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
if (fs.existsSync(dest)) {
  fs.copyFileSync(dest, path.join(destDir, `dcc-doctor.backup-${Date.now()}.js`));
}
fs.copyFileSync(src, dest);
console.log('DCC Round 11G applied: scripts/dcc-doctor.js replaced with robust npm detection.');
