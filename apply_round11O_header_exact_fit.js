#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const patchRoot = __dirname;

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
  const bak = `${full}.round11O.bak`;
  if (!fs.existsSync(bak)) {
    fs.copyFileSync(full, bak);
    console.log(`[OK] backup ${rel}.round11O.bak`);
  }
}

function copyIfPresent(rel) {
  const src = path.join(patchRoot, rel);
  const dest = filePath(rel);
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`[OK] refreshed ${rel}`);
}

function stripPriorRound11HeaderBlocks(css) {
  const blocks = [
    /\/\* === ROUND11K[\s\S]*?HEADER[\s\S]*?START === \*\/[\s\S]*?\/\* === ROUND11K[\s\S]*?END === \*\//gi,
    /\/\* === ROUND11L[\s\S]*?HEADER[\s\S]*?START === \*\/[\s\S]*?\/\* === ROUND11L[\s\S]*?END === \*\//gi,
    /\/\* === ROUND11M[\s\S]*?HEADER[\s\S]*?START === \*\/[\s\S]*?\/\* === ROUND11M[\s\S]*?END === \*\//gi,
    /\/\* === ROUND11N[\s\S]*?HEADER[\s\S]*?START === \*\/[\s\S]*?\/\* === ROUND11N[\s\S]*?END === \*\//gi,
    /\/\* === ROUND11O HEADER EXACT FIT START === \*\/[\s\S]*?\/\* === ROUND11O HEADER EXACT FIT END === \*\//g
  ];
  for (const pattern of blocks) css = css.replace(pattern, '').trimEnd();
  return css;
}

function patchIndex() {
  backup('index.html');
  let html = read('index.html');

  const lockedLogo = '<div class="brand-badge" aria-hidden="true"><img class="dcc-header-logo dcc-titlebar-logo" src="assets/dcc-logo-64.png" alt=""></div>';
  const badgePattern = /<div\s+class=["']brand-badge["']\s+aria-hidden=["']true["']>\s*<img[^>]*>\s*<\/div>/i;

  if (badgePattern.test(html)) {
    html = html.replace(badgePattern, lockedLogo);
  } else {
    html = html.replace(/(<div\s+class=["']brand-lockup["']\s*>)/i, `$1\n        ${lockedLogo}`);
  }

  write('index.html', html);
}

function patchStyles() {
  backup('styles.css');
  let css = read('styles.css');
  css = stripPriorRound11HeaderBlocks(css);

  const finalBlock = `

/* === ROUND11O HEADER EXACT FIT START === */
/* Exact titlebar lockup fix: compact logo, two-line brand text, no clipping, no crowding. */
.app-shell {
  grid-template-rows: 58px 1px minmax(0, 1fr) 70px !important;
}

.titlebar {
  height: 58px !important;
  min-height: 58px !important;
  max-height: 58px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 16px !important;
  padding: 0 0 0 16px !important;
  overflow: hidden !important;
}

.brand-lockup {
  height: 58px !important;
  min-height: 58px !important;
  display: grid !important;
  grid-template-columns: 38px minmax(0, auto) !important;
  column-gap: 12px !important;
  align-items: center !important;
  flex: 0 1 auto !important;
  min-width: 0 !important;
  overflow: visible !important;
}

.brand-badge {
  width: 38px !important;
  height: 38px !important;
  min-width: 38px !important;
  max-width: 38px !important;
  min-height: 38px !important;
  max-height: 38px !important;
  display: grid !important;
  place-items: center !important;
  align-self: center !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  border-radius: 10px !important;
  flex: 0 0 38px !important;
}

.brand-badge img,
.brand-badge .dcc-header-logo,
.brand-badge .dcc-titlebar-logo {
  width: 100% !important;
  height: 100% !important;
  min-width: 0 !important;
  min-height: 0 !important;
  max-width: 100% !important;
  max-height: 100% !important;
  flex: initial !important;
  object-fit: cover !important;
  object-position: center !important;
  display: block !important;
  align-self: center !important;
  margin: 0 !important;
  padding: 0 !important;
  border-radius: 0 !important;
  box-sizing: border-box !important;
  transform: none !important;
}

.brand-copy {
  min-width: 0 !important;
  display: grid !important;
  grid-template-rows: auto auto !important;
  row-gap: 4px !important;
  align-content: center !important;
  justify-content: start !important;
  height: auto !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: visible !important;
  line-height: 1 !important;
}

.brand-line {
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
  min-height: 20px !important;
  height: auto !important;
  line-height: 1 !important;
  white-space: nowrap !important;
  overflow: visible !important;
  margin: 0 !important;
  padding: 0 !important;
}

.brand-name {
  display: block !important;
  font-size: 19px !important;
  line-height: 1 !important;
  letter-spacing: 1.55px !important;
  white-space: nowrap !important;
  margin: 0 !important;
  padding: 0 !important;
  transform: none !important;
}

.brand-separator {
  width: 1px !important;
  height: 14px !important;
  flex: 0 0 1px !important;
  margin: 0 1px !important;
}

.brand-by {
  display: block !important;
  font-size: 10px !important;
  line-height: 1 !important;
  letter-spacing: 1px !important;
  white-space: nowrap !important;
  margin: 0 !important;
  padding: 1px 0 0 !important;
  transform: none !important;
}

.brand-subtitle {
  display: block !important;
  font-size: 9.8px !important;
  line-height: 1 !important;
  letter-spacing: 1.15px !important;
  white-space: nowrap !important;
  overflow: visible !important;
  text-overflow: clip !important;
  margin: 0 !important;
  padding: 0 !important;
  transform: none !important;
}

.titlebar-meta {
  height: 58px !important;
  min-height: 58px !important;
  display: flex !important;
  align-items: center !important;
  align-self: stretch !important;
  gap: 10px !important;
  margin-left: auto !important;
  flex: 0 0 auto !important;
}

.titlebar-meta .pill,
.titlebar-btn {
  min-height: 30px !important;
  height: 30px !important;
  align-self: center !important;
}

.window-controls {
  height: 58px !important;
  display: flex !important;
  align-items: center !important;
}

.window-btn {
  height: 42px !important;
}

@media (max-width: 1180px) {
  .brand-name { font-size: 18px !important; }
  .brand-subtitle { font-size: 9.3px !important; letter-spacing: 1px !important; }
  .titlebar-meta { gap: 6px !important; }
}

@media (max-width: 980px) {
  .app-shell { grid-template-rows: 58px 1px minmax(0, 1fr) auto !important; }
  .titlebar { min-height: 58px !important; }
}
/* === ROUND11O HEADER EXACT FIT END === */
`;

  css = `${css}${finalBlock}`;
  write('styles.css', css);
}

try {
  copyIfPresent('assets/dcc-logo-64.png');
  patchIndex();
  patchStyles();
  console.log('\nDCC Round 11O header exact fit applied.');
  console.log('Next: npm run test:rc && npm run start');
} catch (error) {
  console.error(`[FAIL] ${error.message}`);
  process.exit(1);
}
