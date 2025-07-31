import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

/// Custom Modbus TCP client based on pymodbus implementation
/// Supports the exact same protocol as pymodbus for compatibility
class CustomModbusTcpClient {
  Socket? _socket;
  String _host;
  int _port;
  int _unitId;
  int _timeout;
  int _transactionId = 0;
  
  bool _isConnected = false;
  
  CustomModbusTcpClient({
    required String host,
    int port = 502,
    int unitId = 1,
    int timeout = 3,
  }) : _host = host,
       _port = port,
       _unitId = unitId,
       _timeout = timeout;

  bool get isConnected => _isConnected && _socket != null;

  /// Connect to Modbus TCP server
  Future<bool> connect() async {
    try {
      if (_socket != null) {
        await disconnect();
      }

      // Try multiple connection approaches for Flutter compatibility
      try {
        // Approach 1: Standard connection
        _socket = await Socket.connect(
          _host, 
          _port,
          timeout: Duration(seconds: _timeout),
        );
      } catch (e1) {
        print('Standard connect failed: $e1');
        
        // Approach 2: Resolve address first, then connect
        try {
          final addresses = await InternetAddress.lookup(_host);
          _socket = await Socket.connect(
            addresses.first,
            _port,
            timeout: Duration(seconds: _timeout),
          );
        } catch (e2) {
          print('Address resolution connect failed: $e2');
          
          // Approach 3: Try with specific socket options
          final rawSocket = await RawSocket.connect(_host, _port, timeout: Duration(seconds: _timeout));
          _socket = await Socket._fromRawSocket(rawSocket);
        }
      }
      
      _isConnected = true;
      print('✅ Connected to Modbus TCP server at $_host:$_port');
      return true;
    } catch (e) {
      print('❌ Failed to connect to Modbus TCP server: $e');
      _isConnected = false;
      return false;
    }
  }

  /// Disconnect from Modbus TCP server
  Future<void> disconnect() async {
    try {
      await _socket?.close();
    } catch (e) {
      print('Error disconnecting: $e');
    } finally {
      _socket = null;
      _isConnected = false;
    }
  }

  /// Get next transaction ID
  int _getNextTransactionId() {
    _transactionId = (_transactionId + 1) & 0xFFFF;
    return _transactionId;
  }

  /// Encode Modbus TCP frame (MBAP header + PDU)
  /// Frame format: [TID][PID][LENGTH][UID][PDU]
  ///              2b   2b   2b      1b   Nb
  Uint8List _encodeFrame(Uint8List pdu, int unitId, int transactionId) {
    final frame = ByteData(7 + pdu.length);
    
    // Transaction ID (2 bytes)
    frame.setUint16(0, transactionId, Endian.big);
    
    // Protocol ID (2 bytes) - always 0x0000 for Modbus TCP
    frame.setUint16(2, 0x0000, Endian.big);
    
    // Length (2 bytes) - unit ID + PDU length
    frame.setUint16(4, 1 + pdu.length, Endian.big);
    
    // Unit ID (1 byte)
    frame.setUint8(6, unitId);
    
    // Copy PDU
    for (int i = 0; i < pdu.length; i++) {
      frame.setUint8(7 + i, pdu[i]);
    }
    
    return frame.buffer.asUint8List();
  }

  /// Decode Modbus TCP frame
  Map<String, dynamic>? _decodeFrame(Uint8List data) {
    if (data.length < 8) {
      print('Frame too short: ${data.length} bytes');
      return null;
    }
    
    final frame = ByteData.sublistView(data);
    
    final transactionId = frame.getUint16(0, Endian.big);
    final protocolId = frame.getUint16(2, Endian.big);
    final length = frame.getUint16(4, Endian.big);
    final unitId = frame.getUint8(6);
    
    if (protocolId != 0x0000) {
      print('Invalid protocol ID: $protocolId');
      return null;
    }
    
    if (data.length < 6 + length) {
      print('Incomplete frame: expected ${6 + length}, got ${data.length}');
      return null;
    }
    
    final pdu = data.sublist(7, 6 + length);
    
    return {
      'transactionId': transactionId,
      'unitId': unitId,
      'pdu': pdu,
    };
  }

  /// Send request and receive response
  Future<Uint8List?> _sendRequest(Uint8List pdu, {int? unitId}) async {
    if (!isConnected) {
      throw Exception('Not connected to Modbus server');
    }

    final tid = _getNextTransactionId();
    final frame = _encodeFrame(pdu, unitId ?? _unitId, tid);
    
    try {
      // Send request
      _socket!.add(frame);
      await _socket!.flush();
      
      // Receive response with timeout
      final completer = Completer<Uint8List?>();
      late StreamSubscription subscription;
      Timer? timeoutTimer;
      
      final responseBuffer = <int>[];
      
      subscription = _socket!.listen(
        (data) {
          responseBuffer.addAll(data);
          
          // Check if we have at least the header
          if (responseBuffer.length >= 7) {
            final lengthBytes = responseBuffer.sublist(4, 6);
            final length = ByteData.sublistView(Uint8List.fromList(lengthBytes))
                .getUint16(0, Endian.big);
            
            // Check if we have the complete frame
            if (responseBuffer.length >= 6 + length) {
              timeoutTimer?.cancel();
              subscription.cancel();
              
              final response = Uint8List.fromList(responseBuffer.take(6 + length).toList());
              final decoded = _decodeFrame(response);
              
              if (decoded != null && decoded['transactionId'] == tid) {
                completer.complete(decoded['pdu']);
              } else {
                completer.complete(null);
              }
            }
          }
        },
        onError: (error) {
          timeoutTimer?.cancel();
          subscription.cancel();
          completer.completeError(error);
        },
      );
      
      // Set timeout
      timeoutTimer = Timer(Duration(seconds: _timeout), () {
        subscription.cancel();
        completer.complete(null);
      });
      
      return await completer.future;
    } catch (e) {
      print('Error sending Modbus request: $e');
      return null;
    }
  }

