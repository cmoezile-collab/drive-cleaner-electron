# Drive Cleaner by Clark

## Overview
A disk space analyzer and cleanup utility built with Electron. Features a modern dark/gold theme, drive scanning, file category visualization, and safe cleanup operations.

---

## 📦 Build Information

| Property | Value |
|----------|-------|
| **Version** | 1.0.0 |
| **Framework** | Electron 32.3.3 |
| **Build Tool** | electron-builder 24.13.3 |
| **Author** | Clark Studios |
| **License** | MIT |

---

## 🚀 Features

### Drive Analysis
- Scan all available drives (Fixed, Removable, Network, Optical)
- Visual storage breakdown by file category
- Interactive treemap visualization
- Folder size analysis
- Quick access to large files

### File Categories
- Documents (PDF, DOC, XLS, TXT)
- Images (JPG, PNG, GIF, WEBP)
- Videos (MP4, MKV, AVI, MOV)
- Audio (MP3, FLAC, WAV, M4A)
- Archives (ZIP, RAR, 7Z)
- Applications (EXE, MSI, DLL)
- System files
- Temporary files

### Cleanup Operations
- Temporary file cleanup
- Windows Update cache
- Recycle Bin emptying
- Browser cache cleaning
- Log file removal
- Thumbnail cache cleanup
- Safe cleanup recommendations

### Drive Operations
- Format drives (with confirmation)
- Eject removable drives
- Open in File Explorer
- Drive properties view
- S.M.A.R.T. status (where available)

---

## 📁 Project Structure

```
drive-cleaner-electron/
├── main.js                 # Electron main process
├── preload.js              # IPC bridge (context isolation)
├── renderer.js             # Renderer logic
├── styles.css              # Dark/gold theme styles
├── index.html              # Main UI
├── assets/
│   └── dcc.ico             # Application icon
├── scripts/
│   └── generate-icon.ps1   # Icon generation
├── package.json            # Dependencies & build config
└── dist/                   # Built executables
    ├── DRIVE CLEANER Setup 1.0.0.exe    # Installer (70 MB)
    └── DRIVE CLEANER Portable 1.0.0.exe # Portable (70 MB)
```

---

## 📋 Requirements

### Runtime
- Windows 10/11
- .NET Framework 4.5+ (for some drive operations)

### Development
```powershell
npm install                  # Install dependencies
```

---

## 🖥️ Usage

### Running from Source
```powershell
cd E:\Code_HQ\drive-cleaner-electron
npm install
npm start
```

### Using Built Executables
- **Installer:** `dist\DRIVE CLEANER Setup 1.0.0.exe`
- **Portable:** `dist\DRIVE CLEANER Portable 1.0.0.exe` (no installation required)

---

## 🔧 Development

### Build Commands
```powershell
npm install                  # Install dependencies
npm run build                # Build all targets
npm run build:win            # Build Windows executables
```

---

## 🎨 Design System

### Color Palette
| Token | Value | Usage |
|-------|-------|-------|
| `--bg-dark` | `#09090b` | Main background |
| `--bg-panel` | `#0f0f12` | Panels, titlebar |
| `--bg-card` | `#18181c` | Cards, buttons |
| `--bg-card-hover` | `#1e1e24` | Hover states |
| `--bg-input` | `#141418` | Input fields |
| `--gold` | `#d4b064` | Primary accent |
| `--gold-light` | `#e0c07a` | Accent hover |
| `--text-primary` | `#ececec` | Primary text |
| `--text-secondary` | `#a1a1aa` | Secondary text |
| `--text-dim` | `#71717a` | Muted text |
| `--green` | `#22c55e` | Success |
| `--red` | `#ef4444` | Danger |
| `--orange` | `#f97316` | Warning |

### Typography
- **Display:** Bebas Neue
- **Body:** Inter
- **Mono:** DM Mono

---

## 🔒 Security Features

- Context Isolation enabled
- Node Integration disabled
- IPC validation on all calls
- Admin elevation for drive operations
- Multiple confirmations for destructive actions
- Path validation and sanitization

---

## 📊 Drive Types Supported

| Type ID | Name | Example |
|---------|------|---------|
| 2 | Removable | USB drives, SD cards |
| 3 | Fixed | Internal hard drives |
| 4 | Network | Mapped network drives |
| 5 | Optical | CD/DVD/Blu-ray drives |

---

## ⚠️ Warnings

### Safe Operations
- ✅ Temporary file cleanup
- ✅ Recycle Bin emptying
- ✅ Browser cache cleaning
- ✅ Log file removal
- ✅ Thumbnail cache

### Use Caution
- ⚠️ Drive formatting (destroys all data)
- ⚠️ System file cleanup
- ⚠️ Windows Update cache (may prevent updates)

---

## 📝 Change History

### Version 1.0.0
- Initial Electron release
- Dark/gold theme UI
- Drive scanning and analysis
- File category visualization
- Cleanup operations
- Format/eject support
- Custom titlebar with window controls

---

## 📞 Support

**Author:** Clark Studios  
**Location:** Jacksonville, FL  
**Built:** 2026

---

## 📄 License

MIT License - See LICENSE file for details.
