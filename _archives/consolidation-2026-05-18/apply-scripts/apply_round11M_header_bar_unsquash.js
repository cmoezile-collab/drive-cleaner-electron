const fs = require('fs');
const path = require('path');

const root = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(root, '.patch_backups', `round11M-header-unsquash-${stamp}`);

function log(message) {
  console.log(`[Round11M] ${message}`);
}

function file(rel) {
  return path.join(root, rel);
}

function exists(rel) {
  return fs.existsSync(file(rel));
}

function backup(rel) {
  if (!exists(rel)) return;
  const src = file(rel);
  const dest = path.join(backupDir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  log(`backup ${rel}`);
}

function read(rel) {
  return fs.readFileSync(file(rel), 'utf8');
}

function write(rel, text) {
  fs.writeFileSync(file(rel), text, 'utf8');
  log(`patched ${rel}`);
}

function pickLogoSrc() {
  const candidates = [
    'assets/dcc-logo-32.png',
    'assets/dcc-logo-64.png',
    'assets/dcc-logo.png',
    'assets/icon.png'
  ];
  return candidates.find(exists) || 'assets/dcc-logo-32.png';
}

function addClassToTag(tag, className) {
  if (/\bclass\s*=\s*["'][^"']*["']/i.test(tag)) {
    return tag.replace(/\bclass\s*=\s*(["'])([^"']*)\1/i, (m, quote, classes) => {
      const parts = classes.split(/\s+/).filter(Boolean);
      if (!parts.includes(className)) parts.push(className);
      return `class=${quote}${parts.join(' ')}${quote}`;
    });
  }
  return tag.replace(/<img\b/i, `<img class="${className}"`);
}

function patchIndex() {
  if (!exists('index.html')) {
    log('index.html not found, skipped HTML logo normalization');
    return;
  }

  backup('index.html');
  let html = read('index.html');
  const logoSrc = pickLogoSrc();

  // Patch the first likely app/brand/logo image only. This keeps installer preview images untouched.
  const imgRegex = /<img\b[^>]*(?:dcc-logo|dcc-mark|icon\.png|logo|brand)[^>]*>/i;
  let patched = false;
  html = html.replace(imgRegex, (tag) => {
    patched = true;
    let next = tag;
    if (/\bsrc\s*=\s*["'][^"']*["']/i.test(next)) {
      next = next.replace(/\bsrc\s*=\s*(["'])[^"']*\1/i, `src="${logoSrc}"`);
    } else {
      next = next.replace(/<img\b/i, `<img src="${logoSrc}"`);
    }
    next = addClassToTag(next, 'dcc-titlebar-logo');
    next = next.replace(/\s(width|height)\s*=\s*["'][^"']*["']/gi, '');
    return next;
  });

  if (!patched) {
    log('No obvious logo <img> found in index.html. CSS patch will still apply if the existing classes match.');
  }

  // Undo the visible run-together string if a previous patch accidentally merged static text.
  html = html
    .replace(/BY\s+CLARKUNHIDE/gi, 'BY CLARK · UNHIDE')
    .replace(/BY\s+CLARK\s*UNHIDE/gi, 'BY CLARK · UNHIDE');

  write('index.html', html);
}

function patchStyles() {
  if (!exists('styles.css')) {
    log('styles.css not found, skipped CSS patch');
    return;
  }

  backup('styles.css');
  let css = read('styles.css');

  const start = '/* === ROUND11M HEADER BAR UNSQUASH START === */';
  const end = '/* === ROUND11M HEADER BAR UNSQUASH END === */';
  const block = `${start}
:root {
  --dcc-titlebar-height: 60px;
  --dcc-titlebar-logo-size: 34px;
  --dcc-titlebar-logo-radius: 9px;
}

/* Keep the custom window/header rail tall enough for the mark and two-line branding. */
.titlebar,
.app-titlebar,
.window-titlebar,
.topbar,
.app-header,
.chrome-titlebar,
.header-bar {
  height: var(--dcc-titlebar-height) !important;
  min-height: var(--dcc-titlebar-height) !important;
  display: flex !important;
  align-items: center !important;
  overflow: hidden !important;
}

/* The logo should behave like a small titlebar mark, not a card-sized installer icon. */
.dcc-titlebar-logo,
.titlebar img[src*="dcc-logo"],
.app-titlebar img[src*="dcc-logo"],
.window-titlebar img[src*="dcc-logo"],
.topbar img[src*="dcc-logo"],
.app-header img[src*="dcc-logo"],
.chrome-titlebar img[src*="dcc-logo"],
.header-bar img[src*="dcc-logo"],
.titlebar img[src*="icon.png"],
.app-titlebar img[src*="icon.png"],
.window-titlebar img[src*="icon.png"],
.topbar img[src*="icon.png"],
.app-header img[src*="icon.png"],
.chrome-titlebar img[src*="icon.png"],
.header-bar img[src*="icon.png"] {
  width: var(--dcc-titlebar-logo-size) !important;
  height: var(--dcc-titlebar-logo-size) !important;
  min-width: var(--dcc-titlebar-logo-size) !important;
  max-width: var(--dcc-titlebar-logo-size) !important;
  min-height: var(--dcc-titlebar-logo-size) !important;
  max-height: var(--dcc-titlebar-logo-size) !important;
  object-fit: contain !important;
  object-position: center !important;
  display: block !important;
  flex: 0 0 var(--dcc-titlebar-logo-size) !important;
  border-radius: var(--dcc-titlebar-logo-radius) !important;
  margin: 0 !important;
  padding: 0 !important;
}

/* Rebuild the brand lockup as: logo | DRIVE CLEANER | BY CLARK / UNHIDE · SCAN · FORMAT · PROTECT. */
.titlebar .brand,
.app-titlebar .brand,
.window-titlebar .brand,
.topbar .brand,
.app-header .brand,
.chrome-titlebar .brand,
.header-bar .brand,
.titlebar .app-brand,
.app-titlebar .app-brand,
.window-titlebar .app-brand,
.topbar .app-brand,
.app-header .app-brand,
.chrome-titlebar .app-brand,
.header-bar .app-brand,
.titlebar .brand-lockup,
.app-titlebar .brand-lockup,
.window-titlebar .brand-lockup,
.topbar .brand-lockup,
.app-header .brand-lockup,
.chrome-titlebar .brand-lockup,
.header-bar .brand-lockup {
  height: var(--dcc-titlebar-height) !important;
  min-height: var(--dcc-titlebar-height) !important;
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 12px !important;
  flex: 0 0 auto !important;
  min-width: 0 !important;
  max-width: none !important;
  overflow: visible !important;
  white-space: normal !important;
  line-height: 1 !important;
}

.titlebar .brand > :not(img):not(svg),
.app-titlebar .brand > :not(img):not(svg),
.window-titlebar .brand > :not(img):not(svg),
.topbar .brand > :not(img):not(svg),
.app-header .brand > :not(img):not(svg),
.chrome-titlebar .brand > :not(img):not(svg),
.header-bar .brand > :not(img):not(svg),
.titlebar .app-brand > :not(img):not(svg),
.app-titlebar .app-brand > :not(img):not(svg),
.window-titlebar .app-brand > :not(img):not(svg),
.topbar .app-brand > :not(img):not(svg),
.app-header .app-brand > :not(img):not(svg),
.chrome-titlebar .app-brand > :not(img):not(svg),
.header-bar .app-brand > :not(img):not(svg),
.titlebar .brand-lockup > :not(img):not(svg),
.app-titlebar .brand-lockup > :not(img):not(svg),
.window-titlebar .brand-lockup > :not(img):not(svg),
.topbar .brand-lockup > :not(img):not(svg),
.app-header .brand-lockup > :not(img):not(svg),
.chrome-titlebar .brand-lockup > :not(img):not(svg),
.header-bar .brand-lockup > :not(img):not(svg) {
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-start !important;
  justify-content: center !important;
  gap: 5px !important;
  min-width: 0 !important;
  height: auto !important;
  overflow: visible !important;
}

.titlebar .brand-title,
.app-titlebar .brand-title,
.window-titlebar .brand-title,
.topbar .brand-title,
.app-header .brand-title,
.chrome-titlebar .brand-title,
.header-bar .brand-title,
.titlebar .app-title,
.app-titlebar .app-title,
.window-titlebar .app-title,
.topbar .app-title,
.app-header .app-title,
.chrome-titlebar .app-title,
.header-bar .app-title,
.titlebar .product-title,
.app-titlebar .product-title,
.window-titlebar .product-title,
.topbar .product-title,
.app-header .product-title,
.chrome-titlebar .product-title,
.header-bar .product-title {
  display: inline-flex !important;
  align-items: baseline !important;
  white-space: nowrap !important;
  line-height: 1 !important;
  margin: 0 !important;
}

.titlebar .brand-byline,
.app-titlebar .brand-byline,
.window-titlebar .brand-byline,
.topbar .brand-byline,
.app-header .brand-byline,
.chrome-titlebar .brand-byline,
.header-bar .brand-byline,
.titlebar .byline,
.app-titlebar .byline,
.window-titlebar .byline,
.topbar .byline,
.app-header .byline,
.chrome-titlebar .byline,
.header-bar .byline,
.titlebar [class*="byline"],
.app-titlebar [class*="byline"],
.window-titlebar [class*="byline"],
.topbar [class*="byline"],
.app-header [class*="byline"],
.chrome-titlebar [class*="byline"],
.header-bar [class*="byline"] {
  display: inline-flex !important;
  align-items: center !important;
  margin-left: 10px !important;
  padding-left: 10px !important;
  border-left: 1px solid rgba(212, 176, 100, 0.32) !important;
  white-space: nowrap !important;
  line-height: 1 !important;
}

.titlebar .brand-subtitle,
.app-titlebar .brand-subtitle,
.window-titlebar .brand-subtitle,
.topbar .brand-subtitle,
.app-header .brand-subtitle,
.chrome-titlebar .brand-subtitle,
.header-bar .brand-subtitle,
.titlebar .brand-meta,
.app-titlebar .brand-meta,
.window-titlebar .brand-meta,
.topbar .brand-meta,
.app-header .brand-meta,
.chrome-titlebar .brand-meta,
.header-bar .brand-meta,
.titlebar .tagline,
.app-titlebar .tagline,
.window-titlebar .tagline,
.topbar .tagline,
.app-header .tagline,
.chrome-titlebar .tagline,
.header-bar .tagline,
.titlebar [class*="subtitle"],
.app-titlebar [class*="subtitle"],
.window-titlebar [class*="subtitle"],
.topbar [class*="subtitle"],
.app-header [class*="subtitle"],
.chrome-titlebar [class*="subtitle"],
.header-bar [class*="subtitle"] {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  white-space: nowrap !important;
  line-height: 1 !important;
  margin: 0 !important;
  overflow: visible !important;
}

/* Keep the status/window controls on the far right instead of squeezing the brand text. */
.titlebar .window-controls,
.app-titlebar .window-controls,
.window-titlebar .window-controls,
.topbar .window-controls,
.app-header .window-controls,
.chrome-titlebar .window-controls,
.header-bar .window-controls,
.titlebar .titlebar-actions,
.app-titlebar .titlebar-actions,
.window-titlebar .titlebar-actions,
.topbar .titlebar-actions,
.app-header .titlebar-actions,
.chrome-titlebar .titlebar-actions,
.header-bar .titlebar-actions,
.titlebar .chrome-actions,
.app-titlebar .chrome-actions,
.window-titlebar .chrome-actions,
.topbar .chrome-actions,
.app-header .chrome-actions,
.chrome-titlebar .chrome-actions,
.header-bar .chrome-actions {
  margin-left: auto !important;
  flex: 0 0 auto !important;
}
${end}`;

  const pattern = new RegExp(`${start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  if (pattern.test(css)) {
    css = css.replace(pattern, block);
  } else {
    css = `${css.trim()}\n\n${block}\n`;
  }

  write('styles.css', css);
}

function main() {
  log('Applying header bar fit + text unsquash patch...');
  patchIndex();
  patchStyles();
  log('Done. Run: npm run test:rc && npm run start');
}

main();
