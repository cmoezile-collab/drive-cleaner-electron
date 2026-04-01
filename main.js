const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const APP_TITLE = 'DRIVE CLEANER | by Clark';
const WINDOW_BACKGROUND = '#09090B';
const ACCENT_COLOR = '#d4b064';
const DRIVE_TYPES = {
  2: 'Removable',
  3: 'Fixed',
  4: 'Network',
  5: 'Optical'
};

let mainWindow = null;
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
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
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
    sink.push(text);
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

async function relaunchAsAdministrator() {
  const args = process.defaultApp
    ? [app.getAppPath(), ...process.argv.slice(2)]
    : process.argv.slice(1);

  const script = [
    `Start-Process -FilePath ${psQuote(process.execPath)}`,
    `-WorkingDirectory ${psQuote(process.cwd())}`,
    `-ArgumentList ${psArray(args)}`,
    '-Verb RunAs'
  ].join(' ');

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

async function getDrives() {
  const script = [
    '$drives = Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,DriveType,VolumeName,Size',
    '$drives | ConvertTo-Json -Compress'
  ].join('; ');

  const result = await runProcess('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    timeoutMs: 10000
  });

  const drives = normalizeJsonList(result.stdout);
  return drives
    .filter((entry) => entry && entry.DeviceID)
    .map((entry) => {
      const id = String(entry.DeviceID).trim();
      const pathValue = id.endsWith(':') ? `${id}\\` : id;
      const type = DRIVE_TYPES[Number(entry.DriveType)] || 'Unknown';
      const label = String(entry.VolumeName || '').trim() || 'No Label';
      const sizeText = formatBytes(entry.Size);
      return {
        id,
        path: pathValue,
        type,
        label,
        sizeBytes: Number(entry.Size || 0),
        sizeText,
        display: `${id}  [${type}]  ${label}  ${sizeText}`
      };
    });
}

function ensureDrivePath(driveId) {
  if (!driveId || typeof driveId !== 'string' || !driveId.includes(':')) {
    return null;
  }
  return driveId.endsWith(':') ? `${driveId}\\` : driveId;
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
  return String(label || '')
    .replace(/["\r\n]/g, '')
    .trim();
}

async function startFormatTask(options) {
  taskState.cancelled = false;
  taskState.userStopped = false;
  setRunning(true, 'format');
  setStatus('FORMATTING', 'danger');
  updateFormatProgress(0, 'Starting...');

  const driveId = options.driveId;
  const filesystem = String(options.filesystem || 'NTFS').trim();
  const formatType = String(options.formatType || 'Quick').trim();
  const label = sanitizeLabel(options.label);

  try {
    if (!driveId) {
      throw new Error('No valid drive selected.');
    }

    log('format', `Starting ${formatType.toUpperCase()} FORMAT on ${driveId}...`, 'red');
    log('format', `Filesystem: ${filesystem}  |  Label: ${label || 'none'}`, 'dim');
    log('format', '─'.repeat(52), 'dim', false);

    const driveLetter = driveId.replace(':', '').trim();

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

ipcMain.handle('app:init', async () => {
  const [admin, drives] = await Promise.all([
    checkAdmin(),
    getDrives().catch(() => [])
  ]);

  return {
    appName: APP_TITLE,
    admin,
    drives
  };
});

ipcMain.handle('drives:list', async () => {
  return getDrives();
});

ipcMain.handle('clean:start', async (_event, payload) => {
  if (taskState.running) {
    return { ok: false, message: 'Another task is already running.' };
  }
  startCleanTask(payload).catch((error) => {
    setStatus('ERROR', 'danger');
    log('clean', `Unexpected error: ${error.message}`, 'red');
  });
  return { ok: true };
});

ipcMain.handle('format:start', async (_event, payload) => {
  if (taskState.running) {
    return { ok: false, message: 'Another task is already running.' };
  }
  startFormatTask(payload).catch((error) => {
    setStatus('ERROR', 'danger');
    log('format', `Unexpected error: ${error.message}`, 'red');
  });
  return { ok: true };
});

ipcMain.handle('task:stop', async () => {
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

ipcMain.on('window:action', (_event, action) => {
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
