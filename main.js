const { app, BrowserWindow, dialog, ipcMain, shell, clipboard, nativeTheme } = require('electron');
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const packageJson = require('./package.json');

const APP_TITLE = 'DRIVE CLEANER | by Clark';
const WINDOW_BACKGROUND = '#09090B';
const ACCENT_COLOR = '#d4b064';
const DRIVE_TYPES = {
  2: 'Removable',
  3: 'Fixed',
  4: 'Network',
  5: 'Optical'
};

const OUTPUT_CAP_CHARS = 1024 * 1024;
const VALID_CLEAN_MODES = new Set(['unhide', 'scan', 'full']);
const VALID_FILESYSTEMS = new Set(['NTFS', 'exFAT', 'FAT32']);
const VALID_FORMAT_TYPES = new Set(['Quick', 'Full']);
const FORMAT_BLOCKED_DRIVE_TYPES = new Set(['Network', 'Optical', 'Unknown']);
const FORMAT_ALLOWED_DRIVE_TYPES = new Set(['Removable']);
const VALID_APPEARANCE_MODES = new Set(['dark', 'light', 'system']);

function normalizeAccentColor(value) {
  const text = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text.toLowerCase() : ACCENT_COLOR;
}

function normalizeAppearancePayload(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const mode = VALID_APPEARANCE_MODES.has(String(source.mode || '').toLowerCase()) ? String(source.mode).toLowerCase() : 'dark';
  return { mode, accentColor: normalizeAccentColor(source.accentColor) };
}

function applyWindowAppearance(mode = 'dark', accentColor = ACCENT_COLOR) {
  const normalizedMode = VALID_APPEARANCE_MODES.has(String(mode || '').toLowerCase()) ? String(mode).toLowerCase() : 'dark';
  const normalizedAccent = normalizeAccentColor(accentColor);
  try { nativeTheme.themeSource = normalizedMode; } catch (_error) {}
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      if (typeof mainWindow.setAccentColor === 'function') mainWindow.setAccentColor(normalizedAccent);
      if (typeof mainWindow.setBackgroundMaterial === 'function') mainWindow.setBackgroundMaterial(nativeTheme.shouldUseDarkColors ? 'mica' : 'mica');
      if (typeof mainWindow.setBackgroundColor === 'function') mainWindow.setBackgroundColor(nativeTheme.shouldUseDarkColors ? WINDOW_BACKGROUND : '#eaf0f7');
    } catch (_error) {}
  }
  return { ok: true, mode: normalizedMode, effective: nativeTheme.shouldUseDarkColors ? 'dark' : 'light', accentColor: normalizedAccent };
}

function normalizeDriveId(driveId) {
  const value = String(driveId || '').trim().toUpperCase();
  return /^[A-Z]:$/.test(value) ? value : null;
}

function isSystemDriveId(driveId) {
  const normalized = normalizeDriveId(driveId);
  const systemDrive = normalizeDriveId(process.env.SystemDrive || 'C:');
  return Boolean(normalized && systemDrive && normalized === systemDrive);
}

function sanitizeVolumeLabel(label) {
  return String(label || '')
    .replace(/[<>:"/\|?*.,;+=\[\]\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 32);
}

function normalizeCleanPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid clean request.');
  }
  const mode = VALID_CLEAN_MODES.has(payload.mode) ? payload.mode : 'full';
  const driveId = normalizeDriveId(payload.driveId);
  if (!driveId) {
    throw new Error('Invalid drive selection.');
  }
  const rawSettings = payload.settings || {};
  const settings = {
    unhide: Boolean(rawSettings.unhide),
    scan: Boolean(rawSettings.scan),
    autoQuarantine: Boolean(rawSettings.autoQuarantine),
    bootSectorScan: Boolean(rawSettings.bootSectorScan),
    cpuThrottling: Boolean(rawSettings.cpuThrottling),
    showSystem: Boolean(rawSettings.showSystem)
  };
  return { mode, driveId, settings };
}

function normalizeFormatPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid format request.');
  }
  const driveId = normalizeDriveId(payload.driveId);
  if (!driveId) {
    throw new Error('Invalid drive selection.');
  }
  const filesystem = VALID_FILESYSTEMS.has(String(payload.filesystem || '').trim())
    ? String(payload.filesystem).trim()
    : 'NTFS';
  const formatType = VALID_FORMAT_TYPES.has(String(payload.formatType || '').trim())
    ? String(payload.formatType).trim()
    : 'Quick';
  return {
    driveId,
    filesystem,
    formatType,
    label: sanitizeVolumeLabel(payload.label),
    challenge: normalizeDriveId(payload.challenge)
  };
}

