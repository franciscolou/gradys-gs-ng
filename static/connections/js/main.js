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

// List of active devices that'll show at 'select' field
var activeDevicesId = []

// Control if the log text autoscroll is available or not
var autoScroll = true;

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


function sendCommand(cmdNumber, buttonType="default", data={}) {
  // Send the selected command to a set of devices, obtained from getDeviceReceive()
  //
  // Format of command-json that will be sent:
  // id - (int) id of the groundstation
  // cmdNumber - (int) integer that represent what this command will do (see table of commands)
  // buttonType - (string) default or checkbox
  // receiver - (int) ID of the active device on the 'select-device list'
  //            note if the command will be sent to all devices, the ID will be 'all'
  jsonToSend = {id: 1, type: cmdNumber, button_type: buttonType, data: data}
  jsonToSend["receiver"] = getDeviceReceiver();

  jsonToSend = JSON.stringify(jsonToSend);
  console.log(jsonToSend);
  
  // Send the command to the Consumers.
  // The PostConsumer will receive the command and handle it
  if (receivePostSocket.readyState == WebSocket.OPEN) {
    receivePostSocket.send(jsonToSend);
    notifyUiWhenJsonSent(jsonToSend);
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

function scrollLogToBottom() {
  // Scrolls the log stream to its most recent (bottom) entry
  var elem = document.getElementById('actions-logs');
  elem.scrollTop = elem.scrollHeight;
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

function buildLogOptions(djangoData) {
  // Derives filter/seq metadata from a parsed payload, if present
  var options = {};

  if (djangoData && djangoData.hasOwnProperty('device') && djangoData.hasOwnProperty('id')) {
    options.deviceKey = `${djangoData['device'].toUpperCase()}-${djangoData['id']}`;
    ensureDeviceFilterOption(options.deviceKey);
  }

  if (djangoData && djangoData.hasOwnProperty('seq')) {
    options.payloadObject = djangoData;
  }

  return options;
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

function notifyUiWhenJsonSent(jsonSent, message="Command sent: ") {
  // Insert on interface visual log the command sent.
  var element = document.getElementById('actions-logs');
  var p = document.createElement("p");
  p.appendChild(document.createTextNode(message + jsonSent));
  p.className += "json-sent";

  element.appendChild(p);
  if(autoScroll == true) {
    scrollLogToBottom();
  }
}

function notifyUiWhenJsonReceived(jsonReceived, msg="", options={}) {
  // Insert on interface visual log the message received
  var element = document.getElementById('actions-logs');
  var p = document.createElement("p");
  p.className += "json-received";

  // A device badge already identifies the source, so the old "UAV-11 info: " text
  // prefix would just repeat it - keep the plain text prefix only when there's no device
  if (options.deviceKey) {
    var deviceBadge = document.createElement("span");
    deviceBadge.className = "log-device-badge";
    deviceBadge.textContent = options.deviceKey;
    p.appendChild(deviceBadge);
  } else if (msg) {
    p.appendChild(document.createTextNode(msg));
  }

  // The seq is only useful as a small orientation counter, so it gets its own
  // de-emphasized badge instead of being buried (and duplicated) in the raw JSON
  var seq = options.payloadObject && options.payloadObject.hasOwnProperty('seq') ? options.payloadObject.seq : undefined;
  if (seq !== undefined) {
    var seqBadge = document.createElement("span");
    seqBadge.className = "log-seq";
    seqBadge.textContent = "#" + seq;
    p.appendChild(seqBadge);
  }

  if (options.fields) {
    p.classList.add('log-entry-structured');
    options.fields.forEach((field) => appendLogField(p, field));
  } else {
    var payloadText = jsonReceived;
    if (options.payloadObject && seq !== undefined) {
      var strippedPayload = Object.assign({}, options.payloadObject);
      delete strippedPayload.seq;
      payloadText = JSON.stringify(strippedPayload);
    }
    p.appendChild(document.createTextNode(payloadText));
  }

  if (options.deviceKey) {
    p.dataset.logDevice = options.deviceKey;
  }

  element.appendChild(p);
  applyDeviceFilterToEntry(p);

  if(autoScroll == true) {
    scrollLogToBottom();
  }
}

function checkJsonType(msg) {
  // The main logic to handle received messages
  // A message will try to be parsed to JSON format, and it's 'type' will contain what the message represents
  // The type 102 represents a location update message, and it'll be reflected on Google Maps.
  // All messages are shown on interface visual log
  try {
    var djangoData = JSON.parse(msg.data);
    console.log(djangoData);
    json_type = djangoData['type'];

    msgUi = 'ACK: ';
    msgDefault = 'JSON unknown: ';
    msgDrone = `${djangoData['device'].toUpperCase()}-${djangoData['id']} info: `;

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

        var logOptions = buildLogOptions(djangoData);
        logOptions.fields = buildTelemetryFields(djangoData);
        notifyUiWhenJsonReceived(msg.data, msgDrone, logOptions);
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

        notifyUiWhenJsonReceived(msg.data, msgDrone, buildLogOptions(djangoData));
        break;
      // The default behavior to other types not included above
      default:
        msgDefault = djangoData.hasOwnProperty('device') ? msgDrone : msgDefault;
        notifyUiWhenJsonReceived(msg.data, msgDefault, buildLogOptions(djangoData));
        break;
    }
  } catch(e) {
    // If it's not a JSON, it'll show the message on interface visual log
    notifyUiWhenJsonReceived(msg.data);
  }
}

function checkScroll(checkbox) {
  if(checkbox.checked) {
    autoScroll = true;
  }
  else {
    autoScroll = false;
  }
}

// Log filter toolbar
//-------------------
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
    sendCommand(28, "checkbox");
  }
  else {
    sendCommand(29, "checkbox");
  }
}

function checkRtl(checkbox) {
  if(checkbox.checked) {
    sendCommand(30, "checkbox");
  }
  else {
    sendCommand(31, "checkbox");
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
// Table of commands:
// 20: /telemetry/gps
// 22: /telemetry/ned
// 24: /command/arm
// 26: /command/takeoff
// 28: /command/land
// 30: /command/rtl
// 32: /command/takeoff
document.querySelector('#position-gps').onclick = function(e) {
  sendCommand(20);
};

document.querySelector('#position-ned').onclick = function(e) {
  sendCommand(22);
};

document.querySelector('#arm').onclick = function(e) {
  sendCommand(24);
}

document.querySelector('#takeoff').onclick = function(e) {
  sendCommand(26);
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
        
        sendCommand(44, buttonType="upload", data=fileData);
      }
      
      reader.readAsDataURL(fileInput.files[0])
      notifyUiWhenJsonSent("File uploaded sent!", "")
  } else {
      notifyUiWhenJsonSent("No file was uploaded!", "")
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
  sendCommand(42);
}

const script_select = document.querySelector(".select-script")

document.querySelector('#execute').onclick = function(e) {
  sendCommand(46, "default", {script_name: script_select.value});
}