from enum import IntEnum


class CommandType(IntEnum):
  """Numeric 'type' codes exchanged between the ground station, UAVs and the serial link.

  GPS_POSITION through EXECUTE_SCRIPT must stay in sync with [commands-list] in config.ini,
  which maps each of these codes to the HTTP endpoint/method used to reach a device.
  POSITION_INFO must stay in sync with [internal-protocol] position_command in config.ini.
  """

  SERIAL_HANDSHAKE = 13
  SERIAL_CONNECTED = 14

  GPS_POSITION = 20
  NED_POSITION = 22
  ARM = 24
  TAKEOFF = 26
  LAND = 28
  LAND_STOP = 29
  RTL = 30
  RTL_STOP = 31
  LIST_SCRIPTS = 42
  UPLOAD_SCRIPT = 44
  EXECUTE_SCRIPT = 46

  ACK_ERROR = 101
  POSITION_INFO = 102
  ACK_SUCCESS = 103
