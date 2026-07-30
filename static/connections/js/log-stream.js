// Shared log entry rendering + per-device "collapse repeated telemetry" logic.
// Used by both the main ground station UI (main.js) and the standalone per-device
// logs grid window (logs-grid.js), so both views stay visually and behaviorally consistent.

// Textual de-para for the numeric 'type' field, mirroring connections/command_types.py CommandType
const COMMAND_TYPE_LABELS = {
  13: 'Serial Handshake',
  14: 'Serial Connected',
  20: 'GPS Position',
  22: 'NED Position',
  24: 'Arm',
  26: 'Takeoff',
  28: 'Land',
  29: 'Land Stop',
  30: 'RTL',
  31: 'RTL Stop',
  42: 'List Scripts',
  44: 'Upload Script',
  46: 'Execute Script',
  101: 'Ack Error',
  102: 'Position Info',
  103: 'Ack Success',
};

function formatCommandType(type) {
  return COMMAND_TYPE_LABELS.hasOwnProperty(type) ? COMMAND_TYPE_LABELS[type] : `Unknown (${type})`;
}

function formatPayloadForDisplay(djangoData) {
  // Same de-para used for sent commands, applied to whatever gets shown as raw-ish JSON
  var displayPayload = Object.assign({}, djangoData);
  delete displayPayload.seq;
  if (displayPayload.hasOwnProperty('type')) {
    displayPayload.type = formatCommandType(displayPayload.type);
  }
  return JSON.stringify(displayPayload);
}

function buildTelemetryFields(djangoData) {
  // Turns a device info (type 102) payload into labeled fields instead of a raw JSON dump
  var status = djangoData.hasOwnProperty('status') ? djangoData['status'] : 'active';
  var lat = parseFloat(djangoData['lat']);
  var lng = parseFloat(djangoData['lng']);
  var alt = parseFloat(djangoData['alt']);
  var time = typeof djangoData['time'] === 'string' ? djangoData['time'].split('T')[1]?.split('.')[0] : undefined;

  var fields = [
    {value: status, className: `log-status log-status--${status}`},
    {label: 'lat', value: lat.toFixed(6), className: 'log-coord'},
    {label: 'lng', value: lng.toFixed(6), className: 'log-coord'},
    {label: 'alt', value: alt.toFixed(3) + 'm', className: 'log-coord'},
  ];

  if (djangoData.hasOwnProperty('method')) {
    fields.push({value: djangoData['method'].toUpperCase(), className: 'log-method'});
  }
  if (djangoData.hasOwnProperty('ip')) {
    fields.push({value: djangoData['ip'], className: 'log-meta'});
  }
  if (time) {
    fields.push({value: time, className: 'log-meta'});
  }

  return fields;
}

function buildTelemetrySignature(djangoData) {
  // Two telemetry entries are considered "the same repeated ping" (and can be collapsed) when
  // these fields match. lat/lng/alt/seq/time change every second and are deliberately excluded.
  var status = djangoData.hasOwnProperty('status') ? djangoData['status'] : 'active';
  return [status, djangoData['device'], djangoData['id'], djangoData['ip'], djangoData['method']].join('|');
}

function appendLogField(parent, field) {
  var fieldSpan = document.createElement('span');
  fieldSpan.className = `log-field ${field.className || ''}`;

  if (field.label) {
    var labelSpan = document.createElement('span');
    labelSpan.className = 'log-field-label';
    labelSpan.textContent = field.label;
    fieldSpan.appendChild(labelSpan);
  }

  var valueSpan = document.createElement('span');
  valueSpan.className = 'log-field-value';
  valueSpan.textContent = field.value;
  fieldSpan.appendChild(valueSpan);

  parent.appendChild(fieldSpan);
}