function getDriveRiskInfo(drive) {
  if (!drive) {
    return {
      tone: 'danger',
      label: 'NO DRIVE',
      summary: 'No target drive selected.',
      canClean: false,
      canScan: false,
      canUnhide: false,
      canFullClean: false,
      canFormat: false
    };
  }

  const isSystem = Boolean(drive.isSystemDrive || isSystemDriveId(drive.id));
  const blockedType = drive.type === 'Network' || drive.type === 'Optical' || drive.type === 'Unknown';
  const canScan = !blockedType;
  const canUnhide = !isSystem && !blockedType;
  const canFullClean = canUnhide && canScan;
  const canFormat = !isSystem && FORMAT_ALLOWED_DRIVE_TYPES.has(drive.type) && Number(drive.sizeBytes || 0) > 0;

  if (isSystem) {
    return {
      tone: 'danger',
      label: 'SYSTEM DRIVE',
      summary: 'Scan-only. Unhide, full clean, and format are blocked on the Windows system drive.',
      canClean: false,
      canScan,
      canUnhide: false,
      canFullClean: false,
      canFormat: false
    };
  }

  if (blockedType) {
    return {
      tone: 'danger',
      label: String(drive.type || 'UNSUPPORTED').toUpperCase(),
      summary: `${drive.type || 'This'} drive type is blocked for DCC clean and format operations.`,
      canClean: false,
      canScan: false,
      canUnhide: false,
      canFullClean: false,
      canFormat: false
    };
  }

  if (drive.type === 'Removable') {
    return {
      tone: 'success',
      label: 'REMOVABLE',
      summary: 'Preferred target type. Clean, scan, and guarded format are available with confirmation.',
      canClean: true,
      canScan: true,
      canUnhide: true,
      canFullClean: true,
      canFormat
    };
  }

  if (drive.type === 'Fixed') {
    return {
      tone: 'warning',
      label: 'FIXED DRIVE',
      summary: 'High caution. Scan, unhide, and full clean are available. Formatting fixed drives is blocked in this release.',
      canClean: true,
      canScan: true,
      canUnhide: true,
      canFullClean: true,
      canFormat
    };
  }

  return {
    tone: 'warning',
    label: String(drive.type || 'UNKNOWN').toUpperCase(),
    summary: 'Review this target carefully before running any action.',
    canClean: true,
    canScan: true,
    canUnhide: true,
    canFullClean: true,
    canFormat
  };
}

async function requireKnownDrive(driveId) {
  const normalized = normalizeDriveId(driveId);
  if (!normalized) {
    throw new Error('Invalid drive selection.');
  }
  const drives = await getDrives();
  const selected = drives.find((drive) => normalizeDriveId(drive.id) === normalized);
  if (!selected) {
    throw new Error(`Drive ${normalized} is no longer connected.`);
  }
  return selected;
}

function shouldBlockSystemUnhide(options) {
  const settings = options.settings || {};
  const unhideRequested = (options.mode === 'unhide' || options.mode === 'full') && settings.unhide;
  return unhideRequested && isSystemDriveId(options.driveId);
}

function appendCappedOutput(sink, text) {
  if (!text) return;
  sink.totalChars = sink.totalChars || 0;
  if (sink.totalChars >= OUTPUT_CAP_CHARS) {
    if (!sink.truncated) {
      sink.push('\n[output truncated]\n');
      sink.truncated = true;
    }
    return;
  }
  const remaining = OUTPUT_CAP_CHARS - sink.totalChars;
  const chunk = text.length > remaining ? text.slice(0, remaining) : text;
  sink.push(chunk);
  sink.totalChars += chunk.length;
  if (chunk.length < text.length && !sink.truncated) {
    sink.push('\n[output truncated]\n');
    sink.truncated = true;
  }
}

let mainWindow = null;
let lastDriveEnumerationReport = null;

const taskState = {
  running: false,
  task: null,
  cancelled: false,
  userStopped: false,
  child: null,
  pulseTimer: null,
  scriptPath: null
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: WINDOW_BACKGROUND,
    frame: false,
    show: false,
    icon: path.join(__dirname, 'assets', 'dcc.ico'),
    title: APP_TITLE,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url).catch(() => {});
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!String(url || '').startsWith('file://')) {
      event.preventDefault();
    }
  });

  mainWindow.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });

  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  mainWindow.webContents.session.setPermissionCheckHandler(() => false);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
  mainWindow.on('maximize', () => sendEvent('window-maximized', { maximized: true }));
  mainWindow.on('unmaximize', () => sendEvent('window-maximized', { maximized: false }));

  try {
    if (typeof mainWindow.setAccentColor === 'function') {
      mainWindow.setAccentColor(ACCENT_COLOR);
    }
    if (typeof mainWindow.setBackgroundMaterial === 'function') {
      mainWindow.setBackgroundMaterial('mica');
    }
  } catch (_error) {
    // cosmetic window options vary by Windows version
  }
}

function sendEvent(type, payload = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send('drive-cleaner:event', { type, ...payload });
}

function timeStamp() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

function log(scope, message, tone = 'normal', includeTimestamp = true) {
  sendEvent('log', {
    scope,
    message,
    tone,
    timestamp: includeTimestamp ? timeStamp() : null
  });
}

function setStatus(label, tone = 'muted') {
  sendEvent('status', { label, tone });
}

function setRunning(running, task = null) {
  taskState.running = running;
  taskState.task = running ? task : null;
  sendEvent('running', { running, task: running ? task : null });
}

function updateCleanProgress(value, label) {
  sendEvent('clean-progress', {
    value,
    percent: Math.round(value * 100),
    label
  });
}

function updateFormatProgress(value, label) {
  sendEvent('format-progress', {
    value,
    percent: Math.round(value * 100),
    label
  });
}

function updateCleanStats(partial) {
  sendEvent('clean-stats', partial);
}

function notify(level, title, message) {
  sendEvent('toast', { level, title, message });
}

