// The IP+Port of the server is imported from config.ini. Django passes it as parameter to index.html, when it's rendered.
// The IP+Port format is http://ip:port/
// Striping the IP and Port:
const serverIpPort = serverAddress.split(/http:\/\//)[1].split(':');
const serverIp = serverIpPort[0];
const serverPort = serverIpPort[1].slice(0, -1);

// Starting websocket connections
var observableSocket = new WebSocket(`ws://${serverIp}:${serverPort}/ws/connection/`);
var sendCommandSocket = new WebSocket(`ws://${serverIp}:${serverPort}/ws/receive/`);
var receivePostSocket = new WebSocket(`ws://${serverIp}:${serverPort}/ws/update-info/`);
var updateSocket = new WebSocket(`ws://${serverIp}:${serverPort}/ws/update-periodically/`);

// Every parsed message gets forwarded here so the standalone logs grid window (opened from the
// log toolbar) can render the same data without needing its own websocket connection
var gsLogsChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('gs-logs-stream') : null;

// List of active devices that'll show at 'select' field
var activeDevicesId = []

// Renders the combined log stream (log-stream.js) - owns auto-scroll, collapse-repeats state,
// and (while collapsed) pins each device to a fixed rank so it stops fighting other devices
// for the last position in the stream just because messages arrive interleaved
var mainLogStream = createLogStream(document.getElementById('actions-logs'), {autoScroll: true, collapse: true});

// Filter state: maps a device key (e.g. "UAV-11") to whether its log entries should be shown
var deviceFilterState = {};
var logFilterMenuOpen = false;

if(receivePostSocket.readyState === WebSocket.CONNECTING){
  document.querySelector('#ip-connected').innerText = "Background: Connecting";
}

// Set the interface status to connected, if POST socket is Open
receivePostSocket.addEventListener('open', function (event) {
  document.querySelector('#ip-connected').innerText = "Background: Online";
});


function sendCommand(cmdNumber, buttonType=ButtonType.DEFAULT, data={}) {
  // Send the selected command to a set of devices, obtained from getDeviceReceive()
  //
  // Format of command-json that will be sent:
  // id - (int) id of the groundstation
  // cmdNumber - (CommandType) integer that represent what this command will do
  // buttonType - (ButtonType) default, checkbox or upload
  // receiver - (int) ID of the active device on the 'select-device list'
  //            note if the command will be sent to all devices, the ID will be 'all'
  var commandObject = {id: 1, type: cmdNumber, button_type: buttonType, data: data};
  commandObject["receiver"] = getDeviceReceiver();

  var jsonToSend = JSON.stringify(commandObject);
  console.log(jsonToSend);

  // Send the command to the Consumers.
  // The PostConsumer will receive the command and handle it
  if (receivePostSocket.readyState == WebSocket.OPEN) {
    receivePostSocket.send(jsonToSend);
    mainLogStream.addCommandSentEntry(commandObject);
    // Forward to the standalone Log Mosaic window's "Commands sent" section, if it's open
    if (gsLogsChannel) gsLogsChannel.postMessage(commandObject);
  }

  // The ReceiveCommandConsumer will receive the command and handle it
  // Note this is the Serial Consumer, in charge to stablish and change messages with serial connected device
  if (sendCommandSocket.readyState == WebSocket.OPEN) {
    //sendCommandSocket.send(jsonToSend);
    //notifyUiWhenJsonSent(jsonToSend);
  }
}



function getMatchingIndex(id) {
  //Return the index of the matching ID, in the list of active devices OR return -1 if not found
  var matchingId = -1;

  [...document.getElementById('select-device').children].forEach((option, index) => {
    if(option.value == id) matchingId = index;
  });

  return matchingId
}


function getDeviceReceiver() {
  // Return the device ID selected at 'select' field
  selectElement = document.getElementById('select-device');
  selectedDeviceId = selectElement.value;

  return selectedDeviceId;
}

function verifyActiveDevices(id) {
  // Search the list of active devices and
  // return true if found matching ID
  // return false if not found matching ID
  let match = false;
  activeDevicesId.forEach((deviceId) => {
    if(deviceId == id) match = true;
  });
  return match;
}

function pushNewCommandOption(id, deviceType) {
  // Insert in the 'select' field a new device option
  var selectElement = document.getElementById('select-device');
  var opt = new Option(`${deviceType.toUpperCase()} ${id}`, id);
  selectElement.add(opt);
}

function removeCommandOption(id) {
  // Remove from the 'select' field a device with matching id
  var selectElement = document.getElementById('select-device');
  const matchingId = getMatchingIndex(id);

  if(matchingId != -1) {
    selectElement.remove(matchingId);
    activeDevicesId = activeDevicesId.filter(deviceId => id !== deviceId);
  }
}

function ensureDeviceFilterOption(deviceKey) {
  // Register a device in the log filter toolbar the first time it's seen.
  // Subsequent calls for an already-known device are a no-op.
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
    applyDeviceFilterToAllEntries();
  });

  var span = document.createElement('span');
  span.textContent = deviceKey;

  label.appendChild(input);
  label.appendChild(span);
  document.getElementById('log-filter-devices').appendChild(label);
}

