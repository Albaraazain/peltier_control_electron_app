import 'dart:async';
import '../models/temperature_reading.dart';
import '../models/peltier_status.dart';
import '../utils/constants.dart';
import 'raw_modbus_client.dart';

/// Modbus service using the custom TCP client based on pymodbus
class CustomModbusService {
  RawModbusTcpClient? _client;
  bool _isConnected = false;
  Timer? _connectionCheckTimer;
  
  String _host = ModbusConstants.defaultHost;
  int _port = ModbusConstants.defaultPort;
  int _unitId = ModbusConstants.defaultUnitId;

  bool get isConnected => _isConnected;
  String get host => _host;
  int get port => _port;

  final _connectionStreamController = StreamController<bool>.broadcast();
  Stream<bool> get connectionStream => _connectionStreamController.stream;

  CustomModbusService();

  Future<bool> connect({
    String? host,
    int? port,
    int? unitId,
  }) async {
    try {
      if (host != null) _host = host;
      if (port != null) _port = port;
      if (unitId != null) _unitId = unitId;

      await disconnect();

      print('🔌 Connecting to GMT PLC at $_host:$_port using RawSocket client...');
      
      _client = RawModbusTcpClient(
        host: _host,
        port: _port,
        unitId: _unitId,
        timeout: 5,
      );
      
      final success = await _client!.connect();
      
      if (success) {
        _isConnected = true;
        _connectionStreamController.add(true);
        _startConnectionMonitoring();
        
        print('✅ Connected to Modbus server at $_host');
        
        // Test connection with a simple read
        try {
          await _client!.readHoldingRegisters(0, 1);
          print('✅ Connection verified with test read');
        } catch (e) {
          print('⚠️  Test read failed but connection established: $e');
        }
        
        return true;
      } else {
        _isConnected = false;
        _connectionStreamController.add(false);
        return false;
      }
    } catch (e) {
      print('❌ Failed to connect to Modbus server: $e');
      _isConnected = false;
      _connectionStreamController.add(false);
      return false;
    }
  }

  Future<void> disconnect() async {
    _connectionCheckTimer?.cancel();
    _connectionCheckTimer = null;
    
    if (_client != null) {
      try {
        await _client!.disconnect();
      } catch (e) {
        print('Error disconnecting: $e');
      }
      _client = null;
    }
    
    _isConnected = false;
    if (!_connectionStreamController.isClosed) {
      _connectionStreamController.add(false);
    }
  }

  void _startConnectionMonitoring() {
    _connectionCheckTimer = Timer.periodic(
      const Duration(seconds: 30),
      (timer) async {
        if (!await _checkConnection()) {
          print('⚠️  Connection lost, marking as disconnected');
          _isConnected = false;
          _connectionStreamController.add(false);
          timer.cancel();
        }
      },
    );
  }

  Future<bool> _checkConnection() async {
    if (_client == null) return false;
    
    try {
      // Try a simple read to check connection
      await _client!.readHoldingRegisters(0, 1);
      return true;
    } catch (e) {
      return false;
    }
  }

  /// Read container temperature from thermocouple at address 2026
  Future<TemperatureReading?> readContainerTemperature() async {
    if (!_isConnected || _client == null) {
      throw Exception('Not connected to Modbus server');
    }

    try {
      print('📊 Reading container temperature using BATCH method (2026-2035)...');
      
      // Read BATCH of 10 registers starting at 2026 (GMT PLC quirk - 2026 only works in batch)
      final registers = await _client!.readHoldingRegisters(2026, 10);
      if (registers == null || registers.isEmpty) {
        print('❌ Failed to read container temperature batch');
        return null;
      }

      // Extract thermocouple value at index 0 (address 2026)
      // GMT thermocouples use signed 16-bit values representing temperature * 10
      int rawValue = registers[0];
      
      // Handle signed 16-bit conversion
      if (rawValue > 32767) {
        rawValue = rawValue - 65536;
      }
      
      // Convert to actual temperature (divide by 10)
      final temperature = rawValue / 10.0;
      
      print('📊 Batch read successful! Registers 2026-2035: ${registers.take(5).join(', ')}...');
      print('📊 Container temperature: ${temperature.toStringAsFixed(1)}°C (raw value: ${registers[0]} at address 2026)');
      
      return TemperatureReading(
        temperature: temperature,
        timestamp: DateTime.now(),
        peltierId: 0, // Container temperature
      );
    } catch (e) {
      print('❌ Error reading batch 2026-2035: $e');
      
      // Try fallback method: batch read starting at 2020 (thermocouple at index 6)
      try {
        print('📊 Trying fallback method: batch read 2020-2029...');
        
        final fallbackRegisters = await _client!.readHoldingRegisters(2020, 10);
        if (fallbackRegisters != null && fallbackRegisters.length > 6) {
          // Thermocouple is at index 6 (address 2026 = 2020 + 6)
          int rawValue = fallbackRegisters[6];
          
          // Handle signed 16-bit conversion
          if (rawValue > 32767) {
            rawValue = rawValue - 65536;
          }
          
          final temperature = rawValue / 10.0;
          
          print('📊 Fallback successful! Register 2026 value: $rawValue');
          print('📊 Container temperature: ${temperature.toStringAsFixed(1)}°C (fallback method)');
          
          return TemperatureReading(
            temperature: temperature,
            timestamp: DateTime.now(),
            peltierId: 0, // Container temperature
          );
        }
      } catch (fallbackError) {
        print('❌ Fallback method also failed: $fallbackError');
      }
      
      print('❌ All methods failed to read container temperature');
      return null;
    }
  }

