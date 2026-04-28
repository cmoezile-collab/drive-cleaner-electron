#!/usr/bin/env node
/*
 * DCC Drive Doctor
 * Standalone drive-enumeration diagnostic harness.
 * Does not modify the app. Run from Drive Cleaner project root:
 *   node scripts/dcc-drive-doctor.js
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const root = process.cwd();
const logsDir = path.join(root, 'logs');
fs.mkdirSync(logsDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const logPath = path.join(logsDir, `dcc-drive-doctor-${stamp}.txt`);

function write(line = '') {
  console.log(line);
  fs.appendFileSync(logPath, line + os.EOL, 'utf8');
}

function run(command, args, timeoutMs = 15000) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: timeoutMs,
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
  });
  return {
    command,
    args,
    status: result.status,
    signal: result.signal,
    error: result.error ? String(result.error.message || result.error) : null,
    timedOut: result.error && String(result.error.code || '').includes('ETIMEDOUT'),
    elapsedMs: Date.now() - started,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
  };
}

function parseJson(stdout) {
  const text = String(stdout || '').trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    return { parseError: error.message, raw: text.slice(0, 2000) };
  }
}

function normalizeDrive(item, source) {
  if (!item || typeof item !== 'object') return null;
  const id = String(item.DeviceID || item.Name || item.Root || item.DriveLetter || '').trim();
  if (!id) return null;
  const driveId = id.endsWith(':') ? id : /^[A-Z]$/i.test(id) ? `${id.toUpperCase()}:` : id.replace(/\\$/, '');
  if (!/^[A-Z]:$/i.test(driveId)) return null;
  const rootPath = `${driveId}\\`;
  return {
    id: driveId.toUpperCase(),
    path: rootPath,
    label: String(item.VolumeName || item.FileSystemLabel || item.Description || item.DisplayRoot || 'No Label').trim() || 'No Label',
    typeRaw: item.DriveType ?? item.Provider ?? item.DriveFormat ?? null,
    sizeBytes: Number(item.Size || item.Used + item.Free || 0) || 0,
    source,
  };
}

function uniqueDrives(all) {
  const map = new Map();
  for (const drive of all) {
    if (!drive || !drive.id) continue;
    const existing = map.get(drive.id);
    if (!existing || (!existing.sizeBytes && drive.sizeBytes)) {
      map.set(drive.id, drive);
    } else if (existing.source && !existing.source.includes(drive.source)) {
      existing.source += `,${drive.source}`;
    }
  }
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function psJson(script) {
  return run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], 20000);
}

write('DCC Drive Doctor');
write(`Project: ${root}`);
write(`Generated: ${new Date().toISOString()}`);
write(`Platform: ${process.platform} ${process.arch}`);
write(`Node: ${process.version}`);
write('');

const providers = [];

providers.push({
  name: 'PowerShell Get-CimInstance Win32_LogicalDisk',
  result: psJson(`$ErrorActionPreference='Stop'; Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,DriveType,VolumeName,Size | ConvertTo-Json -Compress`),
  parse: (stdout) => {
    const parsed = parseJson(stdout);
    return Array.isArray(parsed) ? parsed.map((x) => normalizeDrive(x, 'cim')).filter(Boolean) : parsed;
  },
});

providers.push({
  name: '.NET System.IO.DriveInfo',
  result: psJson(`$ErrorActionPreference='Stop'; [System.IO.DriveInfo]::GetDrives() | ForEach-Object { [pscustomobject]@{ DeviceID=$_.Name.TrimEnd('\\'); DriveType=$_.DriveType.ToString(); VolumeName=$(if($_.IsReady){$_.VolumeLabel}else{'Not Ready'}); Size=$(if($_.IsReady){$_.TotalSize}else{0}) } } | ConvertTo-Json -Compress`),
  parse: (stdout) => {
    const parsed = parseJson(stdout);
    return Array.isArray(parsed) ? parsed.map((x) => normalizeDrive(x, 'driveinfo')).filter(Boolean) : parsed;
  },
});

providers.push({
  name: 'PowerShell Get-PSDrive FileSystem',
  result: psJson(`$ErrorActionPreference='Stop'; Get-PSDrive -PSProvider FileSystem | Select-Object Name,Root,Description,Used,Free | ConvertTo-Json -Compress`),
  parse: (stdout) => {
    const parsed = parseJson(stdout);
    return Array.isArray(parsed) ? parsed.map((x) => normalizeDrive(x, 'psdrive')).filter(Boolean) : parsed;
  },
});

providers.push({
  name: 'WMIC logicaldisk',
  result: run('wmic.exe', ['logicaldisk', 'get', 'DeviceID,DriveType,VolumeName,Size', '/format:csv'], 20000),
  parse: (stdout) => {
    const lines = String(stdout || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    const headerLine = lines.find((line) => /^Node,/i.test(line));
    if (!headerLine) return [];
    const headers = headerLine.split(',');
    return lines.filter((line) => !/^Node,/i.test(line)).map((line) => {
      const values = line.split(',');
      const obj = {};
      headers.forEach((h, i) => { obj[h] = values[i]; });
      return normalizeDrive(obj, 'wmic');
    }).filter(Boolean);
  },
});

const nodeRootDrives = [];
for (let code = 65; code <= 90; code += 1) {
  const id = String.fromCharCode(code) + ':';
  const rootPath = id + '\\';
  try {
    if (fs.existsSync(rootPath)) {
      let sizeBytes = 0;
      try {
        const stat = fs.statSync(rootPath);
        sizeBytes = Number(stat.size || 0) || 0;
      } catch (_) {}
      nodeRootDrives.push({ id, path: rootPath, label: 'Detected by Node root scan', typeRaw: 'Unknown', sizeBytes, source: 'node-root-scan' });
    }
  } catch (_) {}
}

providers.push({
  name: 'Node A-Z root scan',
  result: { status: 0, signal: null, error: null, timedOut: false, elapsedMs: 0, stdout: JSON.stringify(nodeRootDrives), stderr: '' },
  parse: () => nodeRootDrives,
});

let merged = [];
for (const provider of providers) {
  write(`Provider: ${provider.name}`);
  const r = provider.result;
  write(`  status: ${r.status}  signal: ${r.signal || '-'}  elapsed: ${r.elapsedMs}ms`);
  if (r.error) write(`  error: ${r.error}`);
  if (r.stderr.trim()) write(`  stderr: ${r.stderr.trim().slice(0, 2000)}`);
  const parsed = provider.parse(r.stdout);
  if (Array.isArray(parsed)) {
    write(`  drives: ${parsed.length}`);
    for (const drive of parsed) write(`    - ${drive.id} ${drive.label} ${drive.source}`);
    merged.push(...parsed);
  } else {
    write(`  parse-error: ${JSON.stringify(parsed)}`);
  }
  write('');
}

merged = uniqueDrives(merged);
write('Merged result');
write(`  drives: ${merged.length}`);
for (const drive of merged) {
  write(`  - ${drive.id} | ${drive.label} | ${drive.source} | ${drive.sizeBytes || 0}`);
}
write('');
write(`Log saved to: ${logPath}`);
process.exit(merged.length ? 0 : 2);