function syncAllFilterCheckbox() {
  // Keeps the "All devices" checkbox checked only while every known device is checked
  var keys = Object.keys(deviceFilterState);
  var allChecked = keys.every((key) => deviceFilterState[key]);
  document.getElementById('log-filter-all').checked = allChecked;
}

function applyDeviceFilterToEntry(p) {
  // System/command entries have no device key and are always shown
  var deviceKey = p.dataset.logDevice;
  if (!deviceKey) return;

  var visible = deviceFilterState[deviceKey] !== false;
  p.classList.toggle('log-entry-hidden', !visible);
}

function applyDeviceFilterToAllEntries() {
  document.querySelectorAll('#actions-logs [data-log-device]').forEach(applyDeviceFilterToEntry);
}

function resolveDeviceKey(djangoData) {
  // Registers the device with the filter toolbar (if new) and returns its display key
  if (!djangoData || !djangoData.hasOwnProperty('device') || !djangoData.hasOwnProperty('id')) return undefined;
  var deviceKey = `${djangoData['device'].toUpperCase()}-${djangoData['id']}`;
  ensureDeviceFilterOption(deviceKey);
  return deviceKey;
}

function notifyUiWhenJsonSent(text) {
  mainLogStream.addSentEntry(text);
}

function notifyUiWhenJsonReceived(jsonReceived, msg="", djangoData=null) {
  var deviceKey = resolveDeviceKey(djangoData);
  // Matches exactly what this used to render pre-styling - see log.css .log-stream--raw and
  // the rawText handling in log-stream.js.
  var rawText = msg + jsonReceived;
  var p;

  if (djangoData && djangoData['type'] === 102) {
    p = mainLogStream.addTelemetryEntry(djangoData, deviceKey, msg, rawText);
  } else {
    var payloadText = djangoData ? formatPayloadForDisplay(djangoData) : jsonReceived;
    p = mainLogStream.addGenericEntry(deviceKey, deviceKey ? undefined : msg, payloadText, rawText);
  }

  applyDeviceFilterToEntry(p);
  return p;
}

function checkJsonType(msg) {
  // The main logic to handle received messages
  // A message will try to be parsed to JSON format, and it's 'type' will contain what the message represents
  // The type 102 represents a location update message, and it'll be reflected on Google Maps.
  // All messages are shown on interface visual log
  try {
    var djangoData = JSON.parse(msg.data);
    console.log(djangoData);
    if (gsLogsChannel) gsLogsChannel.postMessage(djangoData);
    json_type = djangoData['type'];

    msgDefault = 'JSON unknown: ';
    msgDrone = djangoData.hasOwnProperty('device') ? `${djangoData['device'].toUpperCase()}-${djangoData['id']} info: ` : msgDefault;

    switch(json_type) {
      case 102: // Device information received
        var id = djangoData['id'];
        var lat = parseFloat(djangoData['lat']);
        var lng = parseFloat(djangoData['lng']);
        var status = djangoData.hasOwnProperty('status') ? djangoData['status'] : 'active';
        var deviceType = djangoData.hasOwnProperty('device') ? djangoData['device'] : 'teste';

        // Add device as a new option in Select list, if not already included
        if(!verifyActiveDevices(id)){
          if(status != 'inactive') {
            activeDevicesId.push(id);
            pushNewCommandOption(id, deviceType);
          }
        }
        else {
          //Retira device se está nas opções e está inativo
          if(status == 'inactive') {
            removeCommandOption(id);
          }
        }

        notifyUiWhenJsonReceived(msg.data, msgDrone, djangoData);
        // Insert/Update the marker on Google Maps, with it's location
        try {
          gmap.newMarker(id, lat, lng, status, deviceType);
        } catch(e) {
          console.error("Error connecting to google maps")
        }
        break;
      case 42: // List of scripts received
        var scriptsList = djangoData['scripts'];
        var selectScriptElement = document.querySelector('.select-script');

        // Clear all previous options
        selectScriptElement.innerHTML = '<option value="" disabled selected>Select a script</option>';

        // Insert new options
        scriptsList.forEach((scriptName) => {
          var opt = new Option(scriptName, scriptName);
          selectScriptElement.add(opt);
        });

        notifyUiWhenJsonReceived(msg.data, msgDrone, djangoData);
        break;
      // The default behavior to other types not included above
      default:
        msgDefault = djangoData.hasOwnProperty('device') ? msgDrone : msgDefault;
        notifyUiWhenJsonReceived(msg.data, msgDefault, djangoData);
        break;
    }
  } catch(e) {
    // If it's not a JSON, it'll show the message on interface visual log
    notifyUiWhenJsonReceived(msg.data);
  }
}

// Log toolbar
//-------------------
document.getElementById('log-autoscroll-toggle').addEventListener('click', function() {
  var next = this.getAttribute('aria-pressed') !== 'true';
  this.setAttribute('aria-pressed', String(next));
  mainLogStream.setAutoScroll(next);
});

document.getElementById('log-collapse-toggle').addEventListener('click', function() {
  var next = this.getAttribute('aria-pressed') !== 'true';
  this.setAttribute('aria-pressed', String(next));
  mainLogStream.setCollapse(next);
});