function psQuote(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

function psArray(values) {
  if (!values.length) {
    return '@()';
  }
  return `@(${values.map((value) => psQuote(value)).join(', ')})`;
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '?';
  }
  return `${(bytes / (1024 ** 3)).toFixed(1)} GB`;
}

function normalizeJsonList(raw) {
  if (!raw || !raw.trim()) {
    return [];
  }
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [parsed];
}

function setTaskChild(child) {
  taskState.child = child;
}

function clearTaskChild(child) {
  if (taskState.child === child) {
    taskState.child = null;
  }
}

function attachLineReader(stream, onLine, sink) {
  let buffer = '';

  stream.on('data', (chunk) => {
    const text = chunk.toString();
    appendCappedOutput(sink, text);
    buffer += text;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      onLine(line);
    }
  });

  return () => {
    if (buffer) {
      onLine(buffer);
      buffer = '';
    }
  };
}

function runProcess(file, args, options = {}) {
  const {
    timeoutMs = 0,
    trackTask = false,
    onStdoutLine = () => {},
    onStderrLine = () => {}
  } = options;

  return new Promise((resolve, reject) => {
    let timedOut = false;
    const stdoutChunks = [];
    const stderrChunks = [];
    const child = spawn(file, args, { windowsHide: true });

    if (trackTask) {
      setTaskChild(child);
    }

    const flushStdout = attachLineReader(child.stdout, onStdoutLine, stdoutChunks);
    const flushStderr = attachLineReader(child.stderr, onStderrLine, stderrChunks);

    let timeoutHandle = null;
    if (timeoutMs) {
      timeoutHandle = setTimeout(async () => {
        timedOut = true;
        await killProcessTree(child.pid);
      }, timeoutMs);
    }

    child.on('error', (error) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      clearTaskChild(child);
      reject(error);
    });

    child.on('close', (code, signal) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      flushStdout();
      flushStderr();
      clearTaskChild(child);
      resolve({
        code,
        signal,
        timedOut,
        stdout: stdoutChunks.join(''),
        stderr: stderrChunks.join('')
      });
    });
  });
}

async function killProcessTree(pid) {
  if (!pid) {
    return;
  }

  await new Promise((resolve) => {
    const killer = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true });
    killer.on('close', () => resolve());
    killer.on('error', () => resolve());
  });
}

async function checkAdmin() {
  const script = '[bool](([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator))';
  try {
    const result = await runProcess('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script]);
    return result.stdout.trim().toLowerCase() === 'true';
  } catch (_error) {
    return false;
  }
}

function quoteWindowsProcessArg(value) {
  const raw = String(value ?? '');
  const escaped = raw.replace(/\\(?=\")/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

async function relaunchAsAdministrator() {
  const rawArgs = process.defaultApp
    ? [app.getAppPath(), ...process.argv.slice(2)]
    : process.argv.slice(1);

  const quotedArgs = rawArgs.map(quoteWindowsProcessArg);

  const script = [
    `$exe = ${psQuote(process.execPath)}`,
    `$cwd = ${psQuote(process.cwd())}`,
    `$args = ${psArray(quotedArgs)}`,
    'Start-Process -FilePath $exe -WorkingDirectory $cwd -ArgumentList $args -Verb RunAs'
  ].join('; ');

  const result = await runProcess('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    timeoutMs: 15000
  });

  return result.code === 0;
}

async function ensureAdminOnLaunch() {
  if (process.platform !== 'win32') {
    return false;
  }

  const admin = await checkAdmin();
  if (admin) {
    return false;
  }

  let relaunched = false;
  try {
    relaunched = await relaunchAsAdministrator();
  } catch (_error) {
    relaunched = false;
  }

  if (!relaunched) {
    await dialog.showMessageBox({
      type: 'error',
      title: APP_TITLE,
      message: 'Administrator access is required.',
      detail: 'Approve the Windows elevation prompt to use DRIVE CLEANER.'
    });
  }

  app.quit();
  return true;
}

function mapDriveEntry(entry) {
  const id = String(entry.DeviceID || entry.Name || '').trim().toUpperCase();
  const normalizedId = normalizeDriveId(id);
  if (!normalizedId) {
    return null;
  }
  const pathValue = `${normalizedId}\\`;
  const source = String(entry.Provider || entry.Source || 'unknown').trim() || 'unknown';
  const typeName = String(entry.DriveTypeName || entry.Type || '').trim();
  let type = DRIVE_TYPES[Number(entry.DriveType)] || typeName || 'Unknown';
  if (/^cdrom$/i.test(type)) type = 'Optical';
  if (!['Removable', 'Fixed', 'Network', 'Optical', 'Unknown'].includes(type)) type = 'Unknown';
  const label = String(entry.VolumeName || entry.Label || '').trim() || 'No Label';
  const sizeBytes = Number(entry.Size || entry.TotalSize || 0);
  const sizeText = formatBytes(sizeBytes);
  return {
    id: normalizedId,
    path: pathValue,
    type,
    label,
    sizeBytes,
    sizeText,
    source,
    display: `${normalizedId}  [${type}]  ${label}  ${sizeText}`,
    isSystemDrive: isSystemDriveId(normalizedId),
    risk: isSystemDriveId(normalizedId) ? 'SYSTEM' : type.toUpperCase()
  };
}

function normalizeDriveEntries(raw) {
  return normalizeJsonList(raw)
    .map(mapDriveEntry)
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function mergeDriveLists(lists) {
  const byId = new Map();
  for (const list of lists) {
    for (const drive of list || []) {
      if (!drive || !drive.id) continue;
      const existing = byId.get(drive.id);
      if (!existing) {
        byId.set(drive.id, drive);
        continue;
      }
      const existingScore = (existing.type !== 'Unknown' ? 4 : 0) + (existing.sizeBytes > 0 ? 2 : 0) + (existing.label !== 'No Label' ? 1 : 0);
      const nextScore = (drive.type !== 'Unknown' ? 4 : 0) + (drive.sizeBytes > 0 ? 2 : 0) + (drive.label !== 'No Label' ? 1 : 0);
      if (nextScore > existingScore) {
        byId.set(drive.id, drive);
      }
    }
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

async function getDrivesFromCim() {
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "$drives = Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,DriveType,VolumeName,Size,@{Name='Provider';Expression={'CIM'}}",
    "@($drives) | ConvertTo-Json -Compress -Depth 3"
  ].join('; ');

  const result = await runProcess('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    timeoutMs: 12000
  });

  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || `Get-CimInstance failed with code ${result.code}.`);
  }

  return normalizeDriveEntries(result.stdout);
}

async function getDrivesFromDriveInfo() {
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "$drives = [System.IO.DriveInfo]::GetDrives() | Where-Object { $_.Name -and $_.Name.Length -ge 2 -and $_.Name.Substring(1,1) -eq ':' -and $_.IsReady } | ForEach-Object {",
    "  $driveType = switch ($_.DriveType.ToString()) { 'Removable' { 2 } 'Fixed' { 3 } 'Network' { 4 } 'CDRom' { 5 } default { 0 } }",
    "  [PSCustomObject]@{ DeviceID = $_.Name.Substring(0,2); DriveType = $driveType; DriveTypeName = $_.DriveType.ToString(); VolumeName = $_.VolumeLabel; Size = [int64]$_.TotalSize; Provider = 'DriveInfo' }",
    "}",
    "@($drives) | ConvertTo-Json -Compress -Depth 3"
  ].join('; ');

  const result = await runProcess('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    timeoutMs: 12000
  });

  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || `DriveInfo fallback failed with code ${result.code}.`);
  }

  return normalizeDriveEntries(result.stdout);
}

