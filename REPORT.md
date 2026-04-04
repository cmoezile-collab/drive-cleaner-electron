# Drive Cleaner by Clark

## Executive Summary
Drive Cleaner by Clark is a Windows-focused Electron desktop utility for inspecting connected drives, unhiding hidden content, scanning drives with Microsoft Defender, and formatting volumes through a guarded confirmation flow. The project currently ships as a custom-framed desktop application with a dark/gold visual system, administrative elevation support, live activity logs, and packaged Windows installer and portable builds.

This report reflects the current source state in `E:\Code_HQ\Drive Cleaner by Clark` as of April 4, 2026, including the latest UI refinements completed in this session.

---

## Current Status

### Project State
- Application type: Electron desktop app
- Platform target: Windows
- Current version: `1.0.0`
- Main entry: `main.js`
- Renderer entry: `renderer.js`
- UI shell: `index.html`
- Theme stylesheet: `styles.css`
- IPC bridge: `preload.js`

### Latest Completed Refinements
- Added dark custom scrollbar styling so scroll areas match the rest of the interface.
- Fixed titlebar control rendering for minimize, maximize, restore, and close icons.
- Added maximize-state awareness so the toggle button changes to a restore icon when the window is maximized.
- Rebuilt Windows installer and portable artifacts after the UI updates.

---

## Product Overview

### Purpose
The application is designed to help users work with removable and fixed drives through a compact operational UI focused on:
- Unhiding hidden files and folders
- Running Microsoft Defender scans against a selected drive
- Formatting a selected drive with safety confirmations
- Viewing progress and live logs during each operation

### Primary User Flows
1. Launch the app with administrative privileges.
2. Select a connected drive from the sidebar.
3. Choose cleaning/scanning settings.
4. Run `UNHIDE ONLY`, `SCAN ONLY`, or `FULL CLEAN`.
5. Review progress, status, and live activity logs.
6. Optionally switch to the `FORMAT` tab and perform a guarded format action.

---

## Architecture

### Main Process
File: `main.js`

Responsibilities:
- Creates the Electron `BrowserWindow`
- Applies custom frameless window configuration
- Handles admin elevation workflow on launch
- Enumerates Windows drives with PowerShell/CIM
- Runs Windows drive operations and Defender commands
- Manages active task state and cancellation
- Sends progress, log, toast, and window-state events to the renderer

Key behaviors:
- Relaunches as administrator when required
- Uses `diskpart` for formatting
- Uses `MpCmdRun.exe` when available for Defender scans
- Falls back to PowerShell Defender commands when needed
- Tracks child processes so running tasks can be stopped

### Renderer Process
File: `renderer.js`

Responsibilities:
- Binds UI controls to application behavior
- Loads initial app state
- Populates the drive selector
- Handles clean/format actions
- Updates progress bars, stats, logs, badges, and toasts
- Manages the custom confirmation modal
- Responds to main-process window maximize state changes

### Preload Layer
File: `preload.js`

Responsibilities:
- Exposes a minimal secure IPC API through `contextBridge`
- Keeps `contextIsolation` enabled
- Prevents direct Node access from the renderer

Exposed API:
- `getInitialState()`
- `refreshDrives()`
- `startClean(payload)`
- `startFormat(payload)`
- `stopTask()`
- `windowAction(action)`
- `onEvent(callback)`

---

## UI and UX Summary

### Layout
The interface is split into three major regions:
- Custom titlebar with branding, state pills, and window controls
- Left sidebar for drive targeting and scan settings
- Main content area with `CLEAN` and `FORMAT` views

### Visual System
The design uses a dark industrial interface with gold accents:
- Background: near-black layered gradients
- Cards: dark panels with subtle borders and highlights
- Accent color: warm gold for key status and interactive emphasis
- Danger state: red gradients for destructive actions and warnings
- Typography: condensed display styling with mono metadata accents

### Recent UI Fixes
- Scrollbars are now themed dark instead of using bright native styling.
- Titlebar control icons are now larger and centered inside the custom frame buttons.
- The maximize toggle now visually switches between maximize and restore states.

---

## Feature Breakdown

### Drive Detection
Implemented in `main.js` using PowerShell and `Get-CimInstance Win32_LogicalDisk`.

Collected drive properties:
- `DeviceID`
- `DriveType`
- `VolumeName`
- `Size`

Mapped drive types:
- `2` = Removable
- `3` = Fixed
- `4` = Network
- `5` = Optical

### Clean Operations
Modes supported:
- `unhide`
- `scan`
- `full`

#### Unhide Flow
- Validates the selected drive path
- Recursively traverses the drive
- Removes the `Hidden` attribute from items
- Optionally removes the `System` attribute when enabled
- Emits incremental counts to the UI log and stats panel