document.getElementById('log-raw-toggle').addEventListener('click', function() {
  var next = this.getAttribute('aria-pressed') !== 'true';
  this.setAttribute('aria-pressed', String(next));
  mainLogStream.setRawMode(next);
});

document.getElementById('log-grid-window-toggle').addEventListener('click', function() {
  window.open('/logs-grid/', 'gs-logs-grid', 'width=1400,height=900,resizable=yes,scrollbars=yes');
});

document.getElementById('log-filter-toggle').addEventListener('click', function(e) {
  e.stopPropagation();
  logFilterMenuOpen = !logFilterMenuOpen;
  document.getElementById('log-filter-menu').hidden = !logFilterMenuOpen;
  document.getElementById('log-filter-toggle').setAttribute('aria-expanded', logFilterMenuOpen);
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
  applyDeviceFilterToAllEntries();
});

function checkLand(checkbox) {
  if(checkbox.checked) {
    sendCommand(CommandType.LAND, ButtonType.CHECKBOX);
  }
  else {
    sendCommand(CommandType.LAND_STOP, ButtonType.CHECKBOX);
  }
}

function checkRtl(checkbox) {
  if(checkbox.checked) {
    sendCommand(CommandType.RTL, ButtonType.CHECKBOX);
  }
  else {
    sendCommand(CommandType.RTL_STOP, ButtonType.CHECKBOX);
  }
}

receivePostSocket.onmessage = function(msg) {
  checkJsonType(msg);
}

observableSocket.onmessage = function(msg) {
  checkJsonType(msg);
}

updateSocket.onmessage = function(msg) {
  checkJsonType(msg);
}


//On close functions
//-------------------
observableSocket.onclose = function(e) {
  console.error('Connection socket closed unexpectedly');
};

sendCommandSocket.onclose = function(e) {
  console.error('Send command socket closed unexpectedly');
};

receivePostSocket.onclose = function(e) {
  document.querySelector('#ip-connected').innerText = "";
  document.querySelector('#ip-disconnected').innerText = 'Background: Offline';
  console.error('Receive POST socket closed unexpectedly');
}

updateSocket.onclose = function(e) {
  console.error('Update socket closed unexpectedly');
}


// Onclick functions
//-------------------
// See CommandType (log-stream.js) for what each command number maps to.
document.querySelector('#position-gps').onclick = function(e) {
  sendCommand(CommandType.GPS_POSITION);
};

document.querySelector('#position-ned').onclick = function(e) {
  sendCommand(CommandType.NED_POSITION);
};

document.querySelector('#arm').onclick = function(e) {
  sendCommand(CommandType.ARM);
}

document.querySelector('#takeoff').onclick = function(e) {
  sendCommand(CommandType.TAKEOFF);
};


var form = document.querySelector("form");
form.addEventListener('submit', (e) => {
  // Logic for submit button, to upload a file
  // It will make a post request to the form 'action' address
  let fileInput = document.getElementById('upload');

  let file = fileInput.files[0]
  if (file) {
    const reader = new FileReader();

    reader.onload = function(event) {
        // event.target.result contém: "data:text/x-python;base64,YmFzZTY0..."
        const fullDataUrl = event.target.result;

        // Remove o prefixo para obter apenas o conteúdo Base64 puro
        const base64Content = fullDataUrl.split(',')[1];

        // Monta o objeto final
        const fileData = {
          "filename": file.name,
          "content": base64Content,
          "type": "text/plain"
        };

        sendCommand(CommandType.UPLOAD_SCRIPT, ButtonType.UPLOAD, fileData);
      }

      reader.readAsDataURL(fileInput.files[0])
      notifyUiWhenJsonSent("File uploaded sent!")
  } else {
      notifyUiWhenJsonSent("No file was uploaded!")
  }
  e.preventDefault();
});

var inputBtn = document.getElementById("upload");
inputBtn.addEventListener('input', () => {
  // Logic for the file submission button condition
  // When the file button changes its state, it will be chekced the submit button condition
  // If there is a file, the submite button is enabled. Otherwise, it'll be disabled
  let submitBtn = document.getElementById("submit-file");
  let submitLabel = document.getElementById("submit-label");
  let inputIcon = document.getElementById("input-icon");
  let primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color');
  let darkGrayColor = getComputedStyle(document.documentElement).getPropertyValue('--dark-gray-color');

  if(inputBtn.files.length != 0) {
    submitBtn.disabled = false;
    submitLabel.className = "custom-submit-file";
    inputIcon.style.color = primaryColor;
  }
  else {
    submitBtn.disabled = true;
    submitLabel.className = "custom-submit-file-disabled";
    inputIcon.style.color = darkGrayColor;
  }
});

document.querySelector('#refresh-file-list').onclick = function(e) {
  sendCommand(CommandType.LIST_SCRIPTS);
}

const script_select = document.querySelector(".select-script")

document.querySelector('#execute').onclick = function(e) {
  sendCommand(CommandType.EXECUTE_SCRIPT, ButtonType.DEFAULT, {script_name: script_select.value});
}