function createLogStream(container, options = {}) {
  // Renders log entries into `container` and owns the "collapse repeated telemetry" behavior
  // for it. Collapsing never deletes data: every message still gets its own entry element:
  // collapsed ones are just hidden (log-entry-collapsed), so toggling is always reversible and
  // retroactive over everything already shown, not just messages that arrive after the toggle.
  //
  // While collapsed, a device's visible entries also get a fixed rank (via the CSS `order`
  // property on the flex container) based on the order devices were first seen - so a device's
  // line always sorts to the same place instead of fighting every other device for the bottom
  // slot just because messages arrive interleaved. This rank is cleared again once uncollapsed,
  // restoring plain chronological order.
  var autoScroll = options.autoScroll !== false;
  var collapse = !!options.collapse;
  var runTracker = {}; // deviceKey -> {signature, lastEntry}
  var deviceRank = {}; // deviceKey -> integer, assigned the first time a device is seen
  var nextRank = 0;
  var PIN_ORDER_BASE = -1000000;

  function getDeviceRank(deviceKey) {
    if (!deviceRank.hasOwnProperty(deviceKey)) {
      deviceRank[deviceKey] = nextRank++;
    }
    return deviceRank[deviceKey];
  }

  function scrollToBottom() {
    container.scrollTop = container.scrollHeight;
  }

  function renderEntry({deviceKey, seq, prefixText, fields, payloadText}) {
    var p = document.createElement('p');
    p.className = 'json-received';

    if (deviceKey) {
      var badge = document.createElement('span');
      badge.className = 'log-device-badge';
      badge.textContent = deviceKey;
      p.appendChild(badge);
      p.dataset.logDevice = deviceKey;
    } else if (prefixText) {
      p.appendChild(document.createTextNode(prefixText));
    }

    if (seq !== undefined) {
      var seqBadge = document.createElement('span');
      seqBadge.className = 'log-seq';
      seqBadge.textContent = '#' + seq;
      p.appendChild(seqBadge);
    }

    if (fields) {
      p.classList.add('log-entry-structured');
      fields.forEach((field) => appendLogField(p, field));
    } else if (payloadText !== undefined) {
      p.appendChild(document.createTextNode(payloadText));
    }

    container.appendChild(p);
    return p;
  }

  function addSentEntry(text) {
    var p = document.createElement('p');
    p.className = 'json-sent';
    p.appendChild(document.createTextNode(text));
    container.appendChild(p);
    if (autoScroll) scrollToBottom();
    return p;
  }

  function addTelemetryEntry(djangoData, deviceKey, prefixText) {
    var fields = buildTelemetryFields(djangoData);
    var signature = buildTelemetrySignature(djangoData);
    var p = renderEntry({deviceKey: deviceKey, seq: djangoData['seq'], prefixText: prefixText, fields: fields});
    p.dataset.logSignature = signature;

    // Rank is tracked from the first message ever seen for this device, regardless of whether
    // collapse is on right now, so toggling collapse on later still pins devices in arrival order
    var rank = getDeviceRank(deviceKey);
    if (collapse) {
      p.style.order = String(PIN_ORDER_BASE + rank);
    }

    var run = runTracker[deviceKey];
    if (run && run.signature === signature) {
      if (collapse) run.lastEntry.classList.add('log-entry-collapsed');
      run.lastEntry = p;
    } else {
      runTracker[deviceKey] = {signature: signature, lastEntry: p};
    }

    if (autoScroll) scrollToBottom();
    return p;
  }

  function addGenericEntry(deviceKey, prefixText, payloadText) {
    var p = renderEntry({deviceKey: deviceKey, prefixText: prefixText, payloadText: payloadText});
    if (autoScroll) scrollToBottom();
    return p;
  }

  function recomputeCollapsedRuns() {
    // Re-derive every run from scratch, per device, in chronological (DOM) order. Scanning in
    // DOM order also means the first key added to `byDevice` for each device is that device's
    // earliest entry, so deriving ranks here (via getDeviceRank) backfills first-seen order
    // correctly even if collapse is being turned on for the very first time.
    var byDevice = {};
    container.querySelectorAll('p[data-log-device][data-log-signature]').forEach((p) => {
      var key = p.dataset.logDevice;
      (byDevice[key] = byDevice[key] || []).push(p);
    });

    Object.keys(byDevice).forEach((deviceKey) => {
      var entries = byDevice[deviceKey];
      var rank = getDeviceRank(deviceKey);
      var pinnedOrder = String(PIN_ORDER_BASE + rank);

      var runStart = 0;
      for (var i = 1; i <= entries.length; i++) {
        var sameAsPrev = i < entries.length && entries[i].dataset.logSignature === entries[runStart].dataset.logSignature;
        if (!sameAsPrev) {
          for (var j = runStart; j < i - 1; j++) entries[j].classList.add('log-entry-collapsed');
          entries[i - 1].classList.remove('log-entry-collapsed');
          runStart = i;
        }
      }

      entries.forEach((p) => { p.style.order = pinnedOrder; });
    });
  }

  function expandAllEntries() {
    container.querySelectorAll('.log-entry-collapsed').forEach((p) => p.classList.remove('log-entry-collapsed'));
    container.querySelectorAll('p[data-log-device]').forEach((p) => { p.style.order = ''; });
  }

  function setCollapse(value) {
    collapse = value;
    if (collapse) {
      recomputeCollapsedRuns();
    } else {
      expandAllEntries();
    }
  }

  function setAutoScroll(value) {
    autoScroll = value;
    if (autoScroll) scrollToBottom();
  }

  return {
    addTelemetryEntry,
    addGenericEntry,
    addSentEntry,
    setCollapse,
    setAutoScroll,
    scrollToBottom,
  };
}
