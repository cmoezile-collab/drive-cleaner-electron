const fs = require('fs');
const path = require('path');

const root = process.cwd();
const patchRoot = __dirname;

function file(rel) {
  return path.join(root, rel);
}

function patchFile(rel) {
  return path.join(patchRoot, rel);
}

function readText(rel) {
  return fs.readFileSync(file(rel), 'utf8');
}

function writeText(rel, text) {
  fs.writeFileSync(file(rel), text, 'utf8');
}

function backup(rel) {
  const target = file(rel);
  if (!fs.existsSync(target)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(target, `${target}.round11K-${stamp}.bak`);
}

function copyAsset(name) {
  const src = patchFile(path.join('assets', name));
  const dest = file(path.join('assets', name));
  if (!fs.existsSync(src)) throw new Error(`Patch asset missing: assets/${name}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`[OK] assets/${name}`);
}

function replaceBetweenMarkers(text, start, end, block) {
  const pattern = new RegExp(`${start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
  if (pattern.test(text)) return text.replace(pattern, block);
  return text;
}

function patchRenderer() {
  const rel = 'renderer.js';
  if (!fs.existsSync(file(rel))) throw new Error('renderer.js not found. Run this from the DCC project root.');

  backup(rel);
  let js = readText(rel);

  const start = '// ROUND11K_HEADER_LOGO_LOCK_START';
  const end = '// ROUND11K_HEADER_LOGO_LOCK_END';
  const block = `${start}
function lockHeaderBrandLogo() {
  const sources = ['assets/dcc-logo-64.png', 'assets/dcc-logo.png', 'assets/icon.png'];
  const selectors = [
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
    const host = document.querySelector('.titlebar, .window-titlebar, .topbar, .app-header, .header, .brand, .app-brand, header');
    if (!host) return;
    img = document.createElement('img');
    img.className = 'dcc-header-logo';
    img.alt = 'DCC';
    host.prepend(img);
  }

  img.classList.add('dcc-header-logo');
  img.alt = 'DCC';
  img.decoding = 'async';
  img.draggable = false;

  let index = 0;
  img.addEventListener('error', () => {
    index += 1;
    if (index < sources.length) {
      img.src = sources[index];
    }
  });

  img.src = sources[0];
}
${end}`;

  js = replaceBetweenMarkers(js, start, end, block);
  if (!js.includes(start)) {
    const anchor = 'const elements = {};';
    if (js.includes(anchor)) {
      js = js.replace(anchor, `${anchor}\n\n${block}`);
    } else {
      js = `${block}\n\n${js}`;
    }
  }

  if (!js.includes('lockHeaderBrandLogo();')) {
    const callAnchor = 'seedDefaultLogs();';
    if (js.includes(callAnchor)) {
      js = js.replace(callAnchor, `${callAnchor}\n  lockHeaderBrandLogo();`);
    } else {
      js = js.replace("document.addEventListener('DOMContentLoaded', async () => {", "document.addEventListener('DOMContentLoaded', async () => {\n  lockHeaderBrandLogo();");
    }
  }

  writeText(rel, js);
  console.log('[OK] renderer.js header logo runtime lock');
}

function patchStyles() {
  const rel = 'styles.css';
  if (!fs.existsSync(file(rel))) {
    console.log('[SKIP] styles.css not found');
    return;
  }

  backup(rel);
  let css = readText(rel);
  const start = '/* ROUND11K_HEADER_LOGO_LOCK_START */';
  const end = '/* ROUND11K_HEADER_LOGO_LOCK_END */';
  const block = `${start}
.dcc-header-logo {
  width: 44px;
  height: 44px;
  min-width: 44px;
  max-width: 44px;
  display: block;
  object-fit: contain;
  object-position: center;
  flex: 0 0 44px;
  border-radius: 12px;
}
.titlebar .dcc-header-logo,
.window-titlebar .dcc-header-logo,
.topbar .dcc-header-logo,
.app-header .dcc-header-logo,
.header .dcc-header-logo,
.brand .dcc-header-logo,
.app-brand .dcc-header-logo {
  margin-right: 10px;
}
${end}`;

  css = replaceBetweenMarkers(css, start, end, block);
  if (!css.includes(start)) css = `${css.trim()}\n\n${block}\n`;
  writeText(rel, css);
  console.log('[OK] styles.css header logo sizing');
}

function patchIndexBestEffort() {
  const rel = 'index.html';
  if (!fs.existsSync(file(rel))) {
    console.log('[SKIP] index.html not found');
    return;
  }

  backup(rel);
  let html = readText(rel);
  const before = html;

  html = html.replace(/(<img\b[^>]*(?:brand|logo|mark|icon|dcc)[^>]*\bsrc=["'])[^"']+(["'][^>]*>)/i, '$1assets/dcc-logo-64.png$2');
  html = html.replace(/(<img\b(?=[^>]*(?:brand|logo|mark|icon|dcc)))(?![^>]*\balt=)/i, '$1 alt="DCC"');

  if (html !== before) {
    writeText(rel, html);
    console.log('[OK] index.html logo src normalized');
  } else {
    console.log('[INFO] index.html unchanged; renderer runtime lock will handle the header logo');
  }
}

function patchBrandingCheck() {
  const rel = path.join('scripts', 'dcc-branding-check.js');
  if (!fs.existsSync(file(rel))) {
    console.log('[SKIP] scripts/dcc-branding-check.js not found');
    return;
  }

  backup(rel);
  let js = readText(rel);
  for (const asset of ['assets/dcc-logo-64.png', 'assets/dcc-logo-128.png', 'assets/dcc-logo-256.png']) {
    if (!js.includes(asset)) {
      js = js.replace("'assets/dcc-logo.png'", "'assets/dcc-logo.png','" + asset + "'");
    }
  }
  writeText(rel, js);
  console.log('[OK] branding check includes header logo assets');
}

['dcc-logo.png', 'dcc-logo-256.png', 'dcc-logo-128.png', 'dcc-logo-64.png', 'dcc-logo-32.png', 'icon.png'].forEach(copyAsset);
patchRenderer();
patchStyles();
patchIndexBestEffort();
patchBrandingCheck();

console.log('\nDCC Round 11K header logo lock applied.');
console.log('Next: npm run branding:lock && npm run test:rc && npm run start');
