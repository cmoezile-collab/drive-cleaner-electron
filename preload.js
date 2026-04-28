const { contextBridge, ipcRenderer } = require('electron');

const CLEAN_MODES = new Set(['unhide', 'scan', 'full']);
const FILESYSTEMS = new Set(['NTFS', 'exFAT', 'FAT32']);
const FORMAT_TYPES = new Set(['Quick', 'Full']);
const WINDOW_ACTIONS = new Set(['minimize', 'toggle-maximize', 'close']);
const APPEARANCE_MODES = new Set(['dark', 'light', 'system']);

function normalizeDriveId(value) {
  const text = String(value || '').trim().toUpperCase();
  return /^[A-Z]:$/.test(text) ? text : null;
}

function cleanString(value, maxLength = 256) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\x00-\x1F]/g, '').trim().slice(0, maxLength);
}

function sanitizeLabel(value) {
  return cleanString(value, 64)
    .replace(/[<>:"/\|?*.,;+=\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 32);
}


function normalizeAppearancePayload(value) {
  const source = value && typeof value === 'object' ? value : {};
  const mode = APPEARANCE_MODES.has(String(source.mode || '').toLowerCase()) ? String(source.mode).toLowerCase() : 'dark';
  const accentColor = /^#[0-9a-f]{6}$/i.test(String(source.accentColor || '')) ? String(source.accentColor).toLowerCase() : '#d4b064';
  return { mode, accentColor };
}

function normalizeCleanPayload(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const driveId = normalizeDriveId(source.driveId);
  const settings = source.settings && typeof source.settings === 'object' ? source.settings : {};
  return {
    mode: CLEAN_MODES.has(source.mode) ? source.mode : 'full',
    driveId,
    settings: {
      unhide: Boolean(settings.unhide),
      scan: Boolean(settings.scan),
      autoQuarantine: Boolean(settings.autoQuarantine),
      bootSectorScan: Boolean(settings.bootSectorScan),
      cpuThrottling: Boolean(settings.cpuThrottling),
      showSystem: Boolean(settings.showSystem)
    }
  };
}

function normalizeFormatPayload(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const filesystem = FILESYSTEMS.has(String(source.filesystem || '').trim()) ? String(source.filesystem).trim() : 'NTFS';
  const formatType = FORMAT_TYPES.has(String(source.formatType || '').trim()) ? String(source.formatType).trim() : 'Quick';
  return {
    driveId: normalizeDriveId(source.driveId),
    filesystem,
    formatType,
    label: sanitizeLabel(source.label),
    challenge: normalizeDriveId(source.challenge)
  };
}

contextBridge.exposeInMainWorld('driveCleaner', {
  getInitialState: () => ipcRenderer.invoke('app:init'),
  refreshDrives: () => ipcRenderer.invoke('drives:list'),
  getDiagnostics: () => ipcRenderer.invoke('app:diagnostics'),
  setAppearance: (payload) => ipcRenderer.invoke('appearance:set', normalizeAppearancePayload(payload)),
  copyText: (text) => ipcRenderer.invoke('clipboard:write', cleanString(text, 24000)),
  startClean: (payload) => ipcRenderer.invoke('clean:start', normalizeCleanPayload(payload)),
  startFormat: (payload) => ipcRenderer.invoke('format:start', normalizeFormatPayload(payload)),
  stopTask: () => ipcRenderer.invoke('task:stop'),
  windowAction: (action) => {
    if (WINDOW_ACTIONS.has(action)) {
      ipcRenderer.send('window:action', action);
    }
  },
  onEvent: (callback) => {
    if (typeof callback !== 'function') {
      return () => {};
    }
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('drive-cleaner:event', listener);
    return () => ipcRenderer.removeListener('drive-cleaner:event', listener);
  }
});
