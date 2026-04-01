const state = {
  drives: [],
  currentTab: 'clean',
  running: false,
  activeTask: null,
  modalResolver: null
};

const elements = {};

document.addEventListener('DOMContentLoaded', async () => {
  cacheElements();
  bindEvents();
  setStatusBadge('IDLE', 'muted');
  setRunningState(false, null);
  seedDefaultLogs();

  const unsubscribe = window.driveCleaner.onEvent(handleAppEvent);
  window.addEventListener('beforeunload', unsubscribe);

  await bootstrap();
});

function cacheElements() {
  elements.driveSelect = document.getElementById('driveSelect');
  elements.refreshDrives = document.getElementById('refreshDrives');
  elements.settingUnhide = document.getElementById('settingUnhide');
  elements.settingScan = document.getElementById('settingScan');
  elements.settingAutoQ = document.getElementById('settingAutoQ');
  elements.settingBootSector = document.getElementById('settingBootSector');
  elements.settingCpuThrottle = document.getElementById('settingCpuThrottle');
  elements.settingShowSystem = document.getElementById('settingShowSystem');
  elements.adminBadge = document.getElementById('adminBadge');
  elements.statusBadge = document.getElementById('statusBadge');
  elements.privilegeValue = document.getElementById('privilegeValue');
  elements.cleanPercent = document.getElementById('cleanPercent');
  elements.cleanProgressFill = document.getElementById('cleanProgressFill');
  elements.cleanTaskLabel = document.getElementById('cleanTaskLabel');
  elements.formatPercent = document.getElementById('formatPercent');
  elements.formatProgressFill = document.getElementById('formatProgressFill');
  elements.formatTaskLabel = document.getElementById('formatTaskLabel');
  elements.statHidden = document.getElementById('statHidden');
  elements.statThreats = document.getElementById('statThreats');
  elements.statStatus = document.getElementById('statStatus');
  elements.cleanLog = document.getElementById('cleanLog');
  elements.formatLog = document.getElementById('formatLog');
  elements.btnUnhide = document.getElementById('btnUnhide');
  elements.btnScan = document.getElementById('btnScan');
  elements.btnFull = document.getElementById('btnFull');
  elements.btnClearLog = document.getElementById('btnClearLog');
  elements.btnStop = document.getElementById('btnStop');
  elements.formatDrive = document.getElementById('formatDrive');
  elements.formatLabel = document.getElementById('formatLabel');
  elements.tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
  elements.panels = {
    clean: document.getElementById('panel-clean'),
    format: document.getElementById('panel-format')
  };
  elements.windowButtons = Array.from(document.querySelectorAll('[data-window-action]'));
  elements.modal = document.getElementById('confirmModal');
  elements.modalEyebrow = document.getElementById('modalEyebrow');
  elements.modalTitle = document.getElementById('modalTitle');
  elements.modalMessage = document.getElementById('modalMessage');
  elements.modalCancel = document.getElementById('modalCancel');
  elements.modalConfirm = document.getElementById('modalConfirm');
  elements.toastStack = document.getElementById('toastStack');
}

function bindEvents() {
  for (const button of elements.windowButtons) {
    button.addEventListener('click', () => {
      window.driveCleaner.windowAction(button.dataset.windowAction);
    });
  }

  elements.tabButtons.forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tabTarget));
  });

  elements.refreshDrives.addEventListener('click', () => {
    refreshDrives().catch((error) => {
      showToast('error', 'Drive Refresh Failed', error.message);
      appendLog('clean', error.message, 'red');
    });
  });

  elements.btnUnhide.addEventListener('click', () => startClean('unhide'));
  elements.btnScan.addEventListener('click', () => startClean('scan'));
  elements.btnFull.addEventListener('click', () => startClean('full'));
  elements.formatDrive.addEventListener('click', () => confirmAndFormat());

  elements.btnStop.addEventListener('click', async () => {
    const result = await window.driveCleaner.stopTask();
    if (!result.ok) {
      showToast('info', 'Nothing To Stop', result.message);
    }
  });

  elements.btnClearLog.addEventListener('click', () => {
    const box = getActiveLogBox();
    box.innerHTML = '';
    appendLog(state.currentTab, 'Log cleared.', 'dim');
  });

  elements.modalCancel.addEventListener('click', () => resolveModal(false));
  elements.modalConfirm.addEventListener('click', () => resolveModal(true));
  elements.modal.addEventListener('click', (event) => {
    if (event.target === elements.modal) {
      resolveModal(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !elements.modal.classList.contains('hidden')) {
      resolveModal(false);
    }
  });
}

