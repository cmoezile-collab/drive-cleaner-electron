const fs = require('fs');
const path = require('path');

const root = process.cwd();
const patchRoot = __dirname;

function file(rel) { return path.join(root, rel); }
function patchFile(rel) { return path.join(patchRoot, rel); }
function exists(rel) { return fs.existsSync(file(rel)); }
function read(rel) { return fs.readFileSync(file(rel), 'utf8'); }
function write(rel, text) { fs.writeFileSync(file(rel), text, 'utf8'); }
function backup(rel) {
  if (!exists(rel)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(file(rel), `${file(rel)}.round11L-${stamp}.bak`);
}
function copyAsset(name) {
  const src = patchFile(path.join('assets', name));
  const dest = file(path.join('assets', name));
  if (!fs.existsSync(src)) throw new Error(`Patch asset missing: assets/${name}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`[OK] assets/${name}`);
}
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function replaceBetweenMarkers(text, start, end, block) {
  const pattern = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`, 'g');
  return pattern.test(text) ? text.replace(pattern, block) : text;
}

function patchRenderer() {
  const rel = 'renderer.js';
  if (!exists(rel)) throw new Error('renderer.js not found. Run this from the DCC project root.');
  backup(rel);
  let js = read(rel);

  const start = '// ROUND11K_HEADER_LOGO_LOCK_START';
  const end = '// ROUND11K_HEADER_LOGO_LOCK_END';
  const block = `${start}
function lockHeaderBrandLogo() {
  const sources = ['assets/dcc-logo-32.png', 'assets/dcc-logo-64.png', 'assets/dcc-logo.png', 'assets/icon.png'];
  const selectors = [
    '.dcc-header-logo',
    '.titlebar img',
    '.window-titlebar img',
    '.topbar img',
    '.app-header img',
    '.header img',
    '.brand img',
    '.app-brand img',
    '[class*="brand"] img',
    '[class*="logo"] img',
    '[class*="mark"] img',
    'header img'
  ];

  let img = null;
  for (const selector of selectors) {
    img = document.querySelector(selector);
    if (img) break;
  }

  if (!img) {
    const host = document.querySelector('.brand, .app-brand, .titlebar, .window-titlebar, .topbar, .app-header, .header, header');
    if (!host) return;
    img = document.createElement('img');
    host.prepend(img);
  }

  img.classList.add('dcc-header-logo');
  img.alt = 'DCC';
  img.decoding = 'async';
  img.draggable = false;
  img.width = 34;
  img.height = 34;

  let index = 0;
  img.addEventListener('error', () => {
    index += 1;
    if (index < sources.length) img.src = sources[index];
  });

  if (!sources.some((source) => img.getAttribute('src') === source)) {
    img.src = sources[0];
  }
}
${end}`;

  js = replaceBetweenMarkers(js, start, end, block);
  if (!js.includes(start)) {
    const anchor = 'const elements = {};';
    js = js.includes(anchor) ? js.replace(anchor, `${anchor}\n\n${block}`) : `${block}\n\n${js}`;
  }

  if (!js.includes('lockHeaderBrandLogo();')) {
    const callAnchor = 'seedDefaultLogs();';
    js = js.includes(callAnchor)
      ? js.replace(callAnchor, `${callAnchor}\n  lockHeaderBrandLogo();`)
      : js.replace("document.addEventListener('DOMContentLoaded', async () => {", "document.addEventListener('DOMContentLoaded', async () => {\n  lockHeaderBrandLogo();");
  }

  write(rel, js);
  console.log('[OK] renderer.js uses compact header logo source');
}

function patchStyles() {
  const rel = 'styles.css';
  if (!exists(rel)) {
    console.log('[SKIP] styles.css not found');
    return;
  }
  backup(rel);
  let css = read(rel);
  const start = '/* ROUND11L_HEADER_LOGO_FIT_START */';
  const end = '/* ROUND11L_HEADER_LOGO_FIT_END */';
  const block = `${start}
/* Compact DCC titlebar logo fit. Overrides the earlier oversized 44px lock. */
.dcc-header-logo {
  width: 34px !important;
  height: 34px !important;
  min-width: 34px !important;
  max-width: 34px !important;
  flex: 0 0 34px !important;
  display: block !important;
  object-fit: contain !important;
  object-position: center !important;
  align-self: center !important;
  border-radius: 9px !important;
  margin: 0 12px 0 0 !important;
  padding: 0 !important;
  transform: none !important;
  box-sizing: border-box !important;
}
.titlebar .brand,
.titlebar .app-brand,
.titlebar [class*="brand"],
.window-titlebar .brand,
.window-titlebar .app-brand,
.window-titlebar [class*="brand"],
.topbar .brand,
.topbar .app-brand,
.topbar [class*="brand"],
.app-header .brand,
.app-header .app-brand,
.app-header [class*="brand"],
.header .brand,
.header .app-brand,
.header [class*="brand"],
header .brand,
header .app-brand,
header [class*="brand"] {
  display: flex !important;
  align-items: center !important;
  min-height: 52px;
}
.titlebar,
.window-titlebar,
.topbar,
.app-header,
.header,
header {
  overflow: hidden;
}
${end}`;

  css = replaceBetweenMarkers(css, start, end, block);
  if (!css.includes(start)) css = `${css.trim()}\n\n${block}\n`;
  write(rel, css);
  console.log('[OK] styles.css compact header logo fit');
}

function patchIndex() {
  const rel = 'index.html';
  if (!exists(rel)) {
    console.log('[SKIP] index.html not found');
    return;
  }
  backup(rel);
  let html = read(rel);
  const before = html;

  html = html.replace(/(<img\b[^>]*(?:brand|logo|mark|icon|dcc)[^>]*\bsrc=["'])[^"']+(["'][^>]*>)/i, '$1assets/dcc-logo-32.png$2');
  html = html.replace(/(<img\b(?=[^>]*(?:brand|logo|mark|icon|dcc)))(?![^>]*\bclass=)/i, '$1 class="dcc-header-logo"');
  html = html.replace(/(<img\b(?=[^>]*(?:brand|logo|mark|icon|dcc)))(?![^>]*\balt=)/i, '$1 alt="DCC"');

  if (html !== before) {
    write(rel, html);
    console.log('[OK] index.html logo src set to compact 32px asset');
  } else {
    console.log('[INFO] index.html unchanged; renderer/runtime CSS handles the fit');
  }
}

['dcc-logo-32.png', 'dcc-logo-64.png', 'dcc-logo.png'].forEach(copyAsset);
patchRenderer();
patchStyles();
patchIndex();

console.log('\nDCC Round 11L header logo fit applied.');
console.log('Next: npm run test:rc && npm run start');