  /// Read holding registers (function code 3)
  Future<List<int>?> readHoldingRegisters(int address, int count) async {
    if (count < 1 || count > 125) {
      throw ArgumentError('Count must be between 1 and 125');
    }
    
    // Build PDU: [Function Code][Address][Count]
    final pdu = ByteData(5);
    pdu.setUint8(0, 0x03); // Function code 3
    pdu.setUint16(1, address, Endian.big);
    pdu.setUint16(3, count, Endian.big);
    
    final response = await _sendRequest(pdu.buffer.asUint8List());
    if (response == null) {
      return null;
    }
    
    // Check for exception response
    if (response[0] & 0x80 != 0) {
      print('Modbus exception: ${response[1]}');
      return null;
    }
    
    // Parse response: [Function Code][Byte Count][Data...]
    if (response[0] != 0x03) {
      print('Unexpected function code in response: ${response[0]}');
      return null;
    }
    
    final byteCount = response[1];
    if (byteCount != count * 2) {
      print('Unexpected byte count: $byteCount, expected ${count * 2}');
      return null;
    }
    
    final registers = <int>[];
    for (int i = 0; i < count; i++) {
      final offset = 2 + i * 2;
      final value = ByteData.sublistView(response, offset, offset + 2)
          .getUint16(0, Endian.big);
      registers.add(value);
    }
    
    return registers;
  }

  /// Read input registers (function code 4)
  Future<List<int>?> readInputRegisters(int address, int count) async {
    if (count < 1 || count > 125) {
      throw ArgumentError('Count must be between 1 and 125');
    }
    
    // Build PDU: [Function Code][Address][Count]
    final pdu = ByteData(5);
    pdu.setUint8(0, 0x04); // Function code 4
    pdu.setUint16(1, address, Endian.big);
    pdu.setUint16(3, count, Endian.big);
    
    final response = await _sendRequest(pdu.buffer.asUint8List());
    if (response == null) {
      return null;
    }
    
    // Check for exception response
    if (response[0] & 0x80 != 0) {
      print('Modbus exception: ${response[1]}');
      return null;
    }
    
    // Parse response: [Function Code][Byte Count][Data...]
    if (response[0] != 0x04) {
      print('Unexpected function code in response: ${response[0]}');
      return null;
    }
    
    final byteCount = response[1];
    if (byteCount != count * 2) {
      print('Unexpected byte count: $byteCount, expected ${count * 2}');
      return null;
    }
    
    final registers = <int>[];
    for (int i = 0; i < count; i++) {
      final offset = 2 + i * 2;
      final value = ByteData.sublistView(response, offset, offset + 2)
          .getUint16(0, Endian.big);
      registers.add(value);
    }
    
    return registers;
  }

  /// Write single coil (function code 5)
  Future<bool> writeSingleCoil(int address, bool value) async {
    // Build PDU: [Function Code][Address][Value]
    final pdu = ByteData(5);
    pdu.setUint8(0, 0x05); // Function code 5
    pdu.setUint16(1, address, Endian.big);
    pdu.setUint16(3, value ? 0xFF00 : 0x0000, Endian.big);
    
    final response = await _sendRequest(pdu.buffer.asUint8List());
    if (response == null) {
      return false;
    }
    
    // Check for exception response
    if (response[0] & 0x80 != 0) {
      print('Modbus exception: ${response[1]}');
      return false;
    }
    
    // Verify echo response
    return response.length == 5 && 
           response[0] == 0x05 &&
           ByteData.sublistView(response, 1, 3).getUint16(0, Endian.big) == address;
  }

  /// Write single holding register (function code 6)
  Future<bool> writeSingleRegister(int address, int value) async {
    if (value < 0 || value > 0xFFFF) {
      throw ArgumentError('Value must be between 0 and 65535');
    }
    
    // Build PDU: [Function Code][Address][Value]
    final pdu = ByteData(5);
    pdu.setUint8(0, 0x06); // Function code 6
    pdu.setUint16(1, address, Endian.big);
    pdu.setUint16(3, value, Endian.big);
    
    final response = await _sendRequest(pdu.buffer.asUint8List());
    if (response == null) {
      return false;
    }
    
    // Check for exception response
    if (response[0] & 0x80 != 0) {
      print('Modbus exception: ${response[1]}');
      return false;
    }
    
    // Verify echo response
    return response.length == 5 && 
           response[0] == 0x06 &&
           ByteData.sublistView(response, 1, 3).getUint16(0, Endian.big) == address &&
           ByteData.sublistView(response, 3, 5).getUint16(0, Endian.big) == value;
  }

  void dispose() {
    disconnect();
  }
}