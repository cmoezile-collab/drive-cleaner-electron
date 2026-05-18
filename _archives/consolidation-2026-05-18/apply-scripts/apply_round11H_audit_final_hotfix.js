#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const source = path.join(__dirname, 'scripts', 'dcc-audit.js');
const dest = path.join(root, 'scripts', 'dcc-audit.js');

if (!fs.existsSync(path.join(root, 'package.json'))) {
  console.error('Run this from the Drive Cleaner by Clark project root.');
  process.exit(1);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(source, dest);
console.log('DCC Round 11H audit hotfix applied.');
console.log('Next: npm run test:audit');