async function bootstrap() {
  const initial = await window.driveCleaner.getInitialState();
  document.title = initial.appName || 'DRIVE CLEANER | by Clark';
  setAdminState(Boolean(initial.admin));
  populateDrives(initial.drives || []);
}

function seedDefaultLogs() {
  appendLog('clean', 'Drive Cleaner initialized.', 'dim');
  appendLog('clean', 'Select a drive from the left panel, then run.', 'dim');
  appendLog('format', 'Format module ready. Select your drive + options, then click FORMAT DRIVE.', 'dim');
}

function setActiveTab(tab) {
  state.currentTab = tab;
  elements.tabButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.tabTarget === tab);
  });
  Object.entries(elements.panels).forEach(([key, panel]) => {
    panel.classList.toggle('active', key === tab);
  });
}

function setAdminState(admin) {
  elements.adminBadge.textContent = admin ? 'ELEVATED' : 'NOT ADMIN';
  elements.adminBadge.className = `pill ${admin ? 'success' : 'danger'}`;
  elements.privilegeValue.textContent = admin ? 'Elevated' : 'Not Admin';
  elements.privilegeValue.style.color = admin ? 'var(--success)' : 'var(--danger)';

  if (!admin) {
    appendLog('clean', 'Run this app as administrator for full drive access and formatting.', 'red');
  }
}

function setStatusBadge(label, tone) {
  elements.statusBadge.textContent = label;
  elements.statusBadge.className = `pill ${tone || 'muted'}`;
}

function populateDrives(drives) {
  const previous = elements.driveSelect.value;
  state.drives = drives;
  elements.driveSelect.innerHTML = '';

  if (!drives.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No drives detected';
    elements.driveSelect.appendChild(option);
    return;
  }

  drives.forEach((drive) => {
    const option = document.createElement('option');
    option.value = drive.id;
    option.textContent = drive.display;
    elements.driveSelect.appendChild(option);
  });

  const hasPrevious = drives.some((drive) => drive.id === previous);
  elements.driveSelect.value = hasPrevious ? previous : drives[0].id;
}

function getSelectedDrive() {
  const driveId = elements.driveSelect.value;
  return state.drives.find((drive) => drive.id === driveId) || null;
}

function getSettings() {
  return {
    unhide: elements.settingUnhide.checked,
    scan: elements.settingScan.checked,
    autoQuarantine: elements.settingAutoQ.checked,
    bootSectorScan: elements.settingBootSector.checked,
    cpuThrottling: elements.settingCpuThrottle.checked,
    showSystem: elements.settingShowSystem.checked
  };
}

async function refreshDrives() {
  appendLog('clean', 'Scanning for connected drives...', 'dim');
  const drives = await window.driveCleaner.refreshDrives();
  populateDrives(drives || []);
  appendLog('clean', `Found ${drives.length} drive(s).`, 'gold');
}

async function startClean(mode) {
  const selectedDrive = getSelectedDrive();
  if (!selectedDrive) {
    showToast('error', 'No Drive Selected', 'Pick a valid drive before starting a clean run.');
    return;
  }

  const result = await window.driveCleaner.startClean({
    mode,
    driveId: selectedDrive.id,
    settings: getSettings()
  });

  if (!result.ok) {
    showToast('error', 'Task Busy', result.message);
  }
}

async function confirmAndFormat() {
  const selectedDrive = getSelectedDrive();
  if (!selectedDrive) {
    showToast('error', 'No Drive Selected', 'Pick a valid drive before starting a format.');
    return;
  }

  const filesystem = document.querySelector('input[name="filesystem"]:checked')?.value || 'NTFS';
  const formatType = document.querySelector('input[name="formatType"]:checked')?.value || 'Quick';
  const label = elements.formatLabel.value.trim();

  setActiveTab('format');

  const firstConfirm = await showConfirm({
    eyebrow: 'CONFIRM FORMAT',
    title: `Format ${selectedDrive.id}?`,
    message: `Filesystem: ${filesystem}\nType: ${formatType} Format\nLabel: ${label || '(none)'}\n\nAll data on this drive will be permanently erased.`,
    confirmText: 'YES, CONTINUE'
  });
  if (!firstConfirm) {
    appendLog('format', 'Format cancelled by user.', 'dim');
    return;
  }

  const secondConfirm = await showConfirm({
    eyebrow: 'FINAL WARNING',
    title: 'Last chance.',
    message: `Drive ${selectedDrive.id} will be completely wiped.\nThis cannot be undone.`,
    confirmText: 'FORMAT DRIVE'
  });
  if (!secondConfirm) {
    appendLog('format', 'Format cancelled at final warning.', 'dim');
    return;
  }

  const result = await window.driveCleaner.startFormat({
    driveId: selectedDrive.id,
    filesystem,
    formatType,
    label
  });

  if (!result.ok) {
    showToast('error', 'Task Busy', result.message);
  }
}