#### Defender Scan Flow
Primary path:
- Uses `MpCmdRun.exe`
- Runs a custom drive scan
- Supports optional flags for:
  - remediation disable
  - boot sector scan
  - CPU throttling

Fallback path:
- Uses PowerShell `Start-MpScan`

UI outputs:
- Status badge updates
- Threat count updates
- Toasts for failures
- Live log lines from scan output

### Format Operations
Formatting is routed through `diskpart` using a generated temporary script.

Supported filesystems:
- `NTFS`
- `exFAT`
- `FAT32`

Supported format types:
- `Quick`
- `Full`

Safety behaviors:
- Two-step confirmation flow
- FAT32 size warning for drives larger than 32 GB
- Active progress state and format log output
- Stop control support for in-progress operations

---

## Security and Safety Notes

### Implemented Safeguards
- `contextIsolation: true`
- `nodeIntegration: false`
- Administrative elevation on launch
- Double confirmation before formatting
- Sanitization for drive and label inputs
- Process tracking and stop support for long-running operations

### Risk Areas
- Formatting remains inherently destructive even with confirmations.
- Recursive unhide operations on large drives may take significant time.
- Defender fallback mode does not expose every CLI option available in `MpCmdRun.exe`.

---

## Codebase Structure

```text
Drive Cleaner by Clark/
├── assets/
│   ├── dcc.ico
│   └── dcc-icon-preview.png
├── build/
│   ├── installerHeader.bmp
│   └── installerSidebar.bmp
├── dist/
│   ├── win-unpacked/
│   ├── DRIVE CLEANER Setup 1.0.0.exe
│   ├── DRIVE CLEANER Setup 1.0.0.exe.blockmap
│   ├── DRIVE CLEANER Portable 1.0.0.exe
│   └── DRIVE CLEANER 1.0.0.exe
├── scripts/
│   └── generate-icon.ps1
├── index.html
├── main.js
├── package.json
├── preload.js
├── renderer.js
├── styles.css
└── REPORT.md
```

---

## Build and Packaging

### Package Configuration
Defined in `package.json`.

Build stack:
- Electron `^32.0.0`
- electron-builder `^24.13.3`

Targets:
- NSIS installer
- Portable Windows executable

Windows packaging settings:
- App ID: `com.clark.drivecleaner`
- Product name: `DRIVE CLEANER`
- Requested execution level: `requireAdministrator`
- Output directory: `dist`

### Current Known Artifacts
Latest confirmed rebuild during this session:
- `dist\DRIVE CLEANER Setup 1.0.0.exe`
- `dist\DRIVE CLEANER Portable 1.0.0.exe`

Latest observed timestamps:
- Setup build: April 4, 2026 at approximately 1:13 AM
- Portable build: April 4, 2026 at approximately 1:13 AM

---

## Session Change Log

### Scrollbar Refinement
Files changed:
- `styles.css`

Change summary:
- Enabled dark color scheme behavior
- Added custom scrollbar styling for track, thumb, hover, and corner states

Outcome:
- Scrollable areas now visually match the app theme instead of using a bright white scrollbar

### Titlebar Control Refinement
Files changed:
- `index.html`
- `renderer.js`
- `main.js`
- `styles.css`

Change summary:
- Replaced undersized titlebar SVGs with larger icons
- Added centered sizing rules for custom frame buttons
- Wired maximize state to renderer updates
- Added restore glyph behavior when maximized

Outcome:
- Minimize, maximize, restore, and close controls now render correctly and behave more like native desktop controls

---

## Gaps Between Current App and Legacy Report
The previous `REPORT.md` described the project as a broader disk analyzer with features such as:
- storage treemaps
- folder size visualization
- browser cache cleanup
- Windows Update cache cleanup
- recycle bin cleaning
- S.M.A.R.T. status inspection

Those capabilities are not reflected in the current source implementation reviewed in this session. The current codebase is more focused and primarily delivers:
- drive selection
- unhide operations
- Defender scan execution
- destructive format workflows
- live logging and task control

This updated report is intended to reflect the actual present implementation rather than the broader original concept.

---

## Recommended Next Improvements
- Add a dedicated drive summary card showing selected drive label, type, and size more prominently.
- Add explicit task completion summaries in the log for clean runs.
- Add a non-destructive preflight validation panel before formatting.
- Add visual disabled states for settings that do not apply to the current action mode.
- Add smoke-test documentation for core flows:
  - drive refresh
  - unhide only
  - Defender scan only
  - full clean
  - quick format
  - maximize and restore titlebar behavior

---

## Conclusion
Drive Cleaner by Clark is currently a functional Windows utility with a solid custom UI shell, secure Electron setup, live task reporting, and working operational flows for drive cleanup and formatting. The latest refinements improved polish in two visible areas: scroll behavior and titlebar controls. The project is in a good state for continued UI refinement, testing, and feature expansion.
