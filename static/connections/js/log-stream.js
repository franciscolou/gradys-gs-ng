// Shared log entry rendering + per-device "collapse repeated telemetry" logic.
// Used by both the main ground station UI (main.js) and the standalone per-device
// logs grid window (logs-grid.js), so both views stay visually and behaviorally consistent.

// Numeric 'type' codes exchanged with the devices, mirroring connections/command_types.py CommandType
const CommandType = Object.freeze({
  SERIAL_HANDSHAKE: 13,
  SERIAL_CONNECTED: 14,
  GPS_POSITION: 20,
  NED_POSITION: 22,
  ARM: 24,
  TAKEOFF: 26,
  LAND: 28,
  LAND_STOP: 29,
  RTL: 30,
  RTL_STOP: 31,
  LIST_SCRIPTS: 42,
  UPLOAD_SCRIPT: 44,
  EXECUTE_SCRIPT: 46,
  SCRIPT_ARGS: 48,
  ACK_ERROR: 101,
  POSITION_INFO: 102,
  ACK_SUCCESS: 103,
});

// The 'button_type' a sent command can carry - controls how PostConsumer.send_via_http handles it
// (see connections/consumers_wrapper/post_consumers.py): 'default' is a single POST, 'checkbox'
// starts/stops a repeating send loop, 'upload' sends 'data' as multipart form data.
const ButtonType = Object.freeze({
  DEFAULT: 'default',
  CHECKBOX: 'checkbox',
  UPLOAD: 'upload',
});

