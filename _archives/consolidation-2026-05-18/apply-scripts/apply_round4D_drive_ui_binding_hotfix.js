#!/usr/bin/env node
/*
 * DCC Round 4D - Drive UI Binding Hotfix
 *
 * Fixes the case where STATUS/diagnostics can see drives, but the renderer
 * dropdown stays empty because IPC drive responses are wrapped as objects
 * instead of plain arrays.
 *
 * Run from the Drive Cleaner by Clark project root:
 *   node apply_round4D_drive_ui_binding_hotfix.js
 */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const rendererPath = path.join(root, 'renderer.js');

function fail(message) {
  console.error(`\n[DCC Round 4D] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(rendererPath)) {
  fail(`renderer.js not found in ${root}`);
}

let text = fs.readFileSync(rendererPath, 'utf8');
const original = text;

const helper = `
function unwrapAppResponse(value) {
  if (!value || typeof value !== 'object') {
    return value || {};
  }

  // Secure IPC wrappers may return { ok, data }, { ok, state }, or { ok, result }.
  if (value.ok === true) {
    if (value.state && typeof value.state === 'object') return value.state;
    if (value.data && typeof value.data === 'object') return value.data;
    if (value.result && typeof value.result === 'object') return value.result;
  }

  return value;
}

function normalizeDriveListResponse(value) {
  const unwrapped = unwrapAppResponse(value);

  if (Array.isArray(unwrapped)) return unwrapped;
  if (!unwrapped || typeof unwrapped !== 'object') return [];

  if (Array.isArray(unwrapped.drives)) return unwrapped.drives;
  if (Array.isArray(unwrapped.driveList)) return unwrapped.driveList;
  if (Array.isArray(unwrapped.items)) return unwrapped.items;
  if (Array.isArray(unwrapped.data)) return unwrapped.data;
  if (Array.isArray(unwrapped.result)) return unwrapped.result;

  return [];
}
`;

if (!text.includes('function normalizeDriveListResponse')) {
  if (text.includes('const elements = {};')) {
    text = text.replace('const elements = {};', `const elements = {};\n${helper}`);
  } else {
    text = `${helper}\n${text}`;
  }
}

// Make bootstrap tolerant of wrapped init responses.
text = text.replace(
  /const\s+initial\s*=\s*await\s+window\.driveCleaner\.getInitialState\(\);/,
  'const initial = unwrapAppResponse(await window.driveCleaner.getInitialState());'
);

// Make populateDrives always receive a normalized array, even if callers pass a wrapped response.
text = text.replace(
  /function\s+populateDrives\s*\(\s*drives\s*\)\s*\{(?!\s*drives\s*=\s*normalizeDriveListResponse)/,
  'function populateDrives(drives) {\n  drives = normalizeDriveListResponse(drives);'
);

// Make refreshDrives normalize the IPC response before logging/counting.
if (text.includes('const drives = await window.driveCleaner.refreshDrives();') &&
    !text.includes('const driveList = normalizeDriveListResponse(drives);')) {
  text = text.replace(
    'const drives = await window.driveCleaner.refreshDrives();',
    'const drives = await window.driveCleaner.refreshDrives();\n  const driveList = normalizeDriveListResponse(drives);'
  );
  text = text.replace(
    /populateDrives\(drives\s*\|\|\s*\[\]\);/,
    'populateDrives(driveList);'
  );
  text = text.replace(/\$\{drives\.length\}/g, '${driveList.length}');
}

// If bootstrap is awaited without a catch, add a visible failure path.
if (text.includes('await bootstrap();') && !text.includes('[DCC] Bootstrap failed')) {
  text = text.replace(
    'await bootstrap();',
    `try {\n    await bootstrap();\n  } catch (error) {\n    console.error('[DCC] Bootstrap failed:', error);\n    if (typeof showToast === 'function') {\n      showToast('error', 'Startup Failed', error.message || 'Drive Cleaner could not finish loading.');\n    }\n    if (typeof appendLog === 'function') {\n      appendLog('clean', \`Startup failed: \${error.message || error}\`, 'red');\n    }\n  }`
  );
}

if (text === original) {
  console.log('[DCC Round 4D] No changes were needed. renderer.js already appears patched.');
  process.exit(0);
}

const backupPath = path.join(root, `renderer.round4D-backup-${Date.now()}.js`);
fs.writeFileSync(backupPath, original, 'utf8');
fs.writeFileSync(rendererPath, text, 'utf8');

console.log('[DCC Round 4D] renderer.js patched successfully.');
console.log(`[DCC Round 4D] Backup saved: ${path.basename(backupPath)}`);
console.log('[DCC Round 4D] Next: npm test && npm start');