async function getDrivesFromPsDriveFallback() {
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "$drives = Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Root -and $_.Root.Length -ge 2 -and $_.Root.Substring(1,1) -eq ':' } | ForEach-Object {",
    "  $size = 0",
    "  if ($null -ne $_.Used -and $null -ne $_.Free) { $size = [int64]($_.Used + $_.Free) }",
    "  [PSCustomObject]@{ DeviceID = $_.Root.Substring(0,2); DriveType = 3; VolumeName = $_.Description; Size = $size; Provider = 'PSDrive' }",
    "}",
    "@($drives) | ConvertTo-Json -Compress -Depth 3"
  ].join('; ');

  const result = await runProcess('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    timeoutMs: 12000
  });

  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || `Get-PSDrive fallback failed with code ${result.code}.`);
  }

  return normalizeDriveEntries(result.stdout);
}

function getDrivesFromNodeRoots() {
  const drives = [];
  for (let code = 65; code <= 90; code += 1) {
    const letter = String.fromCharCode(code);
    const id = `${letter}:`;
    const rootPath = `${id}\\`;
    try {
      const stat = fs.statSync(rootPath);
      if (!stat || !stat.isDirectory()) continue;
      drives.push(mapDriveEntry({
        DeviceID: id,
        DriveType: 3,
        VolumeName: isSystemDriveId(id) ? 'System Drive' : 'Detected Drive',
        Size: 0,
        Provider: 'NodeRoots'
      }));
    } catch (_error) {
      // Drive letter is absent or inaccessible. Keep scanning the alphabet.
    }
  }
  return drives.filter(Boolean);
}

async function getDrives() {
  const attempts = [];
  const lists = [];

  async function tryProvider(name, provider) {
    try {
      const drives = await provider();
      attempts.push({ provider: name, ok: true, count: drives.length });
      if (drives.length) lists.push(drives);
    } catch (error) {
      attempts.push({ provider: name, ok: false, error: error.message || String(error) });
    }
  }

  await tryProvider('CIM', getDrivesFromCim);
  await tryProvider('DriveInfo', getDrivesFromDriveInfo);
  await tryProvider('PSDrive', getDrivesFromPsDriveFallback);

  try {
    const nodeDrives = getDrivesFromNodeRoots();
    attempts.push({ provider: 'NodeRoots', ok: true, count: nodeDrives.length });
    if (nodeDrives.length) lists.push(nodeDrives);
  } catch (error) {
    attempts.push({ provider: 'NodeRoots', ok: false, error: error.message || String(error) });
  }

  const merged = mergeDriveLists(lists);
  lastDriveEnumerationReport = {
    generatedAt: new Date().toISOString(),
    attempts,
    returned: merged.length
  };

  if (merged.length) {
    return merged;
  }

  const details = attempts.map((attempt) => attempt.ok
    ? `${attempt.provider}: ${attempt.count} drive(s)`
    : `${attempt.provider}: ${attempt.error}`).join(' | ');
  throw new Error(`Drive enumeration failed. ${details}`);
}

async function loadDrivesSafe() {
  try {
    return { drives: await getDrives(), driveLoadError: null };
  } catch (error) {
    return { drives: [], driveLoadError: error.message || 'Drive enumeration failed.' };
  }
}

