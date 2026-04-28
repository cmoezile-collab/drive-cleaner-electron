#!/usr/bin/env node
/*
 * DCC Round 4E - MAX_LOG_ENTRIES Hotfix
 *
 * Fixes runtime error:
 *   MAX_LOG_ENTRIES is not defined
 *
 * The Round 4 log-capping code referenced MAX_LOG_ENTRIES, but the constant
 * was not defined in renderer.js. That error stopped refreshDrives() from
 * completing after appendLog() ran.
 */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const rendererPath = path.join(root, 'renderer.js');
const auditPath = path.join(root, 'scripts', 'dcc-audit.js');

function fail(message) {
  console.error(`\n[DCC Round 4E] ${message}`);
  process.exit(1);
}

function backup(filePath, label) {
  const original = fs.readFileSync(filePath, 'utf8');
  const backupPath = path.join(path.dirname(filePath), `${path.basename(filePath)}.round4E-backup-${Date.now()}`);
  fs.writeFileSync(backupPath, original, 'utf8');
  console.log(`[DCC Round 4E] ${label} backup saved: ${path.relative(root, backupPath)}`);
  return original;
}

if (!fs.existsSync(rendererPath)) {
  fail(`renderer.js not found in ${root}`);
}

let renderer = fs.readFileSync(rendererPath, 'utf8');
let rendererChanged = false;

const hasMaxLogDefinition = /\b(?:const|let|var)\s+MAX_LOG_ENTRIES\b/.test(renderer);
const usesMaxLog = /\bMAX_LOG_ENTRIES\b/.test(renderer);

if (!hasMaxLogDefinition) {
  const line = `const MAX_LOG_ENTRIES = 500;\n`;
  if (/^const\s+state\s*=\s*\{/m.test(renderer)) {
    renderer = renderer.replace(/^const\s+state\s*=\s*\{/m, `${line}\nconst state = {`);
  } else {
    renderer = `${line}\n${renderer}`;
  }
  rendererChanged = true;
  console.log('[DCC Round 4E] Added const MAX_LOG_ENTRIES = 500; to renderer.js');
} else {
  console.log('[DCC Round 4E] renderer.js already defines MAX_LOG_ENTRIES.');
}

if (rendererChanged) {
  backup(rendererPath, 'renderer.js');
  fs.writeFileSync(rendererPath, renderer, 'utf8');
}

if (fs.existsSync(auditPath)) {
  let audit = fs.readFileSync(auditPath, 'utf8');
  const originalAudit = audit;
  audit = audit.replace(
    "expect('renderer.js', 'MAX_LOG_ENTRIES', 'renderer caps visible log growth');",
    "expect('renderer.js', 'const MAX_LOG_ENTRIES', 'renderer defines visible log cap constant');\nexpect('renderer.js', 'while (target.children.length > MAX_LOG_ENTRIES)', 'renderer caps visible log growth');"
  );
  if (audit !== originalAudit) {
    backup(auditPath, 'scripts/dcc-audit.js');
    fs.writeFileSync(auditPath, audit, 'utf8');
    console.log('[DCC Round 4E] Tightened audit check for MAX_LOG_ENTRIES definition.');
  }
}

console.log('\n[DCC Round 4E] Hotfix complete.');
console.log('[DCC Round 4E] Next: npm test && npm start');
if (usesMaxLog && !hasMaxLogDefinition) {
  console.log('[DCC Round 4E] This should unblock Refresh Drives and dropdown population.');
}
