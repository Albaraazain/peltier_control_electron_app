import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

/// Raw socket-based Modbus client that works in Flutter
class RawModbusTcpClient {
  RawSocket? _rawSocket;
  String _host;
  int _port;
  int _unitId;
  int _timeout;
  int _transactionId = 0;
  
  bool _isConnected = false;
  StreamSubscription? _subscription;
  final Map<int, Completer<Uint8List?>> _pendingRequests = {};

  RawModbusTcpClient({
    required String host,
    int port = 502,
    int unitId = 1,
    int timeout = 5,
  }) : _host = host,
       _port = port,
       _unitId = unitId,
       _timeout = timeout;

  bool get isConnected => _isConnected && _rawSocket != null;

  /// Connect to Modbus TCP server using RawSocket
  Future<bool> connect() async {
    try {
      if (_rawSocket != null) {
        await disconnect();
      }

      print('🔌 Connecting to $_host:$_port using RawSocket...');
      
      _rawSocket = await RawSocket.connect(
        _host, 
        _port,
        timeout: Duration(seconds: _timeout),
      );
      
      _isConnected = true;
      
      // Set up data listener
      _subscription = _rawSocket!.listen(_handleData);
      
      print('✅ Connected to Modbus TCP server at $_host:$_port');
      return true;
    } catch (e) {
      print('❌ Failed to connect to Modbus TCP server: $e');
      _isConnected = false;
      return false;
    }
  }

  /// Handle incoming data from raw socket
  void _handleData(RawSocketEvent event) {
    if (event == RawSocketEvent.read) {
      final data = _rawSocket!.read();
      if (data != null && data.isNotEmpty) {
        _processResponse(Uint8List.fromList(data));
      }
    } else if (event == RawSocketEvent.readClosed) {
      print('Socket closed by remote');
      _isConnected = false;
    }
  }

  /// Process Modbus response
  void _processResponse(Uint8List data) {
    if (data.length < 8) return;
    
    // Extract transaction ID from response
    final transactionId = ByteData.sublistView(data, 0, 2).getUint16(0, Endian.big);
    
    // Find pending request
    final completer = _pendingRequests.remove(transactionId);
    if (completer != null) {
      // Extract PDU (skip MBAP header)
      final pdu = data.sublist(7);
      completer.complete(pdu);
    }
  }

  /// Disconnect from Modbus TCP server
  Future<void> disconnect() async {
    try {
      _subscription?.cancel();
      _subscription = null;
      
      _rawSocket?.close();
      _rawSocket = null;
      
      // Complete any pending requests with null
      for (final completer in _pendingRequests.values) {
        completer.complete(null);
      }
      _pendingRequests.clear();
      
    } catch (e) {
      print('Error disconnecting: $e');
    } finally {
      _isConnected = false;
    }
  }

  /// Get next transaction ID
  int _getNextTransactionId() {
    _transactionId = (_transactionId + 1) & 0xFFFF;
    return _transactionId;
  }

  /// Encode Modbus TCP frame
  Uint8List _encodeFrame(Uint8List pdu, int unitId, int transactionId) {
    final frame = ByteData(7 + pdu.length);
    
    frame.setUint16(0, transactionId, Endian.big);
    frame.setUint16(2, 0x0000, Endian.big);
    frame.setUint16(4, 1 + pdu.length, Endian.big);
    frame.setUint8(6, unitId);
    
    for (int i = 0; i < pdu.length; i++) {
      frame.setUint8(7 + i, pdu[i]);
    }
    
    return frame.buffer.asUint8List();
  }

  /// Send request and receive response
  Future<Uint8List?> _sendRequest(Uint8List pdu, {int? unitId}) async {
    if (!isConnected) {
      throw Exception('Not connected to Modbus server');
    }

    final tid = _getNextTransactionId();
    final frame = _encodeFrame(pdu, unitId ?? _unitId, tid);
    
    // Create completer for response
    final completer = Completer<Uint8List?>();
    _pendingRequests[tid] = completer;
    
    // Set timeout
    Timer(Duration(seconds: _timeout), () {
      final pendingCompleter = _pendingRequests.remove(tid);
      if (pendingCompleter != null && !pendingCompleter.isCompleted) {
        pendingCompleter.complete(null);
      }
    });
    
    try {
      // Send request
      _rawSocket!.write(frame);
      
      // Wait for response
      return await completer.future;
    } catch (e) {
      _pendingRequests.remove(tid);
      print('Error sending Modbus request: $e');
      return null;
    }
  }