function ensureDrivePath(driveId) {
  const normalized = normalizeDriveId(driveId);
  return normalized ? `${normalized}\\` : null;
}

function stopFormatPulse() {
  if (taskState.pulseTimer) {
    clearInterval(taskState.pulseTimer);
    taskState.pulseTimer = null;
  }
}

function startFormatPulse() {
  stopFormatPulse();
  let value = 0.3;
  taskState.pulseTimer = setInterval(() => {
    value = Math.min(0.92, value + 0.01);
    updateFormatProgress(value);
  }, 250);
}

async function cleanupTaskArtifacts() {
  stopFormatPulse();
  if (taskState.scriptPath) {
    try {
      await fsp.unlink(taskState.scriptPath);
    } catch (_error) {
      // ignore cleanup failures
    }
    taskState.scriptPath = null;
  }
}

async function unhideDrive(drivePath, showSystem) {
  let count = 0;
  const script = `
$showSystem = ${showSystem ? '$true' : '$false'}
$count = 0
$hiddenAttr = [System.IO.FileAttributes]::Hidden
$systemAttr = [System.IO.FileAttributes]::System
Get-ChildItem -LiteralPath ${psQuote(drivePath)} -Force -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
  try {
    $attrs = $_.Attributes
    $newAttrs = $attrs
    $changed = $false
    if (($attrs -band $hiddenAttr) -ne 0) {
      $newAttrs = $newAttrs -bxor $hiddenAttr
      $changed = $true
    }
    if ($showSystem -and (($attrs -band $systemAttr) -ne 0)) {
      $newAttrs = $newAttrs -bxor $systemAttr
      $changed = $true
    }
    if ($changed) {
      $item = Get-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue
      if ($null -ne $item) {
        $item.Attributes = $newAttrs
        $count++
        if (($count % 20) -eq 0) {
          Write-Output ('__COUNT__:' + $count)
        }
      }
    }
  } catch {
    # ignore item-level errors
  }
}
Write-Output ('__RESULT__:' + $count)
`;

  const result = await runProcess('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    trackTask: true,
    onStdoutLine: (line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return;
      }
      if (trimmed.startsWith('__COUNT__:')) {
        count = Number(trimmed.replace('__COUNT__:', '')) || count;
        log('clean', `  Revealed: ${count} items so far...`, 'dim');
        return;
      }
      if (trimmed.startsWith('__RESULT__:')) {
        count = Number(trimmed.replace('__RESULT__:', '')) || count;
      }
    }
  });

  if (!taskState.cancelled && result.code !== 0) {
    throw new Error(result.stderr.trim() || 'Failed to remove hidden attributes.');
  }

  return count;
}

async function scanDrive(drivePath, scanSettings) {
  const defenderPath = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Windows Defender', 'MpCmdRun.exe');
  const autoQuarantine = Boolean(scanSettings.autoQuarantine);
  const bootSectorScan = Boolean(scanSettings.bootSectorScan);
  const cpuThrottling = Boolean(scanSettings.cpuThrottling);

  if (fs.existsSync(defenderPath)) {
    log('clean', '  Defender CLI found. Launching scan...', 'dim');
    const scanArgs = ['-Scan', '-ScanType', '3', '-File', drivePath];

    if (!autoQuarantine) {
      scanArgs.push('-DisableRemediation');
      log('clean', '  Auto-remediation disabled for this scan.', 'dim');
    }
    if (bootSectorScan) {
      scanArgs.push('-BootSectorScan');
      log('clean', '  Boot sector scan enabled.', 'dim');
    }
    if (cpuThrottling) {
      scanArgs.push('-CpuThrottling');
      log('clean', '  CPU throttling enabled according to Defender policy.', 'dim');
    }

    const result = await runProcess(
      defenderPath,
      scanArgs,
      {
        timeoutMs: 600000,
        trackTask: true,
        onStdoutLine: (line) => {
          const trimmed = line.trim();
          if (trimmed) {
            log('clean', `  ${trimmed}`, 'dim');
          }
        },
        onStderrLine: (line) => {
          const trimmed = line.trim();
          if (trimmed) {
            log('clean', `  ${trimmed}`, 'dim');
          }
        }
      }
    );

    if (taskState.cancelled) {
      return 0;
    }

    if (result.timedOut) {
      log('clean', '  Scan timed out. Drive may be very large.', 'red');
      return 0;
    }

    if (result.code === 2) {
      log('clean', '  !! THREATS DETECTED by Windows Defender.', 'red');
      if (autoQuarantine) {
        log('clean', '  Auto-quarantine enabled — Defender will handle removal.', 'red');
      }
      return 1;
    }

    if (result.code === 0) {
      log('clean', '  Defender scan passed — no threats found.', 'green');
      return 0;
    }

    log('clean', `  Defender returned code ${result.code}. Check Windows Security.`, 'dim');
    return 0;
  }

  log('clean', '  Defender CLI not found. Using PowerShell fallback...', 'dim');
  if (!autoQuarantine || bootSectorScan || cpuThrottling) {
    log('clean', '  Fallback scan does not expose all Defender CLI options. Running a standard custom scan.', 'dim');
  }
  const script = `Start-MpScan -ScanPath ${psQuote(drivePath)} -ScanType CustomScan`;
  const result = await runProcess('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    timeoutMs: 30000,
    trackTask: true
  });

  if (taskState.cancelled) {
    return 0;
  }

  if (result.code === 0) {
    log('clean', '  Scan launched via PowerShell. Check Windows Security for results.', 'dim');
    return 0;
  }

  log('clean', `  PowerShell fallback failed: ${result.stderr.trim() || 'Unknown error'}`, 'red');
  return 0;
}

