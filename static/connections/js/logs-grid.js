// Standalone window: shows each known device's telemetry log in its own grid cell.
// This window has no websocket of its own - it receives data the main ground station window
// forwards over a BroadcastChannel, so it only works while that window/tab stays open.

var deviceCells = {}; // deviceKey -> {stream, cell, localCollapseToggle}
var deviceFilterState = {};
var logFilterMenuOpen = false;
var globalCollapse = true;
var globalAutoScroll = true;
var globalRawMode = false;

// Per-device cell sizes set by dragging their resize handle - keyed by device so the mosaic
// layout survives reconnects/reloads instead of resetting to the default size. `weight` is a
// flex-grow value (see below), not a pixel width.
var CELL_SIZE_STORAGE_KEY = 'gs-mosaic-cell-sizes';
var cellSizes = loadCellSizes();

function loadCellSizes() {
  try {
    return JSON.parse(localStorage.getItem(CELL_SIZE_STORAGE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveCellSize(deviceKey, weight, height) {
  cellSizes[deviceKey] = {weight: weight, height: height};
  localStorage.setItem(CELL_SIZE_STORAGE_KEY, JSON.stringify(cellSizes));
}

// Rows are explicit DOM containers (.grid-row, flex-wrap: nowrap) whose membership is decided
// by relayout() below, not by the browser's own wrap heuristics - that's what lets a row of 2
// or 3 devices always fill exactly 100% of the width and lets a 4th device start a fresh row
// instead of cramming in wherever it happens to fit pixel-wise.
//
// Width within a row is a flex-grow ratio, not a pixel value: every cell has flex-basis: 0, so
// the row's full width is always distributed across its cells in proportion to their weight
// (equal weights by default = an even split). This gets two things for free from the browser's
// own flex algorithm: the row always exactly fills its width (no dead space, no JS math), and a
// window resize rescales every cell proportionally with no recompute needed. min-width still
// acts as a hard floor - flex's own min-size resolution reallocates surplus to the other cells
// when one would go below it.
//
// Dragging a cell's handle changes its weight relative to a neighbor in the same row: growing
// takes weight from the cell(s) after it, cascading down their own floor, like dragging a
// divider - and shrinking gives it back the same way. A cell with nothing after it (last in its
// row) instead trades with the cell before it, so its own right edge stays pinned to the row's
// right edge either way. Dragging vertically resizes the whole row's height (shared by every
// cell in it via stretch), not just the dragged cell.
var MIN_CELL_WIDTH = 320; // keep in sync with .grid-row > .grid-cell's min-width
var MIN_CELL_HEIGHT = 160; // keep in sync with .grid-row's default/min height
var MAX_CELLS_PER_ROW = 3;
var DEFAULT_ROW_HEIGHT = 260;

var deviceOrder = []; // creation order of every device key ever seen, for stable row grouping
var lastRowGroups = []; // deviceKey[][] from the previous relayout(), to detect what changed

// Splits `n` cells into as few rows as possible without exceeding `maxPerRow`, balancing the
// count across those rows instead of greedily maxing out early rows and leaving a lonely
// straggler (e.g. 4 cells -> [2, 2], not [3, 1]).
function computeRowSizes(n, maxPerRow) {
  if (n <= 0) return [];
  var rows = Math.ceil(n / maxPerRow);
  var base = Math.floor(n / rows);
  var remainder = n % rows;
  var sizes = [];
  for (var i = 0; i < rows; i++) sizes.push(i < remainder ? base + 1 : base);
  return sizes;
}

// How many cells can actually share a row at min-width before the screen is just too narrow -
// capped at MAX_CELLS_PER_ROW even when more would technically fit, per the target layout.
function effectiveMaxPerRow() {
  var container = document.getElementById('logs-grid');
  var gap = parseFloat(getComputedStyle(container).rowGap) || 0;
  var fitByWidth = Math.floor((container.clientWidth + gap) / (MIN_CELL_WIDTH + gap));
  return Math.max(1, Math.min(MAX_CELLS_PER_ROW, fitByWidth));
}

function rowGroupsEqual(a, b) {
  if (a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) {
    if (a[i].length !== b[i].length) return false;
    for (var j = 0; j < a[i].length; j++) {
      if (a[i][j] !== b[i][j]) return false;
    }
  }
  return true;
}

// Recomputes which devices share a row and reconciles the .grid-row DOM to match. Rows whose
// membership didn't change keep whatever weights/heights are currently set (including any live
// manual resize); rows that are new or changed reset to an even split, preferring each cell's
// last-saved size if there is one (so a plain reload restores a prior manual layout).
function relayout() {
  var grid = document.getElementById('logs-grid');
  var visibleKeys = deviceOrder.filter(function(key) {
    return deviceCells[key] && deviceFilterState[key] !== false;
  });

  // A filtered-out device isn't assigned to any group below, so nothing would otherwise move
  // it out of whatever row it was last in - detach it so it doesn't linger as a stray child.
  deviceOrder.forEach(function(key) {
    if (visibleKeys.indexOf(key) === -1 && deviceCells[key]) deviceCells[key].cell.remove();
  });

  if (!visibleKeys.length) {
    lastRowGroups = [];
    return;
  }

  var sizes = computeRowSizes(visibleKeys.length, effectiveMaxPerRow());
  var groups = [];
  var idx = 0;
  sizes.forEach(function(size) {
    groups.push(visibleKeys.slice(idx, idx + size));
    idx += size;
  });

  var existingRows = Array.prototype.slice.call(grid.querySelectorAll('.grid-row'));
  groups.forEach(function(groupKeys, i) {
    var rowEl = existingRows[i];
    if (!rowEl) {
      rowEl = document.createElement('div');
      rowEl.className = 'grid-row';
      grid.appendChild(rowEl);
    }
    groupKeys.forEach(function(key) { rowEl.appendChild(deviceCells[key].cell); });

    var unchanged = lastRowGroups[i] && rowGroupsEqual([lastRowGroups[i]], [groupKeys]);
    if (!unchanged) initializeRow(rowEl, groupKeys);
  });
  for (var j = groups.length; j < existingRows.length; j++) existingRows[j].remove();

  lastRowGroups = groups;
}

function initializeRow(rowEl, groupKeys) {
  var storedHeight = groupKeys
    .map(function(key) { return cellSizes[key] && cellSizes[key].height; })
    .filter(Boolean)[0];
  var height = storedHeight || DEFAULT_ROW_HEIGHT;
  rowEl.style.height = height + 'px';

  groupKeys.forEach(function(key) {
    var stored = cellSizes[key];
    var weight = (stored && stored.weight) || 1;
    deviceCells[key].cell.style.flexGrow = weight;
    saveCellSize(key, weight, height);
  });
}

if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(relayout).observe(document.getElementById('logs-grid'));
}

function makeCellResizable(cell, deviceKey, handle) {
  var dragging = false;
  var startX, startY, startWidth, startHeight, hardCap, mode;
  var mates, mateStartWidths, mateCapBefore, row;

  function onPointerDown(event) {
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    startWidth = cell.offsetWidth;
    startHeight = cell.offsetHeight;
    row = cell.parentElement;

    var siblings = Array.prototype.slice.call(row.children);
    var ownIndex = siblings.indexOf(cell);
    var afterMates = siblings.slice(ownIndex + 1);
    var beforeMate = ownIndex > 0 ? siblings[ownIndex - 1] : null;

    if (afterMates.length > 0) {
      // Normal case: grow by cascading a shrink into the mates after it, down to their floor.
      mode = 'after';
      mates = afterMates;
      mateStartWidths = mates.map(function(c) { return c.offsetWidth; });
      mateCapBefore = []; // cumulative shrinkable capacity of every nearer mate, per mate index
      var totalShrinkCapacity = 0;
      for (var i = 0; i < mates.length; i++) {
        mateCapBefore.push(totalShrinkCapacity);
        totalShrinkCapacity += mateStartWidths[i] - MIN_CELL_WIDTH;
      }
      hardCap = startWidth + totalShrinkCapacity;
    } else if (beforeMate) {
      // Last in its row: there's nothing after it to grow into, so growth is blocked outright
      // (hardCap = startWidth). Shrinking it instead grows its immediate left neighbor 1:1 -
      // that neighbor has no ceiling, so a single mate is always enough, no cascade needed -
      // which keeps this cell's own right edge pinned to the row's right edge either way.
      mode = 'before';
      mates = [beforeMate];
      mateStartWidths = [beforeMate.offsetWidth];
      hardCap = startWidth;
    } else {
      // Alone in its row - nothing to trade width with (it already fills 100% either way).
      mode = 'solo';
      mates = [];
      hardCap = startWidth;
    }

    cell.classList.add('is-resizing');
    handle.setPointerCapture(event.pointerId);
    document.body.style.userSelect = 'none';
    event.preventDefault();
  }

  function onPointerMove(event) {
    if (!dragging) return;

    var desiredWidth = startWidth + (event.clientX - startX);
    var newWidth = Math.min(hardCap, Math.max(MIN_CELL_WIDTH, desiredWidth));
    var newHeight = Math.max(MIN_CELL_HEIGHT, startHeight + (event.clientY - startY));
    var growth = newWidth - startWidth; // negative while shrinking the dragged cell back down

    if (mode === 'after') {
      // flex-grow always fills the row's full width regardless of individual weights, so the
      // weights here must always sum to the row's original total - not just "however much the
      // cascade decided to take". Growing cascades a shrink into the mates, nearest first, down
      // to their floor; shrinking is the mirror image, but only needs the nearest mate (growing
      // it has no ceiling, so there's never a need to cascade further for that direction).
      mates.forEach(function(mateCell, i) {
        var mateWeight;
        if (growth >= 0) {
          var shrinkable = mateStartWidths[i] - MIN_CELL_WIDTH;
          var shrinkApplied = Math.min(shrinkable, Math.max(0, growth - mateCapBefore[i]));
          mateWeight = mateStartWidths[i] - shrinkApplied;
        } else {
          mateWeight = i === 0 ? mateStartWidths[0] - growth : mateStartWidths[i];
        }
        mateCell.style.flexGrow = mateWeight;
        saveCellSize(mateCell.dataset.deviceKey, mateWeight, newHeight);
      });
    } else if (mode === 'before') {
      var mateCell = mates[0];
      var mateWeight = mateStartWidths[0] - growth; // growth <= 0 here, so this only ever grows
      mateCell.style.flexGrow = mateWeight;
      saveCellSize(mateCell.dataset.deviceKey, mateWeight, newHeight);
    }

    // Vertical resize grows the whole row (every cell in it stretches via align-items), not
    // just the dragged cell - so every cell's saved height needs to track it, even ones the
    // horizontal cascade above didn't touch.
    row.style.height = newHeight + 'px';
    Array.prototype.forEach.call(row.children, function(rowCell) {
      if (rowCell === cell) return;
      var stored = cellSizes[rowCell.dataset.deviceKey];
      saveCellSize(rowCell.dataset.deviceKey, stored ? stored.weight : 1, newHeight);
    });

    cell.style.flexGrow = newWidth;
    saveCellSize(deviceKey, newWidth, newHeight);
  }

  function onPointerUp(event) {
    if (!dragging) return;
    dragging = false;
    cell.classList.remove('is-resizing');
    handle.releasePointerCapture(event.pointerId);
    document.body.style.userSelect = '';
  }

  handle.addEventListener('pointerdown', onPointerDown);
  handle.addEventListener('pointermove', onPointerMove);
  handle.addEventListener('pointerup', onPointerUp);
}

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
  cell.dataset.deviceKey = deviceKey; // lets a row-mate's resize handler save this cell's size

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

  var resizeHandle = document.createElement('div');
  resizeHandle.className = 'grid-cell-resize-handle';

  cell.appendChild(header);
  cell.appendChild(streamEl);
  cell.appendChild(resizeHandle);
  document.getElementById('logs-grid').appendChild(cell); // relayout() below moves it into a row

  makeCellResizable(cell, deviceKey, resizeHandle);

  var stream = createLogStream(streamEl, {autoScroll: globalAutoScroll, collapse: globalCollapse, rawMode: globalRawMode});

  localCollapseToggle.addEventListener('click', function() {
    var next = localCollapseToggle.getAttribute('aria-pressed') !== 'true';
    localCollapseToggle.setAttribute('aria-pressed', String(next));
    stream.setCollapse(next);
  });

  deviceCells[deviceKey] = {stream: stream, cell: cell, localCollapseToggle: localCollapseToggle};
  deviceOrder.push(deviceKey);
  ensureDeviceFilterOption(deviceKey);
  applyDeviceFilterToCell(deviceKey);
  relayout();
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
  relayout(); // hiding/showing a device changes row membership
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
  entry.stream.addTelemetryEntry(djangoData, deviceKey, undefined);
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
