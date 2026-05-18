const fs = require('fs');
const path = require('path');

const root = process.cwd();
const patchRoot = __dirname;
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(root, '.patch_backups', `round11N-header-clean-reset-${stamp}`);

function log(message) { console.log(`[Round11N] ${message}`); }
function file(rel) { return path.join(root, rel); }
function patchFile(rel) { return path.join(patchRoot, rel); }
function exists(rel) { return fs.existsSync(file(rel)); }
function read(rel) { return fs.readFileSync(file(rel), 'utf8'); }
function write(rel, text) { fs.writeFileSync(file(rel), text, 'utf8'); log(`patched ${rel}`); }
function backup(rel) {
  if (!exists(rel)) return;
  const dest = path.join(backupDir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(file(rel), dest);
  log(`backup ${rel}`);
}
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function removeBlock(text, start, end) {
  const pattern = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}\\s*`, 'g');
  return text.replace(pattern, '');
}
function copyAsset(name) {
  const src = patchFile(path.join('assets', name));
  const dest = file(path.join('assets', name));
  if (!fs.existsSync(src)) throw new Error(`Patch asset missing: assets/${name}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  log(`copied assets/${name}`);
}

function cleanupRenderer() {
  if (!exists('renderer.js')) {
    log('renderer.js not found, skipped renderer cleanup');
    return;
  }
  backup('renderer.js');
  let js = read('renderer.js');
  const before = js;

  // Remove the runtime logo injector from Round 11K/11L. It was too aggressive and could insert the logo into the wrong node.
  js = removeBlock(js, '// ROUND11K_HEADER_LOGO_LOCK_START', '// ROUND11K_HEADER_LOGO_LOCK_END');
  js = js.replace(/^\s*lockHeaderBrandLogo\(\);\s*$/gm, '');

  if (js !== before) write('renderer.js', js);
  else log('renderer.js already clean');
}

function cleanupStyles() {
  if (!exists('styles.css')) {
    log('styles.css not found, skipped CSS cleanup');
    return;
  }
  backup('styles.css');
  let css = read('styles.css');

  // Remove the previous experimental header blocks. They were causing the title text to clip/squash.
  css = removeBlock(css, '/* ROUND11K_HEADER_LOGO_LOCK_START */', '/* ROUND11K_HEADER_LOGO_LOCK_END */');
  css = removeBlock(css, '/* ROUND11L_HEADER_LOGO_FIT_START */', '/* ROUND11L_HEADER_LOGO_FIT_END */');
  css = removeBlock(css, '/* === ROUND11M HEADER BAR UNSQUASH START === */', '/* === ROUND11M HEADER BAR UNSQUASH END === */');
  css = removeBlock(css, '/* === ROUND11N HEADER CLEAN RESET START === */', '/* === ROUND11N HEADER CLEAN RESET END === */');

  const block = `/* === ROUND11N HEADER CLEAN RESET START === */
/* Minimal logo-only fix. Do not rewrite the header layout; let the original titlebar CSS breathe. */
.dcc-titlebar-logo,
.dcc-header-logo,
.titlebar img[src*="dcc-logo"],
.app-titlebar img[src*="dcc-logo"],
.window-titlebar img[src*="dcc-logo"],
.topbar img[src*="dcc-logo"],
.app-header img[src*="dcc-logo"],
.header img[src*="dcc-logo"],
.header-bar img[src*="dcc-logo"],
.chrome-titlebar img[src*="dcc-logo"],
.titlebar img[src$="icon.png"],
.app-titlebar img[src$="icon.png"],
.window-titlebar img[src$="icon.png"],
.topbar img[src$="icon.png"],
.app-header img[src$="icon.png"],
.header img[src$="icon.png"],
.header-bar img[src$="icon.png"],
.chrome-titlebar img[src$="icon.png"] {
  width: 36px !important;
  height: 36px !important;
  min-width: 36px !important;
  max-width: 36px !important;
  min-height: 36px !important;
  max-height: 36px !important;
  flex: 0 0 36px !important;
  object-fit: contain !important;
  object-position: center !important;
  display: block !important;
  align-self: center !important;
  margin: 0 14px 0 0 !important;
  padding: 0 !important;
  border-radius: 9px !important;
  box-sizing: border-box !important;
  transform: none !important;
}

/* Guardrail: previous patches accidentally made the brand copy stack/clip. These only normalize text flow, not the whole app header. */
.titlebar .brand-title,
.app-titlebar .brand-title,
.window-titlebar .brand-title,
.topbar .brand-title,
.app-header .brand-title,
.header .brand-title,
.header-bar .brand-title,
.chrome-titlebar .brand-title,
.titlebar .product-title,
.app-titlebar .product-title,
.window-titlebar .product-title,
.topbar .product-title,
.app-header .product-title,
.header .product-title,
.header-bar .product-title,
.chrome-titlebar .product-title {
  white-space: nowrap !important;
}

.titlebar .brand-byline,
.app-titlebar .brand-byline,
.window-titlebar .brand-byline,
.topbar .brand-byline,
.app-header .brand-byline,
.header .brand-byline,
.header-bar .brand-byline,
.chrome-titlebar .brand-byline,
.titlebar .byline,
.app-titlebar .byline,
.window-titlebar .byline,
.topbar .byline,
.app-header .byline,
.header .byline,
.header-bar .byline,
.chrome-titlebar .byline {
  white-space: nowrap !important;
}
/* === ROUND11N HEADER CLEAN RESET END === */`;

  css = `${css.trim()}\n\n${block}\n`;
  write('styles.css', css);
}