async function startCleanTask(options) {
  taskState.cancelled = false;
  taskState.userStopped = false;
  setRunning(true, 'clean');
  setStatus('RUNNING', 'accent');
  updateCleanProgress(0, 'Ready — select a drive and choose an action.');
  updateCleanStats({
    hidden: '0',
    threats: '0',
    threatsTone: 'danger',
    status: '—',
    statusTone: 'accent'
  });

  try {
    const mode = options.mode || 'full';
    const drivePath = ensureDrivePath(options.driveId);
    const settings = {
      unhide: Boolean(options.settings?.unhide),
      scan: Boolean(options.settings?.scan),
      autoQuarantine: Boolean(options.settings?.autoQuarantine),
      bootSectorScan: Boolean(options.settings?.bootSectorScan),
      cpuThrottling: Boolean(options.settings?.cpuThrottling),
      showSystem: Boolean(options.settings?.showSystem)
    };

    if (!drivePath) {
      throw new Error('No valid drive selected.');
    }
    if (!fs.existsSync(drivePath)) {
      throw new Error(`Drive ${drivePath} is not accessible.`);
    }

    log('clean', `Starting ${mode.toUpperCase()} on ${drivePath}`, 'gold');

    const doUnhide = (mode === 'unhide' || mode === 'full') && settings.unhide;
    const doScan = (mode === 'scan' || mode === 'full') && settings.scan;
    const totalSteps = (doUnhide ? 1 : 0) + (doScan ? 1 : 0);

    if (!totalSteps) {
      log('clean', 'No operations enabled in settings.', 'red');
      updateCleanProgress(0, 'No operations enabled.');
      setStatus('IDLE', 'muted');
      return;
    }

    let step = 0;
    let threats = 0;

    if (doUnhide && !taskState.cancelled) {
      updateCleanProgress(Math.max(step / totalSteps, 0.05), 'Removing hidden attributes...');
      log('clean', 'Phase 1: Unhiding files and folders...', 'white');
      const revealed = await unhideDrive(drivePath, settings.showSystem);
      if (!taskState.cancelled) {
        updateCleanStats({ hidden: String(revealed) });
        log('clean', `Unhide complete — ${revealed} item(s) revealed.`, 'green');
        step += 1;
        updateCleanProgress((step / totalSteps) * 0.9, 'Hidden items restored.');
      }
    }

    if (doScan && !taskState.cancelled) {
      updateCleanProgress(Math.max((step / totalSteps) * 0.9, 0.1), 'Running Windows Defender scan...');
      log('clean', 'Phase 2: Scanning for threats...', 'white');
      threats = await scanDrive(drivePath, settings);
      if (!taskState.cancelled) {
        step += 1;
        updateCleanProgress((step / totalSteps) * 0.9, 'Scan complete.');
      }
    }

    if (taskState.cancelled) {
      return;
    }

    updateCleanProgress(1, 'Complete.');
    setStatus('DONE', 'success');

    if (threats === 0) {
      updateCleanStats({
        threats: '0',
        threatsTone: 'success',
        status: 'CLEAN',
        statusTone: 'success'
      });
      log('clean', 'Drive is clean. No threats detected.', 'green');
    } else {
      updateCleanStats({
        threats: String(threats),
        threatsTone: 'danger',
        status: 'THREATS',
        statusTone: 'danger'
      });
      log('clean', 'Scan flagged issues. Open Windows Security to review.', 'red');
    }

    log('clean', '─'.repeat(52), 'dim', false);
  } catch (error) {
    if (!taskState.cancelled) {
      setStatus('ERROR', 'danger');
      updateCleanProgress(0, `Error: ${error.message}`);
      log('clean', error.message, 'red');
      notify('error', 'Clean Failed', error.message);
    }
  } finally {
    await cleanupTaskArtifacts();
    setRunning(false);
    taskState.cancelled = false;
    taskState.userStopped = false;
  }
}

async function getDriveSizeBytes(driveLetter) {
  const script = `(Get-Partition -DriveLetter ${driveLetter}).Size`;
  const result = await runProcess('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    timeoutMs: 10000
  });
  return Number(result.stdout.trim());
}

function sanitizeLabel(label) {
  return sanitizeVolumeLabel(label);
}