const COMMAND_TYPE_LABELS = {
  [CommandType.SERIAL_HANDSHAKE]: 'Serial Handshake',
  [CommandType.SERIAL_CONNECTED]: 'Serial Connected',
  [CommandType.GPS_POSITION]: 'GPS Position',
  [CommandType.NED_POSITION]: 'NED Position',
  [CommandType.ARM]: 'Arm',
  [CommandType.TAKEOFF]: 'Takeoff',
  [CommandType.LAND]: 'Land',
  [CommandType.LAND_STOP]: 'Land Stop',
  [CommandType.RTL]: 'RTL',
  [CommandType.RTL_STOP]: 'RTL Stop',
  [CommandType.LIST_SCRIPTS]: 'List Scripts',
  [CommandType.UPLOAD_SCRIPT]: 'Upload Script',
  [CommandType.EXECUTE_SCRIPT]: 'Execute Script',
  [CommandType.SCRIPT_ARGS]: 'Script Args',
  [CommandType.ACK_ERROR]: 'Ack Error',
  [CommandType.POSITION_INFO]: 'Position Info',
  [CommandType.ACK_SUCCESS]: 'Ack Success',
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

function buildCommandSentFields(commandData) {
  // Turns a sent command (see main.js sendCommand) into labeled fields instead of a raw JSON blob.
  // 'data' is free-form and can hold an unbounded number of keys, so its value is never printed
  // inline - it's only readable through the instant hover tooltip (see .log-field--hoverable in log.css).
  var buttonType = commandData.button_type || ButtonType.DEFAULT;

  return [
    {value: formatCommandType(commandData.type), className: 'log-command-name'},
    {label: 'mode', value: buttonType, className: `log-button-type log-button-type--${buttonType}`},
    {
      label: 'data',
      value: '{…}',
      className: 'log-field--data',
      hoverText: JSON.stringify(commandData.data || {}, null, 2),
    },
    {label: 'gs', value: commandData.id, className: 'log-meta'},
  ];
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

  if (field.hoverText !== undefined) {
    fieldSpan.classList.add('log-field--hoverable');
    fieldSpan.dataset.tooltip = field.hoverText;
  }

  parent.appendChild(fieldSpan);
}

function createLogStream(container, options = {}) {
  // Renders log entries into `container` and owns the "collapse repeated telemetry" behavior
  // for it. Collapsing never deletes data: every message still gets its own entry element:
  // collapsed ones are just hidden (log-entry-collapsed), so toggling is always reversible and
  // retroactive over everything already shown, not just messages that arrive after the toggle.
  //
  // While collapsed, every device keeps a fixed rank (via the CSS `order` property) based on the
  // order devices were first seen, so two devices' visible lines never swap places just because
  // one of them happens to update more often - order stays (segment, rank), never plain arrival
  // time. "segment" is a shared counter that advances on every interruption (see breakRun below),
  // whether it's tied to one specific device or not - so even a device with nothing interrupting
  // it directly still gets bumped into the next segment once anything elsewhere does, instead of
  // silently stretching its current position far past where the rest of the log has already
  // moved on to. An interruption with no single device to attribute it to (a broadcast command, a
  // free-form notice) additionally gets the current segment's last slot, so it renders once,
  // after every device's entries for that segment and before any device's entries for the next -
  // a single shared divider ("everyone's readings before" / the entry / "everyone's readings
  // after") instead of nesting into just one device's slot or detaching from all of them.
  var autoScroll = options.autoScroll !== false;
  var collapse = !!options.collapse;
  var runTracker = {}; // deviceKey -> {signature, lastEntry}
  var deviceRank = {}; // deviceKey -> integer, assigned the first time a device is seen
  var nextRank = 0;
  var segment = 0;
  var SEGMENT_SIZE = 1000; // headroom for devices-per-segment; only the relative order matters

  // Called for every entry that isn't itself a telemetry reading, so a repeated telemetry
  // signature that resumes afterwards starts a fresh collapsed run instead of silently
  // continuing the one that was in progress before this entry showed up. When the entry is
  // tied to a specific device (e.g. a non-telemetry message from that device) only that
  // device's collapsing resets; when it isn't (e.g. a sent command targeting 'all' devices, or
  // a free-form notice), every device's does. Either way the segment always advances (see
  // pinOrder below) - ANY interruption, even one that only concerns a single device, is a
  // synchronization point for every device's ordering, not just the one it happened to concern.
  // Without that, a device with no interruptions of its own could keep silently extending its
  // current run's position far past a point where another device has already moved on, which
  // reads as if it were still "back there" instead of showing what's actually going on right now.
  function breakRun(deviceKey) {
    if (deviceKey) {
      delete runTracker[deviceKey];
    } else {
      runTracker = {};
    }
    segment++;
  }

  function getDeviceRank(deviceKey) {
    if (!deviceRank.hasOwnProperty(deviceKey)) {
      deviceRank[deviceKey] = nextRank++;
    }
    return deviceRank[deviceKey];
  }

  // See the class comment above for what "segment" means. Must be called before breakRun() for
  // the same entry, so a global-break entry itself still gets the outgoing segment's last slot.
  function pinOrder(deviceKey, p) {
    if (!collapse) return;
    p.style.order = deviceKey
      ? String(segment * SEGMENT_SIZE + getDeviceRank(deviceKey))
      : String(segment * SEGMENT_SIZE + SEGMENT_SIZE - 1);
  }

  var deviceKeysByRawId = {}; // raw telemetry 'id' (as seen in a sent command's 'receiver') -> deviceKey

  container.classList.toggle('log-stream--raw', !!options.rawMode);

  function scrollToBottom() {
    container.scrollTop = container.scrollHeight;
  }

  // Every entry that can be shown "structured" (badges/fields) also carries a plain-text
  // .log-view-raw counterpart, matching how logs looked before that styling was added (see
  // log.css .log-stream--raw) - so the raw toggle is just hiding/showing one or the other,
  // never re-rendering.
  function renderEntry({deviceKey, seq, prefixText, fields, payloadText, rawText}) {
    var p = document.createElement('p');
    p.className = 'json-received';

    var styled = document.createElement('span');
    styled.className = 'log-view-styled';

    if (deviceKey) {
      var badge = document.createElement('span');
      badge.className = 'log-device-badge';
      badge.textContent = deviceKey;
      styled.appendChild(badge);
      p.dataset.logDevice = deviceKey;
    } else if (prefixText) {
      styled.appendChild(document.createTextNode(prefixText));
    }

    if (seq !== undefined) {
      var seqBadge = document.createElement('span');
      seqBadge.className = 'log-seq';
      seqBadge.textContent = '#' + seq;
      styled.appendChild(seqBadge);
    }

    if (fields) {
      styled.classList.add('log-entry-structured');
      fields.forEach((field) => appendLogField(styled, field));
    } else if (payloadText !== undefined) {
      styled.appendChild(document.createTextNode(payloadText));
    }

    p.appendChild(styled);

    var raw = document.createElement('span');
    raw.className = 'log-view-raw';
    raw.appendChild(document.createTextNode(rawText !== undefined ? rawText : (prefixText || '') + (payloadText !== undefined ? payloadText : '')));
    p.appendChild(raw);

    container.appendChild(p);
    return p;
  }

  function addSentEntry(text) {
    // Free-form notices (e.g. "File uploaded sent!") - identical in both views, so no dual markup.
    var p = document.createElement('p');
    p.className = 'json-sent';
    p.appendChild(document.createTextNode(text));
    container.appendChild(p);
    pinOrder(undefined, p);
    breakRun();
    if (autoScroll) scrollToBottom();
    return p;
  }

  function addCommandSentEntry(commandData) {
    // Structured counterpart to addTelemetryEntry, for the command this ground station just sent.
    // The badge shows the receiver (target device id, or 'all' for a broadcast) - the sent-side
    // equivalent of the device badge shown on received entries.
    var p = document.createElement('p');
    p.className = 'json-sent';

    var styled = document.createElement('span');
    styled.className = 'log-view-styled log-entry-structured';

    var badge = document.createElement('span');
    badge.className = 'log-receiver-badge';
    badge.textContent = String(commandData.receiver).toUpperCase();
    styled.appendChild(badge);

    buildCommandSentFields(commandData).forEach((field) => appendLogField(styled, field));
    p.appendChild(styled);

    var raw = document.createElement('span');
    raw.className = 'log-view-raw';
    raw.appendChild(document.createTextNode('Command sent: ' + JSON.stringify(commandData)));
    p.appendChild(raw);

    container.appendChild(p);

    // A command aimed at one specific (already-seen) device only breaks that device's run;
    // a broadcast ('all') or an unrecognized receiver has no single device to attribute it to,
    // so it breaks every run in progress instead.
    var targetDeviceKey = deviceKeysByRawId[String(commandData.receiver)];
    if (targetDeviceKey) p.dataset.logDevice = targetDeviceKey;
    pinOrder(targetDeviceKey, p);
    breakRun(targetDeviceKey);

    if (autoScroll) scrollToBottom();
    return p;
  }

  function addTelemetryEntry(djangoData, deviceKey, prefixText, rawText) {
    var fields = buildTelemetryFields(djangoData);
    var signature = buildTelemetrySignature(djangoData);
    var p = renderEntry({
      deviceKey: deviceKey,
      seq: djangoData['seq'],
      prefixText: prefixText,
      fields: fields,
      rawText: rawText !== undefined ? rawText : JSON.stringify(djangoData),
    });
    p.dataset.logSignature = signature;
    deviceKeysByRawId[String(djangoData['id'])] = deviceKey;
    pinOrder(deviceKey, p);

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

  function addGenericEntry(deviceKey, prefixText, payloadText, rawText) {
    var p = renderEntry({
      deviceKey: deviceKey,
      prefixText: prefixText,
      payloadText: payloadText,
      rawText: rawText !== undefined ? rawText : (prefixText || '') + (payloadText !== undefined ? payloadText : ''),
    });

    pinOrder(deviceKey, p);
    breakRun(deviceKey);

    if (autoScroll) scrollToBottom();
    return p;
  }

  function recomputeCollapsedRuns() {
    // Re-derive every run (and every device's rank-based order, and the segment counter) from
    // scratch by replaying the whole container in chronological (DOM) order through the same
    // rules addTelemetryEntry/breakRun apply live - so re-enabling collapse can't "heal" a run
    // split that an interrupting entry already caused live, and a fresh page load (which never
    // calls the live path at all) still ends up in the same state.
    var localTracker = {};
    segment = 0;
    Array.prototype.forEach.call(container.children, (p) => {
      var deviceKey = p.dataset.logDevice;
      var signature = p.dataset.logSignature;

      pinOrder(deviceKey, p);

      if (deviceKey && signature !== undefined) {
        var run = localTracker[deviceKey];
        if (run && run.signature === signature) {
          run.lastEntry.classList.add('log-entry-collapsed');
          run.lastEntry = p;
        } else {
          localTracker[deviceKey] = {signature: signature, lastEntry: p};
        }
        p.classList.remove('log-entry-collapsed');
      } else {
        if (deviceKey) {
          delete localTracker[deviceKey];
        } else {
          localTracker = {};
        }
        segment++;
        p.classList.remove('log-entry-collapsed');
      }
    });
  }

  function expandAllEntries() {
    container.querySelectorAll('.log-entry-collapsed').forEach((p) => p.classList.remove('log-entry-collapsed'));
    Array.prototype.forEach.call(container.children, (p) => { p.style.order = ''; });
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

  function setRawMode(value) {
    container.classList.toggle('log-stream--raw', !!value);
  }

  return {
    addTelemetryEntry,
    addGenericEntry,
    addSentEntry,
    addCommandSentEntry,
    setCollapse,
    setAutoScroll,
    setRawMode,
    scrollToBottom,
  };
}

// Shared hover tooltip for every .log-field--hoverable field (currently just the 'data' field on
// sent commands), one per document. A CSS-only ::after tooltip would get clipped by the grid
// cells' `overflow-y: auto` (see .grid-cell-stream in logs_grid.css) and could run under
// neighbouring cells. Rendering a single position:fixed element on <body> instead escapes that
// clipping and any stacking-context ordering, and lets JS flip/clamp it against the real
// viewport - above the field by default, below if there isn't room, and never past either edge.
(function setupHoverTooltip() {
  var EDGE_MARGIN = 8; // gap kept both from the hovered field and from the viewport edges
  var tooltip = null;

  function getTooltip() {
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'log-hover-tooltip';
      document.body.appendChild(tooltip);
    }
    return tooltip;
  }

  function positionTooltip(el, field) {
    var fieldRect = field.getBoundingClientRect();
    var tipRect = el.getBoundingClientRect(); // visibility:hidden still lays out and is measurable

    var top = fieldRect.top - tipRect.height - EDGE_MARGIN;
    if (top < EDGE_MARGIN) {
      // Not enough room above - flip below, then clamp so a very tall payload still fits on screen
      top = Math.min(fieldRect.bottom + EDGE_MARGIN, window.innerHeight - tipRect.height - EDGE_MARGIN);
      top = Math.max(EDGE_MARGIN, top);
    }

    var left = Math.min(fieldRect.left, window.innerWidth - tipRect.width - EDGE_MARGIN);
    left = Math.max(EDGE_MARGIN, left);

    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
  }

  function showTooltip(field) {
    var el = getTooltip();
    el.textContent = field.dataset.tooltip;
    positionTooltip(el, field);
    el.classList.add('log-hover-tooltip--visible');
  }

  function hideTooltip() {
    if (tooltip) tooltip.classList.remove('log-hover-tooltip--visible');
  }

  document.addEventListener('mouseover', function(e) {
    var field = e.target.closest && e.target.closest('.log-field--hoverable');
    if (field) showTooltip(field);
  });

  document.addEventListener('mouseout', function(e) {
    var field = e.target.closest && e.target.closest('.log-field--hoverable');
    if (field && !field.contains(e.relatedTarget)) hideTooltip();
  });

  // A stream's own scrolling (or a device cell scrolling into/out of collapse) can leave the
  // tooltip pointing at a field position that's no longer accurate - just hide it rather than
  // tracking the field live.
  document.addEventListener('scroll', hideTooltip, true);
})();