  /// Read holding registers (function code 3)
  Future<List<int>?> readHoldingRegisters(int address, int count) async {
    if (count < 1 || count > 125) {
      throw ArgumentError('Count must be between 1 and 125');
    }
    
    final pdu = ByteData(5);
    pdu.setUint8(0, 0x03);
    pdu.setUint16(1, address, Endian.big);
    pdu.setUint16(3, count, Endian.big);
    
    final response = await _sendRequest(pdu.buffer.asUint8List());
    if (response == null) return null;
    
    if (response[0] & 0x80 != 0) {
      print('Modbus exception: ${response[1]}');
      return null;
    }
    
    if (response[0] != 0x03) {
      print('Unexpected function code: ${response[0]}');
      return null;
    }
    
    final byteCount = response[1];
    if (byteCount != count * 2) {
      print('Unexpected byte count: $byteCount');
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
    
    final pdu = ByteData(5);
    pdu.setUint8(0, 0x04);
    pdu.setUint16(1, address, Endian.big);
    pdu.setUint16(3, count, Endian.big);
    
    final response = await _sendRequest(pdu.buffer.asUint8List());
    if (response == null) return null;
    
    if (response[0] & 0x80 != 0) {
      print('Modbus exception: ${response[1]}');
      return null;
    }
    
    if (response[0] != 0x04) {
      print('Unexpected function code: ${response[0]}');
      return null;
    }
    
    final byteCount = response[1];
    if (byteCount != count * 2) {
      print('Unexpected byte count: $byteCount');
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
    final pdu = ByteData(5);
    pdu.setUint8(0, 0x05);
    pdu.setUint16(1, address, Endian.big);
    pdu.setUint16(3, value ? 0xFF00 : 0x0000, Endian.big);
    
    final response = await _sendRequest(pdu.buffer.asUint8List());
    if (response == null) return false;
    
    if (response[0] & 0x80 != 0) {
      print('Modbus exception: ${response[1]}');
      return false;
    }
    
    return response.length == 5 && 
           response[0] == 0x05 &&
           ByteData.sublistView(response, 1, 3).getUint16(0, Endian.big) == address;
  }

  /// Read coils (function code 1)
  Future<List<bool>?> readCoils(int address, int count) async {
    if (count < 1 || count > 2000) {
      throw ArgumentError('Count must be between 1 and 2000');
    }
    
    final pdu = ByteData(5);
    pdu.setUint8(0, 0x01);
    pdu.setUint16(1, address, Endian.big);
    pdu.setUint16(3, count, Endian.big);
    
    final response = await _sendRequest(pdu.buffer.asUint8List());
    if (response == null) return null;
    
    if (response[0] & 0x80 != 0) {
      print('Modbus exception: ${response[1]}');
      return null;
    }
    
    if (response[0] != 0x01) {
      print('Unexpected function code: ${response[0]}');
      return null;
    }
    
    final byteCount = response[1];
    final expectedBytes = (count + 7) ~/ 8; // Round up to nearest byte
    
    if (byteCount != expectedBytes) {
      print('Unexpected byte count: $byteCount, expected $expectedBytes');
      return null;
    }
    
    final coils = <bool>[];
    for (int i = 0; i < count; i++) {
      final byteIndex = i ~/ 8;
      final bitIndex = i % 8;
      final byteValue = response[2 + byteIndex];
      final bitValue = (byteValue >> bitIndex) & 1;
      coils.add(bitValue == 1);
    }
    
    return coils;
  }

  /// Write single holding register (function code 6)
  Future<bool> writeSingleRegister(int address, int value) async {
    if (value < 0 || value > 0xFFFF) {
      throw ArgumentError('Value must be between 0 and 65535');
    }
    
    final pdu = ByteData(5);
    pdu.setUint8(0, 0x06);
    pdu.setUint16(1, address, Endian.big);
    pdu.setUint16(3, value, Endian.big);
    
    final response = await _sendRequest(pdu.buffer.asUint8List());
    if (response == null) return false;
    
    if (response[0] & 0x80 != 0) {
      print('Modbus exception: ${response[1]}');
      return false;
    }
    
    return response.length == 5 && 
           response[0] == 0x06 &&
           ByteData.sublistView(response, 1, 3).getUint16(0, Endian.big) == address &&
           ByteData.sublistView(response, 3, 5).getUint16(0, Endian.big) == value;
  }

  void dispose() {
    disconnect();
  }
}