  /// Read status for all Peltier coolers
  Future<List<PeltierStatus>> readAllPeltierStatus(TemperatureReading? containerReading) async {
    if (!_isConnected || _client == null) {
      throw Exception('Not connected to Modbus server');
    }

    final statusList = <PeltierStatus>[];
    final containerTemp = containerReading?.temperature ?? 0.0;

    try {
      print('📊 Reading Peltier status for ${PeltierConstants.peltierConfigs.length} units...');

      for (final config in PeltierConstants.peltierConfigs) {
        final peltierId = config['id'] as int;
        final peltierName = config['name'] as String;
        
        try {
          // Read Peltier output status from digital output address
          final digitalOutputAddresses = config['digitalOutputAddresses'] as List<int>;
          final coilAddress = digitalOutputAddresses.first;
          print('📊 Reading Peltier $peltierId output status from register $coilAddress...');
          
          // Add small delay to ensure PLC has updated after any recent writes
          await Future.delayed(Duration(milliseconds: 100));
          
          final outputEnabled = await _readPeltierOutput(coilAddress);
          
          // Determine state based on output and temperature
          PeltierState state;
          bool isConnected = true;
          
          if (outputEnabled == null) {
            state = PeltierState.error;
            isConnected = false;
          } else if (!outputEnabled) {
            state = PeltierState.idle;
          } else {
            // Check temperature vs target to determine heating/cooling
            final tempDiff = containerTemp - PeltierConstants.targetTemperature;
            if (tempDiff.abs() <= PeltierConstants.temperatureTolerance) {
              state = PeltierState.idle;
            } else if (tempDiff > 0) {
              state = PeltierState.cooling;
            } else {
              state = PeltierState.heating;
            }
          }

          final status = PeltierStatus(
            id: peltierId,
            name: peltierName,
            currentTemperature: containerTemp, // Use container temperature
            targetTemperature: PeltierConstants.targetTemperature,
            state: state,
            isConnected: isConnected,
            lastUpdate: DateTime.now(),
          );

          statusList.add(status);
          print('📊 Peltier $peltierId ($peltierName): $state, ${containerTemp.toStringAsFixed(1)}°C');
          
        } catch (e) {
          print('❌ Error reading Peltier $peltierId status: $e');
          
          // Add error status
          final errorStatus = PeltierStatus(
            id: peltierId,
            name: peltierName,
            currentTemperature: 0.0,
            targetTemperature: PeltierConstants.targetTemperature,
            state: PeltierState.error,
            isConnected: false,
            lastUpdate: DateTime.now(),
          );
          statusList.add(errorStatus);
        }
      }

      print('📊 Successfully read status for ${statusList.length} Peltier units');
      return statusList;
      
    } catch (e) {
      print('❌ Error reading Peltier status: $e');
      rethrow;
    }
  }

  /// Read Peltier output status from coil (matching Python implementation)
  Future<bool?> _readPeltierOutput(int coilAddress) async {
    try {
      // Try reading as coil first (like Python script)
      print('🔍 Attempting to read coil $coilAddress...');
      final coils = await _client!.readCoils(coilAddress, 1);
      
      if (coils != null && coils.isNotEmpty) {
        final isEnabled = coils[0];
        print('✅ Coil $coilAddress = ${isEnabled ? 'ON' : 'OFF'}');
        return isEnabled;
      }
      
      print('⚠️  Coil read failed, trying as holding register...');
      
      // Fallback to holding register (for compatibility)
      final registers = await _client!.readHoldingRegisters(coilAddress, 1);
      
      if (registers != null && registers.isNotEmpty) {
        final value = registers[0];
        final isEnabled = value != 0;
        print('✅ Holding register $coilAddress = $value (${isEnabled ? 'ON' : 'OFF'})');
        return isEnabled;
      }
      
      print('⚠️  No response from coil/register $coilAddress, assuming disabled');
      return false; // Default to disabled
      
    } catch (e) {
      print('❌ Error reading coil $coilAddress: $e');
      return null;
    }
  }

  /// Set Peltier output (enable/disable)
  Future<bool> setPeltierOutput(int peltierId, bool enabled) async {
    if (!_isConnected || _client == null) {
      throw Exception('Not connected to Modbus server');
    }

    try {
      // Find the coil address for this Peltier
      final config = PeltierConstants.peltierConfigs.firstWhere(
        (config) => config['id'] == peltierId,
        orElse: () => throw Exception('Unknown Peltier ID: $peltierId'),
      );
      
      final digitalOutputAddresses = config['digitalOutputAddresses'] as List<int>;
      final registerAddress = digitalOutputAddresses.first;
      
      print('📊 Setting Peltier $peltierId output to ${enabled ? 'ON' : 'OFF'} (coil $registerAddress)');
      
      // Use coil write first (matching Python implementation)
      final success = await _client!.writeSingleCoil(registerAddress, enabled);
      
      if (success) {
        print('✅ Successfully set Peltier $peltierId output via coil');
        return true;
      } else {
        // Try as holding register (fallback method)
        print('⚠️  Coil write failed, trying holding register...');
        final regSuccess = await _client!.writeSingleRegister(registerAddress, enabled ? 1 : 0);
        if (regSuccess) {
          print('✅ Successfully set Peltier $peltierId output via register');
          return true;
        }
      }
      
      print('❌ Failed to set Peltier $peltierId output');
      return false;
      
    } catch (e) {
      print('❌ Error setting Peltier $peltierId output: $e');
      return false;
    }
  }

  void dispose() {
    print('🗑️  Disposing custom Modbus service');
    
    _connectionCheckTimer?.cancel();
    _client?.dispose();
    
    if (!_connectionStreamController.isClosed) {
      _connectionStreamController.close();
    }
  }
}