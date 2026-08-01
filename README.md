# Gradys Ground Station
Web application, from Project GrADyS, to monitor, control and display mobile devices networks in field tests

# Introduction
This is a repository for the Ground Station framework, developed for the GrADyS project and future IoT projects. It's an extensible and reusable framework to help visualize the location and activity status of interconnected network nodes, monitor and store the flow of data and send commands to a set of devices with different protocols. According to the project's needs, the framework is extensible, introducing ways to insert new buttons, commands, protocols, and functionalities.

![Main showcase](/readme_images/mainShowcase.gif)

![Main showcase 2](/readme_images/mainShowcaseNew.gif)

# Installation
## Prerequisites
In order to use the components in this repository, you need to have Python 3.0 or higher installed. Also pip, a Python package manager, is recomended to manage and automatically install the required packages of this project. 
To install Python on Windows, [follow these instructions](https://docs.python.org/3/using/windows.html).
After installing Python, pip should be installed by default. You can check if it's already installed and it's version:
```console
C:\> python3 -m pip --version
```
If not installed or need to updgrade, you can get more information [here](https://pip.pypa.io/en/stable/getting-started/).

## Cloning the repository
With Python3 installed, you should be able to clone this repository. [More information on how to clone](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository).

## Creating a virtual environment
In order to keep this framework in a separate environment, with it's own packages and versions, it's recommended to create a virtual environment. On Windows:
```console
Windows
C:\> python3 -m venv C:\path-to-this-cloned-repository/venv
```
On Linux, you can check if virtualenv is already installed, install it, if not already installed, and create the venv:
```console
Linux
gradys-gs$ virtualenv --version
  virtualenv xx.x.x
gradys-gs$ sudo pip3 install virtualenv
gradys-gs$ virtualenv venv
```

This will create a folder called *venv*, inside the project's folder. Now you have to activate the environment to install/use packages only from this venv.
```console
Windows
C:\> C:\path-to-this-cloned-repository\venv\Scripts\activate
```
```console
Linux
gradys-gs$ source venv/bin/activate
```

If you need more information about virtual environments with python, it [can be found here](https://packaging.python.org/guides/installing-using-pip-and-virtual-environments/#creating-a-virtual-environment).

## Installing necessary packages
The list of necessary packages are inside requeriments.txt file, if you are using Windows. It'll be installed automatically, using the Python package manager, pip. You can install, running on Windows console:
```console
Windows
C:\path-to-this-cloned-repository\> pip3 install -r requeriments.txt
```

On Linux, you should run the compatible script file, requeriments_linux.txt:
```console
Linux
gradys-gs$ pip3 install -r requeriments_linux.txt
```

## Secret variables
This project uses Google Maps services, with paid features IFF used above a threshold. To use these functionalities you need to have or create a Google Maps API Key. [Google's guide on how to create an API Key](https://developers.google.com/maps/gmp-get-started).</br>
This project also use Django Framework that has a secret key variable, for security purposes.
You can [generate your Django secret key here](https://djecrety.ir/).
The framework will load automatically these as environment variables. With both private keys created, 
<!--ts-->
  * Create a file named */config/.env* and insert the secret keys:
    * SECRET_KEY='xxxx'
    *Changing xxxx with your Django secret key*
    * GOOGLE_MAPS_API_KEY='xxxx'
    *Changing xxxx with your Google Maps key (Maps javascript API on your Google Cloud API)*
    * You shall maintain the ' ' from the 'xxxx'
<!--te-->

# Usage

## Running the server
Django provides lightweight development Web server, that you can use via manage.py file. By default, the server runs on port 8000 on the IP address 127.0.0.1 and should not be used on production.
You can run with:
```console
Windows
C:\path-to-this-cloned-repository\> python3 manage.py runserver
```
```console
Linux
gradys-gs$ python3 manage.py runserver
```
Or, with diferent IP/PORT, in the example below, Port 8000 on IP address 0.0.0.0. This IP is will listen to all IP adresses the machine supports. So for example, with this server configuration up, you can open the web navigator with localhost:8000 and the inet ip obtainable from ifconfig (linux environment):
```console
C:\path-to-this-cloned-repository\> python3 manage.py runserver 0.0.0.0:8000
```
Remember to insert, inside config.ini file, the correct IP + Port, on [post] category, if changed to a specific IP, when running the command above.

## Connecting to home page
Now you should be able to connect to the home page, acessing, on your browser, the IP/PORT the server is up, on default: localhost:8000.

## Interface overview
The home page is split in three panels: the **map**, the **command panel** (right column) and the **log panel** (bottom).

The handle between the map and the log panel can be dragged to resize both rows. The chosen split is saved in the browser's `localStorage`, so it survives a reload.

### Log toolbar
The log panel has a toolbar with the following toggles:
<!--ts-->
* **Auto-scroll** (`vertical_align_bottom`): keeps the stream pinned to the newest entry. When off, the scroll position stays where the user left it.
* **Collapse repeated entries** (`unfold_less`): groups consecutive messages of the same device into a single line that updates in place, with a counter, instead of flooding the stream with repeated telemetry. While collapsed, each device keeps a fixed position in the stream, so devices don't swap places just because their messages arrive interleaved.
* **Raw content** (`data_object`): switches the formatted entries (labeled `lat`/`lng`/`alt`/status fields) back to the plain JSON text that the back-end sent.
* **Device filter** (`filter_alt`): a dropdown listing every device seen so far, plus an "All devices" checkbox. Unchecking a device hides its entries from the stream. Entries with no device attached (system messages and commands sent) are always shown.
* **Log Mosaic** (`grid_view`): opens the standalone per-device log window described below.
<!--te-->

### Log Mosaic window
The `logs-grid/` URL renders a standalone window where each device gets its own log cell, plus a dedicated section for the commands the ground station sent.

This window has **no websocket of its own**: the main window forwards every parsed message over a [BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel) named `gs-logs-stream`, so the mosaic only receives data while the main ground station window/tab stays open.

Its toolbar mirrors the main log toolbar (auto-scroll, collapse, raw, device filter), applying each toggle to every cell at once. Every cell also has its own collapse toggle and a drag handle to resize it: dragging horizontally redistributes the width between the cells of the same row, dragging vertically resizes the row's height. The sizes are persisted in `localStorage`, so the mosaic layout survives a reload.


# Project Architecture and customization

Gradys-gs's architecture was designed to make it adaptable and customizable to different needs. The functionalities are modularized, helping to customize and insert new elements, such as command buttons and communication protocols with IoT devices. Gradys Ground Station is structured following the classic concept of web development, with Front-end module, responsible for the interface and visualization, and Back-end module, responsible for server-side information processing.

The project's back-end module was built using the Python programming language, together with the use of [Django Framework](https://www.djangoproject.com/), a tool written in Python, for the agile development of a web application. This framework provides an easy-to-configure development server, a simple and extensible URL route mapping, and a highly modular architecture.

The front-end module was built using HyperText Markup Language (HTML) or [Template language](https://docs.djangoproject.com/en/3.2/ref/templates/language/), the Cascade Style styling language Sheets (CSS) and the most popular programming language in use, Javascript.
<br>
The technologies mentioned were chosen due to their wide use and popularity, contributing to a framework with more extensible usability. Python and Javascript programming languages ​​also have a vast set of libraries and packages, reflecting an extensive community.
<br>
Both modules comunicate with each other via WebSocket channels. A socket connection is a dedicated full-duplex channel based in the Transmission Control Protocol (TCP). This project uses [Django Channels](https://channels.readthedocs.io/en/stable/) library to handle WebSockets communication.

![Project Architecture](/readme_images/architecture.png)

As shown in Figure above, external devices can send messages to FlexStation via the Connections sub-module. The information processing is done in the Django Channels submodule, also responsible for passing the information to the interface, through an already established WebSocket connection. Messages exchanged between the frontend and backend modules follow the JSON format. Note that the described path, from the external device to the interface, is also possible in reverse, when a command is activated on the interface.
<br>
The information gate of the ground station to external devices is through Connections submodule, which constains the routes and logic to receive/send information.


## Django

### URL/View

To understand the server-side structure of this project, first it's required a basic understanding of how Django is structured and how it operates.
Building a URL scheme with Django is a simple task, thanks to the URL/View mapping that the python web framework provides.
When a user requests a page from the URL schema, Django does a mapping to the corresponding Python function, that's called *View*.</br>
So, for example, the URL scheme below has a mapping between the **home page** path and **index** view, also between ***/command/*** path (note that 'command' is a simple integer) and **receive_command_test** view.
```python
urlpatterns = [
    path('', index),
    path('<int:command>/', receive_command_test),
]
```
 Inside the main app's folder, *connections*, there is *urls.py* and *views.py* files. The *urls.py* file is responsible for making the association between a URL address and a view. Note that there is another *urls.py* file, inside the *config* folder, that is responsible for the whole project's pathing. So, for example, if there was another app in our project, we could create a prefix path to that specific app. Our main app has the default path, so there's no prefix attached. 
 If you want to add a new URL path, it should be added a new path() item inside the urlpatterns list, in */connections/urls.py*. For example:
```python
urlpatterns = [
    path('', index),
    path('<int:command>/', receive_command_test),
    path('new-path/', new_view)
]
```
Now we want a view to handle the new url path request. A view is a Python function that takes a Web request and returns a Web response. This response can be the HTML contents of a Web page, or a JSON or a redirect, or a 404 error, anything, really. The view itself contains whatever arbitrary logic is necessary to return that response.
```python
def index(request):
  context = {
    'google_maps_key': settings.GOOGLE_MAPS_API_KEY
  }
  return render(request, 'index.html', context=context)
```
The example above is the **index view**, accessed when home page is loaded. It receives a request, creates a context variable, with the google maps key from *.env*, and load the *index.html* template, attached with the context.
We store our views inside */connections/views.py*. If you want to create the new view, it should receive a **request** and **return** something (could be anything). To send additional parameters, you can send via the url, for example, the url localhost:8000/new-path/10/, needs to be declared inside the *connections/urls.py* as integer as:
```python
path('new-path/<int:id>/', new_view)
```
And our view can receive an **id** parameter, as follows:
```python
def new_view(request, id):
  # Function Logic
  return 
```
Now, accessing the default server 127.0.0.1:8000/new-path/5/ is going to call our new_view method, sending the parameter 5.

### Routing/Consumers
Our main app form of communication with templates, or HTMLs, is using **websocket connections**. [Django Channels](https://channels.readthedocs.io/en/stable/) package mediates these connections.
The logic to stablish a websocket connection is similar with the URL/View logic presented on the topic above. The ***connections/routing.py*** file contains the websocket url patterns, or schema:
```python
ws_urlpatterns = [
  path('ws/connection/', ConnectionConsumer.as_asgi()),
  path('ws/receive/', ReceiveCommandConsumer.as_asgi()),
]
```
As said, Django Channels makes a mapping, associating an url with a ***Consumer***. A Consumer is a Python Class that handles a websocket connection.
So, when our Javascript is loaded, it tries to connect with a specific Consumer, accessing a specific URL, inside our ws_urlpatters.
```javascript
// Javascript stablishing new connection
var socket = new WebSocket('ws://localhost:8000/ws/connection/');
```
When this command is read, the ConnectionConsumer class is called and a connection is initated.
Our Consumers are inside ***connections/consumers_wrappers/*** and a new one can be created, inheriting WebsocketConsumer or AsyncWebsocketConsumer, depending on it's functionality. You can substitute three main methods:
<!--ts-->
* **connect**: called when the specific url is accessed and start a dedicated connection with self.accept. This is the only method you NEED to override.
* **receive**: called when a message is sent via socket connection.
* **disconnect**: called when the connection is closed.
<!--te-->

Creating a new Consumer, is simple as creating a new file inside **connections/consumers_wrapper/** with a Class like:
```python
class NewConsumer(AsyncWebsocketConsumer):
  async def connect(self):
    await self.accept()

  async def receive(self, message):
    # Handle the message

  async def disconnect(self, close_code):
    # Handle disconnection

  async def additional_method(self, *args):
    # Additional method's logic
```
To send a message to the other side of connection (Django -> Javascript) it can be done using the ***send*** method, inherted from WebSocket class:
```python
await self.send(data)
```
Creating the new path can be done adding a new path to ws_urlpatters list:
```python
ws_urlpatterns = [
  path('ws/connection/', ConnectionConsumer.as_asgi()),
  path('ws/receive/', ReceiveCommandConsumer.as_asgi()),
  path('ws/new-socket/', NewConsumer.as_asgi()),
]
```
Finnaly, accessing ws://localhost:8000/ws/new-socket/, a dedicated full-duplex connection should be stablished and our two ends can communicate with each other.

## Front-end
Our front-end consists of templates files, CSS styling files and Javascript files.
The home page template file is rendered when the default ip+port is accessed, as showed above. New templates files can be added inside the **/templates/** folder. They work very similarly to HTML files, with some add-ons. 
```html
{% load static %}
<link rel="stylesheet"  href="{% static 'connections/css/connection.css' %}">
```
The code above introduces the '{% %}' tag (that's not HTML native), in this case, to load a css file to the page.
For more information about [templates, you can access here](https://docs.djangoproject.com/en/3.2/topics/templates/).

### Template components
***index.html*** doesn't hold the interface's markup itself: it's only a skeleton that includes the panels, each one living in its own partial inside **/templates/connections/components/**.
```html
<div class="page-container grid-template-area">
  {% include 'connections/components/_map_panel.html' %}
  {% include 'connections/components/_row_resizer.html' %}
  {% include 'connections/components/_command_panel.html' %}
  {% include 'connections/components/_log_panel.html' %}
</div>
```
`_command_panel.html` is itself only a container, including the partial of each group of controls (`_device_selector.html`, `_telemetry_commands.html`, `_flight_commands.html`, `_script_manager.html` and `_connection_status.html`). So, when adding a new control to the interface, it should be added to the partial of the group it belongs to (or to a new partial, included by `_command_panel.html`), not to *index.html*.

### CSS
***connection.css*** is the only stylesheet loaded by *index.html*, and it's just a manifest of `@import`s:
```css
@import url('tokens.css');
@import url('base.css');
@import url('layout.css');
@import url('components/panel.css');
@import url('components/button.css');
...
```
<!--ts-->
* ***tokens.css***: the design tokens (colors, fonts, borders, spacing) as CSS custom properties. Changing the interface's whole color scheme is a matter of changing the variables in this single file. Note that *main.js* reads `--primary-color` and `--dark-gray-color` from here through `getComputedStyle`, so those aliases must be kept in sync.
* ***base.css***: element resets and the shared typography (like the `.section-heading` class).
* ***layout.css***: the home page's grid (map / commands / log), including the responsive rules for narrow screens.
* ***components/***: one file per interface component (`button.css`, `checkbox.css`, `select.css`, `upload.css`, `panel.css`, `row-resizer.css`, `connection-status.css`, `log.css`).
<!--te-->
The Log Mosaic window has its own entry point, ***logs_grid.css***, that imports the same tokens/base/components and adds the mosaic's grid rules.

### Javascript
To load a Javascript file in a template, the logic is the same, as long this Javascript file is inside the folder that ***STATIC_URL variable*** is pointing to. This variable is inside **config/settings.py**. In our case STATIC_URL variable is pointing to /static/ folder.
```python
STATIC_URL = '/static/'
```
Our ***index.html*** home page template loads:
<!--ts-->
* ***gmap.js***: responsible for Google Map's virtual map.
* ***log-stream.js***: shared log rendering, used by both the home page and the Log Mosaic window. It exposes `createLogStream(element, options)`, which returns an object with `addTelemetryEntry`, `addGenericEntry`, `addCommandSentEntry` and `addSentEntry`, and owns the auto-scroll, collapse-repeats and raw-content behaviors. It also holds the ***CommandType*** and ***ButtonType*** constants, mirroring the back-end (see Command Types below).
* ***main.js***: responsible for starting websockets connections with the back-end and the main button's logic. It feeds the log stream and forwards every message to the Log Mosaic window over the `gs-logs-stream` BroadcastChannel.
* ***panel-resizer.js***: drag-to-resize of the map/log split. Self-contained, it doesn't read or write any state the other scripts depend on.
<!--te-->
The ***logs_grid.html*** template loads *log-stream.js*, ***logs-grid.js*** (the per-device cells, their layout and the BroadcastChannel listener) and ***mosaic-resizer.js***.
To start a websocket connection, you have to create a new object, sending an available URL in the routing schema (see Routing/Consumers topic).
```javascript
var socket = new WebSocket('ws://localhost:8000/ws/connection/');
```
This object has methods to interact with the socket connection. Here are the main:
<!--ts-->
* **send**: Transmits data to the server via the WebSocket connection.
```javascript
socket.send(jsonToSend);
```
* **readyState**: The current state of the connection, this is one of the [Ready state constants](https://developer.mozilla.org/pt-BR/docs/Web/API/WebSocket#ready_state_constants). Read-only.
```javascript
if (socket.readyState == WebSocket.OPEN) {
    // Handle connection OPEN
}
```
* **onclose**: An event listener to be called when the readyState of the WebSocket connection changes to CLOSED.
```javascript
socket.onclose = function(e) {
  // Handle connection closed
};
```
* **onmessage**: An event listener to be called when a message is received from the server. Receives a message parameter.
```javascript
socket.onmessage = function(msg) {
  // Handle message received
}
```
<!--te-->

## External Communication
The primary purpose of this framework is to exchange information with other devices. Currently, there are implemented two ways for external connections.

The first way is to plugin an ESP32 microcontroller to the framework's machine. This microcontroller should be able to detect other devices that receive and send information to them. Our framework can establish a UART connection with a plugged ESP32 microcontroller, receive everything sent via serial, and send commands via serial, making the microcontroller responsible for retransmitting the command. In order to accept a connection with an ESP32 microcontroller, it is necessary to insert the correct UART Port and baud rate inside config.ini. The SerialConnection class, from /connections/serial_connector.py, is instantiated when javascript starts a WebSocket connection of this type. The instantiated object keeps trying connection with the UART Port. Once a microcontroller is plugged in, the interface indicates this change, and you can exchange information through the ESP32 microcontroller.

Another way to communicate with our framework is with POST requests. A device, an UAV (drone) per se, wants to send its location to our ground station. This can be achieved with a POST request to the specific ground station URL.

```python
json_tmp = {"id": uav_id, "lat": targetpos.lat, "lng": targetpos.lng, "alt": targetpos.alt, "ip": args.uav_ip + ':' + flask_port}

r = requests.post(path_to_post, data=json_tmp)
```

Note that the device should attach, on the message, it's own IP and PORT, so our framework can send commands back to it. The specific URL, to receive POSTs, is mapped to a view. So, when the device send it's location on body's request, the post_to_socket view receive the request and extracts the information from it's body. We want to send this information to our interface and also to save it in the log file. Who is responsible for both actions is the PostConsumer, inside /connections/consumers_wrapper/post_consumer.py. This way, the post_to_socket view needs to send the message to PostConsumer, getting an instance of this class and calling this Class function receive_post(message).

```python
post_consumer_instance = get_post_consumer_instance()
await post_consumer_instance.receive_post(new_dict)
```

Sending a message to an external device is also done by Consumers. When a command button is activated on the interface, the main.js uses the async method socket.send(), to transmit the command direct to the Consumer (back-end). The message received from the main.js, contains which device or group of devices it should be sent. It also contains the ID of the external devices that will receive the command. The first step is to search on the registered device's list for the address (IP) of the devices.

```python
device_to_send_list = get_device_from_list_by_id(device_receiver_id)
```

There is a list on config.ini mapping the commands code (integer) to a specific endpoint, that should be added to the IP+Port of the external device.

```html
[commands-list]
20 = position_absolute_json,get
22 = position_relative_json,get
24 = auto,get
26 = run_experiment,get
28 = set_auto,get
30 = rtl,get
32 = takeoff_and_hold,get
```

The list contains the endpoint and the HTTP request type, if it is a GET or POST request.

With the address complete, the command will be sent via HTTP request.

```python
command_path_list = config['commands-list'][command].split(',')
endpoint = command_path_list[0]

if command_path_list[1] == 'get':
  #GET request
  task = asyncio.create_task(self.send_get_specific_device(url, id, device['device']))
else:
  # POST request
  task = asyncio.create_task(self.send_post_specific_device(url, json_to_send))
self.async_tasks.append(task)
```

Depending on the type of the request, the command will be sent and an asynchronous task will be created.

## Data persistence
One of the main features of this project is the data persistence of every event that occurred during the experiments. Log files are generated, when starting the application, and filled in as messages are received, errors are caught, commands are sent, and other events that are of importance to the experiment.

To generate the .log files, the logging package, for Python, is used. Inside /connections/utils/logger.py there is a class Logger, responsible for the persistent logic. It's possible to extend and copy this class to other modules, for example, at the uav_simulator/ module that has this class with different logic.

When the server start, a .log file is created, inside the folder specified by the Logger's path variable, and the file's name is composed by the module name followed by the date created. The example above represents a .log file created inside the uav_simulator module at 25/01/2022 08:18:40.

```html
uav_simulator-2022-01-25-08-18-40.log
```

To fill this file, it must be inserted in code calls of the methods from the Logger class, according to it's needs. The example above includes the code from the PostConsumer class, inside the method to handle a external message received.

```python
logger.log_info(source=source, data=data, code_origin='receive-info')
try:
  await self.send(json.dumps(data)) # Send to JS via socket
except Exception:
  logger.log_except()
```

The logger object is global and already instantiated. Two log methods are called, to save the data received and to save the Exception caught when trying to send the message to the front-end via socket.

The .log file format is specified inside the Logger class, using the syntax accepted by the Formatting class, form logging package. For more information on how to format the .log file, https://docs.python.org/3/library/logging.html#logging.Formatter.

```html
2021-12-12 20:58:32,706; uav-21; receive-info; {'id': 21, 'type': 102, 'seq': 30, 'lat': -15.840081, 'lng': -47.926642, 'alt': -0.03, 'device': 'uav', 'ip': 'http://127.0.0.1:5071/', 'method': 'post', 'time': '2021-12-12T20:58:32.706792', 'status': 'active'}

2022-01-25 20:58:50,365; gs; send-get; http://127.0.0.1:5071/rtl
```

The example above has two messages, formatted with the date of the event, who triggered the event, where it was triggered and the message itself.

## Sequence Diagram
The sequence message diagram below represents the messages flow between external devices and the main modules from this framework.

![Project Architecture](/readme_images/sequenceDiagram.png)

Note that the message protocol between the framework and external devices can differ from project to project, changing the way the information is delivered or the commands are handled. But, the messages flow between the back-end and front-end modules should remain similar to this diagram.
</br>
Important things to notice are:
<!--ts-->
* When a device send information to the framework, the back-end will **register** this device, if not already on the persistant list, log the information and forward to front-end, to update the interface.

* There is a Consumer in charge to keep the persistant device list, with the registred devices, inside ***/connections/consumers_wrapper/update_periodically.py***. In this Consumer, there is a task to update the activity status of the devices on the list, every X seconds, specified at *config.ini*. This is represented on the third group of messages flow in the diagram above.

* There is the possibility to create checkbox buttons, that will trigger a constant task, while the checkbox is pressed. This is represented on the fourth group of messages flow in the sequence diagram.
<!--te-->


## Command Buttons
Another important functionality in this framework is the possibility to send commands, through the interface, to available devices.
We can register a new button inside the template, create a onClick callback function and send the command via websocket to Django (back-end).
<!--ts-->
* Create new button in the component partial of the group it belongs to, inside ***/templates/connections/components/*** (for example, ***_flight_commands.html*** for a flight command). *index.html* only includes these partials, so nothing needs to be changed there.
```html
<input class="button" id="new-button" type="button" value="New Command">
```

* Register an onclick function, in ***/static/connections/js/main.js***
```javascript
var newCommandNumber = 40

document.querySelector('#new-button').onclick = function(e) {
  sendCommand(newCommandNumber);
};
```
* Send to the back-end, when button is clicked
```javascript
function sendCommand(type) {
  jsonToSend = {id: 1, type: type}
  // ...
  if (socket.readyState == WebSocket.OPEN) {
    socket.send(jsonToSend);
  }
}
```
<!--te-->
Notice that the socket object must be instatiated already, and the connection 'OPEN'.
The corresponding Consumer will receive the message and handle, acording to it's command type.

A button can contain a different type, as checkbox. This button will have a different logic then a regular button. A specific thread will handle the command, repeating until the checkbox is unmarked. Marking a checkbox will result on the creation of a thread, unmarking it will cancel this thread. In order to create a checkbox button, you need to change the type to type="checkbox", on the component partial, and pass the argument `ButtonType.CHECKBOX` when creating a event handler on main.js: sendCommand(CommandType.RTL, ButtonType.CHECKBOX);

The button type will be insert inside the JSON message, sent by main.js to the corresponding Consumer. So the Consumer will know this is not a regular command, and will create or cancel a thread.

### Command Types
The numeric `type` codes exchanged between the ground station, the devices and the serial link are declared as an `IntEnum` in ***/connections/command_types.py***, so the back-end doesn't spread magic numbers around:
```python
class CommandType(IntEnum):
  SERIAL_HANDSHAKE = 13
  ...
  GPS_POSITION = 20
  NED_POSITION = 22
  ARM = 24
  ...
  ACK_ERROR = 101
  POSITION_INFO = 102
  ACK_SUCCESS = 103
```
This enum is mirrored on the front-end, in the ***CommandType*** constant at the top of */static/connections/js/log-stream.js*, which also maps each code to the label shown in the log. The `ButtonType` constant (`default`, `checkbox`, `upload`) lives in the same file, and defines how `PostConsumer.send_via_http` handles the command.

When adding a new command, it must be kept in sync in **three** places:
<!--ts-->
* `CommandType`, in */connections/command_types.py*.
* `CommandType` and `COMMAND_TYPE_LABELS`, in */static/connections/js/log-stream.js*.
* the `[commands-list]` section of *config.ini*, that maps the code to the endpoint/HTTP method used to reach the device (`POSITION_INFO` is instead declared in `[internal-protocol]`).
<!--te-->

### Command button logic
You already have a button on interface that sends a command, in this case '40', to a Consumer. This Consumer will be in charge to the command logic.
</br>
Inside the <i>'receive'</i> method of this Consumer's Class, it's up to you to write the command's logic, according to your communication protocol.
</br>
When handling with **HTTP requests**, you can insert the new command to  the command's list, inside config.ini file. The Consumer can iterate this list and check the command received, mapping to the right endpoint.
```javascript
[commands-list]
20 = position_absolute_json,get
22 = position_relative_json,post
32 = takeoff_and_hold,get
...
```
This list contains a number as the key to the corresponding endpoint address, that will receive the HTTP request. The type of request is represented after the comma, with no spaces. If your communication is using HTTP requests and this list, your new list, with the new command, should look like this:
```javascript
[commands-list]
20 = position_absolute_json,get
22 = position_relative_json,post
32 = takeoff_and_hold,get
...
40 = new_endpoint,get
```

## Communicating with external devices
The main purpose of this framework is to exchange information with other devices. Currently there is implemented two ways for external connections.

### Serial Connection
The first way is plugin a ESP32 microcontroller to the framework's machine. This microcontroller should be able to detect other devices, receive and send information to them.
Our framework can stablish an UART connection with a plugged ESP32 microcontroller, receive everything is sent via serial and send commands via serial, making the microcontroller responsible for retransmiting the command.
In order to accept a connection with a ESP32 microcontroller, you need to insert the correct UART Port and baudrate, inside ***config.ini*** (see below for **Changing the code** topic and **Serial connection** subtopic).
The ***SerialConnection*** class, from */connections/serial_connector.py*, is instantiated when javascript starts a websocket connection of this type. The instantiated object keeps trying connection with the UART Port. Once a microcontroller is plugged, the interface indicates this change, and you are able to exchange information through the ESP32 microcontroller.

### POST Requests
Another way to communicate with our framework is with **POST requests**. A device, let's say an UAV (drone), wants to send it's location to our ground station. This can be achieved with a POST request to a specific URL, registered in ***config.ini*** file (see below for **Changing the code** topic and ***HTTP Requests*** subtopic). Note that the device should attach, on the message, it's own IP and PORT, so our framework can send commands back to it.
The specific URL, to receive POSTs, is mapped to a view. So, when the device send it's location on body's request, the ***post_to_socket*** view receive the request and extracts the information from it's body. We want to send this information to our interface and also to save it in the log file. Who is responsible for both actions is the ***PostConsumer***, inside */connections/consumers_wrapper/post_consumer.py*.
This way, the post_to_socket view needs to send the message to PostConsumer, getting an instance of this class and calling this Class function **receive_post(message)**.


## Changing the code
Some of the framework's informations are initialized by the *config.ini* file. Below are listed the parameters that can be changed.
### Serial connection
One way this framework can comunicate with a network is with a dedicated ESP32, using UART Protocol. The ESP device connected via serial has a specific PORT and Baudrate, that can be changed inside *config.ini* with the [serial] tag:
```python
[serial]
# The serial PORT the ESP32 is connected
port = COM4

# Rate of information transferred in the serial port
# Needs to be the same in ESP32 connection
baudrate = 115200

# If this Protocol is used
serial_available = false
```

### HTTP Requests
Another way to comunicate with nodes of the network is receiving/sending information via POST/GET Requests. Django provides a routing system that acessibles URLs trigger methods, or *Views*.
A device can send a POST request to http://127.0.0.1:8000/update-info/ (or IP/PORT running the application). Notice that a device should send inside the message it's own IP/PORT, so the application can send commands via HTTP requests.
This structure is described with more details below, on the Project Struct topic.

Inside the *config.ini* file, below the [post] tag, you can change some of the protocol's variables:
```python
[post]
# Default ip/port of django's server.
# If started on a different configuration, you need to change it here.
ip = http://127.0.0.1:8000/

# Endpoint that'll receive POST requests with device's information
path_receive_info = update-info/
```

### List of devices updater
The application saves the latest messages of unique devices in a list, inside the *update_periodically_consumer.py*, for each execution. From time to time, it's sent to the front-end, via web-socket, with the activity status of each device. A device can be active, on hold and inactive, depending on the interval of it's last message.
These variables can be adjusted in the *config.ini* file, below the [list-updater] tag:
```python
[post]
# The amount of seconds to a device be considered 'inactive'
seconds_to_device_be_inactive = 50

# The amount of seconds to a device be considered 'on hold'
seconds_to_device_be_on_hold = 25

# The amount of seconds to update the list of devices in Front-End
update_delay = 20
```




## Folders structure
    .
    ├── config              # Contains Django's configurations files
    ├── connections         # Main app folder
    ├── static              # Static js, css, images files
    ├── templates           # Files with template language (html)
    ├── uav_simulator       # Logic to run Ardupilot SITL simulator 
    ├── config.ini          # Contains project's adjustable parameters
    ├── manage.py           # Django’s command-line utility for administrative tasks
    ├── requeriments.txt    # Contains all packages and versions required for Windows
    ├── ´´_linux.txt        # Contains all packages and versions required for Linux
    └── README.md

We will open the folders that require more attention:

**Connections**
This is the main app's folder, with the necessary tools to allow connections and information exchange with other devices

    .
    ├── ...             
    ├── connections
    |   ├── consumers_wrapper   # Folder with all websocket consumers
    |   ├── LOGS                # Stores all .log files generated
    |   ├── utils               # Auxiliary tools
    |   ├── ...
    |   ├── command_types.py    # CommandType enum with the numeric codes of the protocol
    |   ├── routing.py          # Paths for websocket connections
    |   ├── serial_connector.py # Auxiliary class to stablish/handle connection with esp32 device
    |   ├── urls.py             # Paths for views
    |   ├── views.py            # Methods called when specific url is accessed
    └── ...

**Templates**
This folder contains the files written with template language. These files can be associated with traditional HTML files, but with tags, interpreted by Django.

    .
    ├── ...             
    ├── templates
    |   ├── connections
    |   |    └── components  # Partials included by index.html (one per panel/group of controls)
    |   ├── index.html       # Home page, runs main.js
    |   ├── logs_grid.html   # Log Mosaic window, runs logs-grid.js
    └── ...

**Static**
Contains static files, like Images, CSS and Javascript. Django provides django.contrib.staticfiles to help you manage them. These files can be configured inside *config/settings.py*:
```python
STATIC_URL = '/static/'
```
In the **templates files**, can be used the static template tag to build the URL for the given relative path using the configured *STATICFILES_STORAGE*:
```python
{% load static %}
<img src="{% static 'my_app/example.jpg' %}" alt="My image">
```

    .
    ├── ...             
    ├── static
    |   ├── connections        # Folder to separate the main app's static files
    |   |    ├── css           # All css used inside connections
    |   |    |    ├── components   # One file per interface component
    |   |    |    ├── tokens.css   # Design tokens (colors, fonts, metrics)
    |   |    |    ├── base.css     # Resets and shared typography
    |   |    |    ├── layout.css   # Home page grid
    |   |    |    ├── connection.css # Entry point of the home page (imports the files above)
    |   |    |    └── logs_grid.css  # Entry point of the Log Mosaic window
    |   |    ├── images        # All images used in the project
    |   |    ├── js            # All javascript files
        └──
    └── ...
