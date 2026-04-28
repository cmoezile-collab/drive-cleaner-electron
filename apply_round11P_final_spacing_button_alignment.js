#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();

function filePath(rel) {
  return path.join(root, rel);
}

function read(rel) {
  const full = filePath(rel);
  if (!fs.existsSync(full)) throw new Error(`Missing required file: ${rel}`);
  return fs.readFileSync(full, 'utf8');
}

function write(rel, text) {
  fs.writeFileSync(filePath(rel), text, 'utf8');
  console.log(`[OK] patched ${rel}`);
}

function backup(rel) {
  const full = filePath(rel);
  if (!fs.existsSync(full)) return;
  const bak = `${full}.round11P.bak`;
  if (!fs.existsSync(bak)) {
    fs.copyFileSync(full, bak);
    console.log(`[OK] backup ${rel}.round11P.bak`);
  }
}

function stripPriorRound11P(css) {
  return css
    .replace(/\n?\/\* === ROUND11P FINAL SPACING \+ BUTTON ALIGNMENT START === \*\/[\s\S]*?\/\* === ROUND11P FINAL SPACING \+ BUTTON ALIGNMENT END === \*\//g, '')
    .trimEnd();
}

function patchStyles() {
  backup('styles.css');
  let css = read('styles.css');
  css = stripPriorRound11P(css);

  const block = `

/* === ROUND11P FINAL SPACING + BUTTON ALIGNMENT START === */
/* Last visual polish pass: sidebar card breathing room + true centered button labels. */
.sidebar-section > .card {
  flex: 0 0 auto;
}

.sidebar-section > .card + .card {
  margin-top: 16px !important;
}

.sidebar-section > .card:last-of-type {
  margin-bottom: 16px !important;
}

.btn,
.titlebar-btn,
.choice-pill span {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  line-height: 1 !important;
  white-space: nowrap !important;
}

.btn {
  min-height: 38px !important;
  height: 38px;
  padding: 0 16px !important;
}

.btn-block {
  display: flex !important;
  width: 100% !important;
}

.footer-actions,
.footer-actions-group {
  display: flex !important;
  align-items: center !important;
}

.footer-actions {
  flex: 1 1 auto;
  justify-content: flex-end !important;
  gap: 10px !important;
  min-width: 0;
}

.footer-actions-group {
  flex: 0 0 auto;
  gap: 8px !important;
}

.footer-actions .btn {
  flex: 0 0 auto;
  min-height: 38px !important;
  height: 38px !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}

.action-bar {
  min-height: 70px !important;
  height: 70px !important;
  align-items: center !important;
  overflow: hidden !important;
}

.footer-copy {
  align-self: center !important;
  line-height: 1.35 !important;
}

@media (max-width: 1340px) {
  .footer-copy {
    display: none !important;
  }

  .action-bar {
    justify-content: flex-end !important;
  }
}
/* === ROUND11P FINAL SPACING + BUTTON ALIGNMENT END === */
`;

  write('styles.css', `${css}${block}\n`);
}

try {
  patchStyles();
  console.log('\nDCC Round 11P final spacing/button alignment applied.');
  console.log('Run: npm run test:rc && npm run start');
} catch (error) {
  console.error(`[FAIL] ${error.message}`);
  process.exit(1);
}