async function startFormatTask(options) {
  taskState.cancelled = false;
  taskState.userStopped = false;
  setRunning(true, 'format');
  setStatus('FORMATTING', 'danger');
  updateFormatProgress(0, 'Starting...');

  const driveId = normalizeDriveId(options.driveId);
  const filesystem = VALID_FILESYSTEMS.has(String(options.filesystem || '').trim()) ? String(options.filesystem).trim() : 'NTFS';
  const formatType = VALID_FORMAT_TYPES.has(String(options.formatType || '').trim()) ? String(options.formatType).trim() : 'Quick';
  const label = sanitizeLabel(options.label);

  try {
    if (!driveId) {
      throw new Error('No valid drive selected.');
    }

    log('format', `Starting ${formatType.toUpperCase()} FORMAT on ${driveId}...`, 'red');
    log('format', `Filesystem: ${filesystem}  |  Label: ${label || 'none'}`, 'dim');
    log('format', '─'.repeat(52), 'dim', false);

    const driveLetter = driveId.slice(0, 1);

    if (filesystem === 'FAT32') {
      try {
        const sizeBytes = await getDriveSizeBytes(driveLetter);
        const sizeGb = sizeBytes / (1024 ** 3);
        if (sizeGb > 32) {
          log('format', `  !! Drive is ${sizeGb.toFixed(1)} GB — FAT32 is limited to 32GB on Windows.`, 'red');
          log('format', '     Use exFAT instead — same cross-platform support, no size limit.', 'red');
          updateFormatProgress(0, 'Aborted — drive too large for FAT32.');
          setStatus('ABORTED', 'danger');
          return;
        }
      } catch (_error) {
        log('format', '  Could not verify drive size. Proceeding — Windows will report if FAT32 is unsupported.', 'dim');
      }
    }

    const quickFlag = formatType === 'Quick' ? ' quick' : '';
    const labelFlag = label ? ` label="${label}"` : '';
    const fsLower = filesystem.toLowerCase();

    const diskpartScript = [
      `select volume ${driveLetter}`,
      `format fs=${fsLower}${labelFlag}${quickFlag}`,
      'exit'
    ].join('\n');

    taskState.scriptPath = path.join(os.tmpdir(), `dcc_format_${Date.now()}.txt`);
    await fsp.writeFile(taskState.scriptPath, diskpartScript, 'utf8');

    updateFormatProgress(0.2, `Formatting as ${filesystem} (${formatType})...`);
    log('format', `Formatting as ${filesystem} (${formatType}) via diskpart...`, 'white');

    if (formatType === 'Full') {
      log('format', '  Full format on large drives can take 20-60+ min. No timeout set.', 'dim');
    } else {
      log('format', '  Quick format — timeout set to 5 minutes.', 'dim');
    }

    startFormatPulse();

    const result = await runProcess('diskpart', ['/s', taskState.scriptPath], {
      timeoutMs: formatType === 'Full' ? 0 : 300000,
      trackTask: true,
      onStdoutLine: (line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('Microsoft DiskPart version') || trimmed.startsWith('Copyright')) {
          return;
        }
        log('format', `  ${trimmed}`, 'dim');
      },
      onStderrLine: (line) => {
        const trimmed = line.trim();
        if (trimmed) {
          log('format', `  ${trimmed}`, 'red');
        }
      }
    });

    stopFormatPulse();

    if (taskState.cancelled) {
      return;
    }

    if (result.timedOut) {
      updateFormatProgress(0, 'Timed out.');
      log('format', 'Format timed out. Drive may be in use or unresponsive.', 'red');
      setStatus('TIMEOUT', 'danger');
      return;
    }

    const combinedOutput = `${result.stdout}\n${result.stderr}`.toLowerCase();
    const hasError = ['error', 'not found', 'failed', 'invalid', 'cannot'].some((token) => combinedOutput.includes(token));

    if (result.code === 0 && !hasError) {
      updateFormatProgress(1, 'Format complete.');
      log('format', '─'.repeat(52), 'dim', false);
      log('format', `Format complete. Drive ${driveId} is ready as ${filesystem}.`, 'green');
      setStatus('DONE', 'success');
      notify('success', 'Format Complete', `Drive ${driveId} formatted successfully as ${filesystem}.`);
      return;
    }

    updateFormatProgress(0, 'Format failed.');
    log('format', `  diskpart exit code: ${result.code}`, 'red');
    log('format', 'Format failed. See log above for details.', 'red');
    setStatus('ERROR', 'danger');
    notify('error', 'Format Failed', `Drive ${driveId} could not be formatted.`);
  } catch (error) {
    if (!taskState.cancelled) {
      stopFormatPulse();
      updateFormatProgress(0, `Error: ${error.message}`);
      log('format', `Format error: ${error.message}`, 'red');
      setStatus('ERROR', 'danger');
      notify('error', 'Format Failed', error.message);
    }
  } finally {
    await cleanupTaskArtifacts();
    setRunning(false);
    taskState.cancelled = false;
    taskState.userStopped = false;
  }
}

function isTrustedSender(event) {
  return Boolean(mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents);
}

function buildDiagnosticsPayload(admin, drives) {
  const systemDrive = normalizeDriveId(process.env.SystemDrive || 'C:') || 'C:';
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    appName: APP_TITLE,
    version: packageJson.version || '0.0.0',
    packaged: app.isPackaged,
    platform: `${process.platform} ${process.arch}`,
    versions: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node
    },
    admin,
    systemDrive,
    activeTask: {
      running: taskState.running,
      task: taskState.task,
      cancelled: taskState.cancelled
    },
    appearance: {
      mode: nativeTheme.themeSource,
      effective: nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    },
    drives: drives.map((drive) => ({
      id: drive.id,
      type: drive.type,
      label: drive.label,
      sizeText: drive.sizeText,
      source: drive.source || 'unknown',
      isSystemDrive: Boolean(drive.isSystemDrive),
      risk: getDriveRiskInfo(drive)
    })),
    driveEnumeration: lastDriveEnumerationReport,
    security: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      permissions: 'denied by default',
      webview: 'blocked',
      navigation: 'local app only',
      ipc: 'trusted renderer only',
      outputCap: OUTPUT_CAP_CHARS
    },
    safetyRules: [
      'Format is blocked on the Windows system drive.',
      'Unhide and full clean are blocked on the Windows system drive.',
      'Network and optical drives are blocked for DCC clean/format operations.',
      'Formatting is limited to removable drives in this release.',
      'Formatting requires two confirmations and exact typed drive ID challenge.',
      'Child-process output is capped to reduce runaway memory use.'
    ]
  };
}

