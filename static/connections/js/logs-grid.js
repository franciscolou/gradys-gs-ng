// Standalone window: shows each known device's telemetry log in its own grid cell.
// This window has no websocket of its own - it receives data the main ground station window
// forwards over a BroadcastChannel, so it only works while that window/tab stays open.

var deviceCells = {}; // deviceKey -> {stream, cell, localCollapseToggle}
var deviceFilterState = {};
var logFilterMenuOpen = false;
var globalCollapse = true;
var globalAutoScroll = true;
var globalRawMode = false;

// Fixed section (not a per-device cell) for commands the main ground station window sends -
// see main.js sendCommand(). It never collapses: unlike telemetry, sent commands aren't a
// repeating stream, so there's nothing meaningful to fold into a run.
var commandsSentStream = createLogStream(document.getElementById('commands-sent-stream'), {autoScroll: globalAutoScroll, collapse: false, rawMode: globalRawMode});

function hideEmptyState() {
  var empty = document.getElementById('logs-grid-empty');
  if (empty) empty.remove();
}

function ensureDeviceCell(deviceKey) {
  if (deviceCells[deviceKey]) return deviceCells[deviceKey];
  hideEmptyState();

  var cell = document.createElement('div');
  cell.className = 'grid-cell section-container';

  var header = document.createElement('div');
  header.className = 'grid-cell-header';

  var title = document.createElement('span');
  title.className = 'grid-cell-title';
  title.textContent = deviceKey;

  var localCollapseToggle = document.createElement('button');
  localCollapseToggle.type = 'button';
  localCollapseToggle.className = 'log-toolbar-toggle grid-cell-toggle';
  localCollapseToggle.title = 'Collapse repeated entries for ' + deviceKey;
  localCollapseToggle.setAttribute('aria-pressed', String(globalCollapse));
  localCollapseToggle.innerHTML = '<span class="material-symbols-outlined">unfold_less</span>';

  header.appendChild(title);
  header.appendChild(localCollapseToggle);

  var streamEl = document.createElement('div');
  streamEl.className = 'log-stream grid-cell-stream';

  cell.appendChild(header);
  cell.appendChild(streamEl);
  document.getElementById('logs-grid').appendChild(cell);

  var stream = createLogStream(streamEl, {autoScroll: globalAutoScroll, collapse: globalCollapse, rawMode: globalRawMode});

  localCollapseToggle.addEventListener('click', function() {
    var next = localCollapseToggle.getAttribute('aria-pressed') !== 'true';
    localCollapseToggle.setAttribute('aria-pressed', String(next));
    stream.setCollapse(next);
  });

  deviceCells[deviceKey] = {stream: stream, cell: cell, localCollapseToggle: localCollapseToggle};
  ensureDeviceFilterOption(deviceKey);
  applyDeviceFilterToCell(deviceKey);
  return deviceCells[deviceKey];
}

function applyDeviceFilterToCell(deviceKey) {
  var entry = deviceCells[deviceKey];
  if (!entry) return;
  var visible = deviceFilterState[deviceKey] !== false;
  entry.cell.classList.toggle('log-entry-hidden', !visible);
}

function applyDeviceFilterToAllCells() {
  Object.keys(deviceCells).forEach(applyDeviceFilterToCell);
}

function ensureDeviceFilterOption(deviceKey) {
  if (deviceFilterState.hasOwnProperty(deviceKey)) return;
  deviceFilterState[deviceKey] = true;

  document.getElementById('log-filter-divider').hidden = false;

  var label = document.createElement('label');
  label.className = 'log-filter-option';

  var input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = true;
  input.addEventListener('change', function() {
    deviceFilterState[deviceKey] = input.checked;
    syncAllFilterCheckbox();
    applyDeviceFilterToAllCells();
  });

  var span = document.createElement('span');
  span.textContent = deviceKey;

  label.appendChild(input);
  label.appendChild(span);
  document.getElementById('log-filter-devices').appendChild(label);
}

function syncAllFilterCheckbox() {
  var keys = Object.keys(deviceFilterState);
  var allChecked = keys.every((key) => deviceFilterState[key]);
  document.getElementById('log-filter-all').checked = allChecked;
}

function handleIncomingMessage(djangoData) {
  // Only per-device telemetry belongs in the device grid - acks, script lists, etc. don't.
  // Commands sent by this ground station are routed to commandsSentStream instead, see below.
  if (!djangoData || djangoData['type'] !== 102) return;
  if (!djangoData.hasOwnProperty('device') || !djangoData.hasOwnProperty('id')) return;

  var deviceKey = `${djangoData['device'].toUpperCase()}-${djangoData['id']}`;
  var entry = ensureDeviceCell(deviceKey);
  entry.stream.addTelemetryEntry(djangoData, undefined, undefined);
}

function isSentCommand(data) {
  // Sent commands (see main.js sendCommand) are the only broadcast messages carrying button_type
  return !!data && data.hasOwnProperty('button_type');
}

if (typeof BroadcastChannel !== 'undefined') {
  var gsLogsChannel = new BroadcastChannel('gs-logs-stream');
  gsLogsChannel.onmessage = function(event) {
    if (isSentCommand(event.data)) {
      commandsSentStream.addCommandSentEntry(event.data);
    } else {
      handleIncomingMessage(event.data);
    }
  };
} else {
  console.error('BroadcastChannel not supported in this browser - this window cannot receive live data.');
}

// Toolbar
//-------------------
document.getElementById('log-autoscroll-toggle').addEventListener('click', function() {
  globalAutoScroll = this.getAttribute('aria-pressed') !== 'true';
  this.setAttribute('aria-pressed', String(globalAutoScroll));
  commandsSentStream.setAutoScroll(globalAutoScroll);
  Object.values(deviceCells).forEach((entry) => entry.stream.setAutoScroll(globalAutoScroll));
});

document.getElementById('log-collapse-toggle').addEventListener('click', function() {
  globalCollapse = this.getAttribute('aria-pressed') !== 'true';
  this.setAttribute('aria-pressed', String(globalCollapse));
  Object.values(deviceCells).forEach((entry) => {
    entry.stream.setCollapse(globalCollapse);
    entry.localCollapseToggle.setAttribute('aria-pressed', String(globalCollapse));
  });
});

document.getElementById('log-raw-toggle').addEventListener('click', function() {
  globalRawMode = this.getAttribute('aria-pressed') !== 'true';
  this.setAttribute('aria-pressed', String(globalRawMode));
  commandsSentStream.setRawMode(globalRawMode);
  Object.values(deviceCells).forEach((entry) => entry.stream.setRawMode(globalRawMode));
});

document.getElementById('log-filter-toggle').addEventListener('click', function(e) {
  e.stopPropagation();
  logFilterMenuOpen = !logFilterMenuOpen;
  document.getElementById('log-filter-menu').hidden = !logFilterMenuOpen;
  this.setAttribute('aria-expanded', logFilterMenuOpen);
});

document.getElementById('log-filter-menu').addEventListener('click', function(e) {
  e.stopPropagation();
});

document.addEventListener('click', function() {
  if (!logFilterMenuOpen) return;
  logFilterMenuOpen = false;
  document.getElementById('log-filter-menu').hidden = true;
  document.getElementById('log-filter-toggle').setAttribute('aria-expanded', false);
});

document.getElementById('log-filter-all').addEventListener('change', function(e) {
  var checked = e.target.checked;
  Object.keys(deviceFilterState).forEach((key) => deviceFilterState[key] = checked);
  document.querySelectorAll('#log-filter-devices input[type="checkbox"]').forEach((input) => input.checked = checked);
  applyDeviceFilterToAllCells();
});
