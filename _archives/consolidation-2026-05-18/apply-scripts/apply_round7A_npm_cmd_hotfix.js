#!/usr/bin/env node
/*
 * DCC Round 7A - npm.cmd detection hotfix
 * Fixes Windows doctor/RC scripts that call spawnSync('npm', ...)
 * without resolving npm.cmd.
 */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const targets = [
  path.join(root, 'scripts', 'dcc-doctor.js'),
  path.join(root, 'scripts', 'dcc-rc-check.js'),
];

const helper = `
function dccToolCommand(name) {
  if (process.platform === 'win32') {
    if (name === 'npm') return 'npm.cmd';
    if (name === 'npx') return 'npx.cmd';
  }
  return name;
}
`;

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`- skipped missing ${path.relative(root, filePath)}`);
    return false;
  }

  let text = fs.readFileSync(filePath, 'utf8');
  const original = text;

  if (!text.includes('function dccToolCommand(name)')) {
    const childProcessRequire = /const\s*\{\s*spawnSync\s*\}\s*=\s*require\(['"]child_process['"]\);?/;
    if (childProcessRequire.test(text)) {
      text = text.replace(childProcessRequire, (match) => `${match}\n${helper}`);
    } else {
      text = `const { spawnSync } = require('child_process');\n${helper}\n${text}`;
    }
  }

  text = text
    .replace(/spawnSync\(\s*['"]npm['"]\s*,/g, "spawnSync(dccToolCommand('npm'),")
    .replace(/spawnSync\(\s*['"]npx['"]\s*,/g, "spawnSync(dccToolCommand('npx'),");

  if (text !== original) {
    fs.writeFileSync(filePath, text, 'utf8');
    console.log(`✓ patched ${path.relative(root, filePath)}`);
    return true;
  }

  console.log(`✓ no changes needed ${path.relative(root, filePath)}`);
  return false;
}

console.log('DCC Round 7A npm.cmd detection hotfix');
console.log(`Project: ${root}`);
let patched = 0;
for (const target of targets) {
  if (patchFile(target)) patched += 1;
}
console.log(`Done. Files changed: ${patched}`);
console.log('Next: npm test && npm run doctor && npm run test:rc');