function secureHandle(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!isTrustedSender(event)) {
      return { ok: false, message: 'Blocked untrusted renderer request.' };
    }
    try {
      return await handler(event, ...args);
    } catch (error) {
      const message = error && error.message ? error.message : 'Request failed.';
      return { ok: false, message };
    }
  });
}

function secureOn(channel, handler) {
  ipcMain.on(channel, (event, ...args) => {
    if (!isTrustedSender(event)) {
      return;
    }
    handler(event, ...args);
  });
}

secureHandle('app:init', async () => {
  const [admin, driveState] = await Promise.all([
    checkAdmin(),
    loadDrivesSafe()
  ]);

  return {
    ok: true,
    appName: APP_TITLE,
    admin,
    drives: driveState.drives,
    driveLoadError: driveState.driveLoadError,
    maximized: mainWindow ? mainWindow.isMaximized() : false,
    appearance: { mode: nativeTheme.themeSource, effective: nativeTheme.shouldUseDarkColors ? 'dark' : 'light' }
  };
});

secureHandle('drives:list', async () => {
  return getDrives();
});

secureHandle('app:diagnostics', async () => {
  const [admin, driveState] = await Promise.all([
    checkAdmin(),
    loadDrivesSafe()
  ]);
  const diagnostics = buildDiagnosticsPayload(admin, driveState.drives);
  diagnostics.driveLoadError = driveState.driveLoadError;
  return diagnostics;
});

secureHandle('appearance:set', async (_event, payload) => {
  const options = normalizeAppearancePayload(payload);
  return applyWindowAppearance(options.mode, options.accentColor);
});

secureHandle('clipboard:write', async (_event, text) => {
  const value = String(text || '').slice(0, 24000);
  clipboard.writeText(value);
  return { ok: true };
});

secureHandle('clean:start', async (_event, payload) => {
  if (taskState.running) {
    return { ok: false, message: 'Another task is already running.' };
  }

  const options = normalizeCleanPayload(payload);
  const selected = await requireKnownDrive(options.driveId);

  if (shouldBlockSystemUnhide(options)) {
    return { ok: false, message: 'Unhide operations are blocked on the Windows system drive for safety. Use scan-only for the system drive.' };
  }

  if (selected.type === 'Network' || selected.type === 'Optical') {
    return { ok: false, message: `${selected.type} drives are not supported for clean operations.` };
  }

  startCleanTask(options).catch((error) => {
    setStatus('ERROR', 'danger');
    log('clean', `Unexpected error: ${error.message}`, 'red');
  });
  return { ok: true };
});

secureHandle('format:start', async (_event, payload) => {
  if (taskState.running) {
    return { ok: false, message: 'Another task is already running.' };
  }

  const options = normalizeFormatPayload(payload);
  const selected = await requireKnownDrive(options.driveId);

  if (isSystemDriveId(options.driveId)) {
    return { ok: false, message: 'Formatting the Windows system drive is blocked.' };
  }

  if (FORMAT_BLOCKED_DRIVE_TYPES.has(selected.type)) {
    return { ok: false, message: `${selected.type} drives are not supported for formatting.` };
  }

  if (!FORMAT_ALLOWED_DRIVE_TYPES.has(selected.type)) {
    return { ok: false, message: 'Formatting is limited to removable drives in this release. This protects internal and fixed disks from accidental wipe.' };
  }

  if (!selected.sizeBytes || selected.sizeBytes <= 0) {
    return { ok: false, message: 'Drive size could not be verified. Formatting blocked.' };
  }

  if (options.challenge !== options.driveId) {
    return { ok: false, message: `Format challenge failed. Type ${options.driveId} exactly before formatting.` };
  }

  startFormatTask(options).catch((error) => {
    setStatus('ERROR', 'danger');
    log('format', `Unexpected error: ${error.message}`, 'red');
  });
  return { ok: true };
});

secureHandle('task:stop', async () => {
  if (!taskState.running) {
    return { ok: false, message: 'No active task.' };
  }

  taskState.cancelled = true;
  taskState.userStopped = true;

  if (taskState.task === 'format') {
    log('format', 'Task stopped by user.', 'red');
  } else {
    log('clean', 'Task stopped by user.', 'red');
  }

  setStatus('STOPPED', 'danger');
  stopFormatPulse();
  await killProcessTree(taskState.child?.pid);
  return { ok: true };
});

secureOn('window:action', (_event, action) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (action === 'minimize') {
    mainWindow.minimize();
    return;
  }

  if (action === 'toggle-maximize') {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
    return;
  }

  if (action === 'close') {
    mainWindow.close();
  }
});

app.whenReady().then(async () => {
  app.setName(APP_TITLE);
  const handedOffToAdmin = await ensureAdminOnLaunch();
  if (handedOffToAdmin) {
    return;
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
