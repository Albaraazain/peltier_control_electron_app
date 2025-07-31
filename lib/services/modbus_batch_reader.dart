import 'dart:async';
import 'dart:typed_data';
import 'dart:io';

/// Direct Modbus TCP implementation for batch reading
/// This bypasses the modbus_client library limitations
class ModbusBatchReader {
  final String host;
  final int port;
  final int unitId;
  Socket? _socket;
  int _transactionId = 0;
  
  ModbusBatchReader({
    required this.host,
    this.port = 502,
    this.unitId = 1,
  });
  
  Future<bool> connect() async {
    try {
      _socket = await Socket.connect(host, port, timeout: const Duration(seconds: 5));
      return true;
    } catch (e) {
      print('Failed to connect to Modbus TCP: $e');
      return false;
    }
  }
  
  void disconnect() {
    _socket?.close();
    _socket = null;
  }
  
  bool get isConnected => _socket != null;
  
  /// Read multiple holding registers starting from address
  Future<List<int>?> readHoldingRegisters(int startAddress, int count) async {
    if (!isConnected) return null;
    
    try {
      // Modbus TCP frame format:
      // Transaction ID (2 bytes) + Protocol ID (2 bytes) + Length (2 bytes) +
      // Unit ID (1 byte) + Function Code (1 byte) + Start Address (2 bytes) + Count (2 bytes)
      
      _transactionId++;
      final request = BytesBuilder();
      
      // MBAP Header
      request.addByte((_transactionId >> 8) & 0xFF); // Transaction ID high
      request.addByte(_transactionId & 0xFF);        // Transaction ID low
      request.addByte(0x00);                         // Protocol ID high (always 0 for Modbus TCP)
      request.addByte(0x00);                         // Protocol ID low
      request.addByte(0x00);                         // Length high
      request.addByte(0x06);                         // Length low (6 bytes follow)
      
      // PDU
      request.addByte(unitId);                       // Unit ID
      request.addByte(0x03);                         // Function code 03 (Read Holding Registers)
      request.addByte((startAddress >> 8) & 0xFF);   // Start address high
      request.addByte(startAddress & 0xFF);          // Start address low
      request.addByte((count >> 8) & 0xFF);          // Count high
      request.addByte(count & 0xFF);                 // Count low
      
      // Send request
      _socket!.add(request.toBytes());
      
      // Wait for response
      final completer = Completer<List<int>?>();
      StreamSubscription? subscription;
      
      subscription = _socket!.listen(
        (data) {
          if (data.length >= 9) {
            // Check if this is our response
            final responseTransactionId = (data[0] << 8) | data[1];
            if (responseTransactionId == _transactionId) {
              final functionCode = data[7];
              
              if (functionCode == 0x03) {
                // Success response
                final byteCount = data[8];
                if (data.length >= 9 + byteCount) {
                  final values = <int>[];
                  for (int i = 0; i < byteCount; i += 2) {
                    final high = data[9 + i];
                    final low = data[9 + i + 1];
                    values.add((high << 8) | low);
                  }
                  subscription?.cancel();
                  completer.complete(values);
                }
              } else if (functionCode == 0x83) {
                // Error response
                print('Modbus error: Exception code ${data[8]}');
                subscription?.cancel();
                completer.complete(null);
              }
            }
          }
        },
        onError: (error) {
          print('Socket error: $error');
          subscription?.cancel();
          completer.complete(null);
        },
      );
      
      // Timeout after 2 seconds
      Future.delayed(const Duration(seconds: 2), () {
        if (!completer.isCompleted) {
          subscription?.cancel();
          completer.complete(null);
        }
      });
      
      return await completer.future;
    } catch (e) {
      print('Error reading holding registers: $e');
      return null;
    }
  }
  
  /// Read single holding register
  Future<int?> readSingleHoldingRegister(int address) async {
    final values = await readHoldingRegisters(address, 1);
    return values?.isNotEmpty == true ? values![0] : null;
  }
}