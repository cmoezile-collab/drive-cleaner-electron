const fs = require('fs');
const path = require('path');
const root = process.cwd();
const src = path.join(__dirname, 'scripts', 'dcc-doctor.js');
const dest = path.join(root, 'scripts', 'dcc-doctor.js');
if (!fs.existsSync(src)) { console.error('Missing bundled scripts/dcc-doctor.js'); process.exit(1); }
if (!fs.existsSync(path.join(root, 'package.json'))) { console.error('Run this from the DCC project root. package.json not found.'); process.exit(1); }
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log('Patched scripts/dcc-doctor.js with Windows-safe npm detection.');
