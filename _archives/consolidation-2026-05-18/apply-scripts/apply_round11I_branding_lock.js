const fs = require('fs');
const path = require('path');
const root = process.cwd();
const srcRoot = __dirname;
function copy(rel){
  const src = path.join(srcRoot, rel);
  const dest = path.join(root, rel);
  if (!fs.existsSync(src)) throw new Error(`Missing patch file: ${rel}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src,dest);
  console.log(`[OK] ${rel}`);
}
[
  'package.json',
  'build_all.bat',
  'scripts/generate-icon.ps1',
  'scripts/dcc-branding-check.js',
  'assets/dcc.ico','assets/icon.png','assets/dcc-logo.png','assets/dcc-logo-256.png','assets/dcc-logo-128.png','assets/dcc-logo-64.png','assets/dcc-logo-32.png','assets/dcc-logo-16.png','assets/dcc-mark.svg',
  'assets/installerHeader.bmp','assets/installerSidebar.bmp','assets/installerHeader_preview.png','assets/installerSidebar_preview.png',
  'build/installerHeader.bmp','build/installerSidebar.bmp'
].forEach(copy);
console.log('\nDCC branding lock applied. The old generate-icon routine is now disabled.');