function setRunningState(running, task) {
  state.running = running;
  state.activeTask = task;

  const shouldDisable = running;
  const controls = [
    elements.driveSelect,
    elements.refreshDrives,
    elements.settingUnhide,
    elements.settingScan,
    elements.settingAutoQ,
    elements.settingBootSector,
    elements.settingCpuThrottle,
    elements.settingShowSystem,
    elements.btnUnhide,
    elements.btnScan,
    elements.btnFull,
    elements.formatDrive,
    elements.formatLabel,
    ...document.querySelectorAll('input[name="filesystem"]'),
    ...document.querySelectorAll('input[name="formatType"]')
  ];

  controls.forEach((element) => {
    element.disabled = shouldDisable;
  });

  elements.btnStop.disabled = !running;
}

function setCleanProgress(value, percent, label) {
  elements.cleanProgressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  elements.cleanPercent.textContent = `${percent}%`;
  if (label) {
    elements.cleanTaskLabel.textContent = label;
  }
}

function setFormatProgress(value, percent, label) {
  elements.formatProgressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  elements.formatPercent.textContent = `${percent}%`;
  if (label) {
    elements.formatTaskLabel.textContent = label;
  }
}

function updateCleanStats(payload) {
  if (payload.hidden !== undefined) {
    elements.statHidden.textContent = payload.hidden;
  }
  if (payload.threats !== undefined) {
    elements.statThreats.textContent = payload.threats;
  }
  if (payload.threatsTone) {
    elements.statThreats.dataset.tone = payload.threatsTone;
  }
  if (payload.status !== undefined) {
    elements.statStatus.textContent = payload.status;
  }
  if (payload.statusTone) {
    elements.statStatus.dataset.tone = payload.statusTone;
  }
}

function getActiveLogBox() {
  return state.currentTab === 'format' ? elements.formatLog : elements.cleanLog;
}

function appendLog(scope, message, tone = 'normal', timestamp = new Date().toLocaleTimeString('en-GB', { hour12: false })) {
  const target = scope === 'format' ? elements.formatLog : elements.cleanLog;
  const entry = document.createElement('div');
  entry.className = `log-entry tone-${tone}`;

  if (timestamp) {
    const stamp = document.createElement('span');
    stamp.className = 'stamp';
    stamp.textContent = `[${timestamp}]`;
    entry.appendChild(stamp);
  }

  const body = document.createElement('span');
  body.className = 'message';
  body.textContent = message;
  entry.appendChild(body);

  target.appendChild(entry);
  target.scrollTop = target.scrollHeight;
}

function showToast(level, title, message) {
  const toast = document.createElement('div');
  toast.className = `toast ${level}`;

  const heading = document.createElement('strong');
  heading.textContent = title;
  toast.appendChild(heading);

  const body = document.createElement('p');
  body.textContent = message;
  toast.appendChild(body);

  elements.toastStack.appendChild(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

function showConfirm({ eyebrow, title, message, confirmText }) {
  elements.modalEyebrow.textContent = eyebrow || 'CONFIRM ACTION';
  elements.modalTitle.textContent = title || 'Are you sure?';
  elements.modalMessage.textContent = message || '';
  elements.modalConfirm.textContent = confirmText || 'CONTINUE';
  elements.modal.classList.remove('hidden');

  return new Promise((resolve) => {
    state.modalResolver = resolve;
  });
}

function resolveModal(value) {
  if (state.modalResolver) {
    state.modalResolver(value);
    state.modalResolver = null;
  }
  elements.modal.classList.add('hidden');
}

function handleAppEvent(event) {
  switch (event.type) {
    case 'status':
      setStatusBadge(event.label, event.tone);
      break;
    case 'running':
      setRunningState(event.running, event.task);
      break;
    case 'clean-progress':
      setCleanProgress(event.value, event.percent, event.label);
      break;
    case 'format-progress':
      setFormatProgress(event.value, event.percent, event.label);
      break;
    case 'clean-stats':
      updateCleanStats(event);
      break;
    case 'log':
      appendLog(event.scope, event.message, event.tone, event.timestamp);
      break;
    case 'toast':
      showToast(
        event.level === 'error' ? 'error' : event.level === 'success' ? 'success' : 'info',
        event.title,
        event.message
      );
      break;
    default:
      break;
  }
}