function patchIndexLogoOnly() {
  if (!exists('index.html')) {
    log('index.html not found, skipped HTML logo patch');
    return;
  }
  backup('index.html');
  let html = read('index.html');
  const before = html;

  // Repair accidental text run-together from previous broad patches, only if it exists in static HTML.
  html = html
    .replace(/BY\s+CLARKUNHIDE/gi, 'BY CLARK')
    .replace(/BY\s+CLARK\s*[·•]\s*UNHIDE/gi, 'BY CLARK');

  // Patch only the first likely header logo image, not installer preview assets.
  let patched = false;
  html = html.replace(/<img\b[^>]*(?:dcc-logo|dcc-mark|icon\.png|logo|brand)[^>]*>/i, (tag) => {
    patched = true;
    let next = tag;
    if (/\bsrc\s*=\s*["'][^"']*["']/i.test(next)) {
      next = next.replace(/\bsrc\s*=\s*(["'])[^"']*\1/i, 'src="assets/dcc-logo-32.png"');
    } else {
      next = next.replace(/<img\b/i, '<img src="assets/dcc-logo-32.png"');
    }
    next = next.replace(/\s(width|height)\s*=\s*["'][^"']*["']/gi, '');
    if (/\bclass\s*=\s*(["'])([^"']*)\1/i.test(next)) {
      next = next.replace(/\bclass\s*=\s*(["'])([^"']*)\1/i, (m, quote, classes) => {
        const parts = classes.split(/\s+/).filter(Boolean);
        if (!parts.includes('dcc-titlebar-logo')) parts.push('dcc-titlebar-logo');
        return `class=${quote}${parts.join(' ')}${quote}`;
      });
    } else {
      next = next.replace(/<img\b/i, '<img class="dcc-titlebar-logo"');
    }
    if (!/\balt\s*=\s*["'][^"']*["']/i.test(next)) {
      next = next.replace(/<img\b/i, '<img alt="DCC"');
    }
    return next;
  });

  if (html !== before) {
    write('index.html', html);
    log(patched ? 'header logo src/class normalized' : 'HTML text normalized');
  } else {
    log('index.html unchanged');
  }
}

function main() {
  log('Applying clean header reset...');
  ['dcc-logo-32.png', 'dcc-logo-64.png', 'dcc-logo-128.png'].forEach(copyAsset);
  cleanupRenderer();
  cleanupStyles();
  patchIndexLogoOnly();
  log('Done. Run: npm run test:rc && npm run start');
}

main();
