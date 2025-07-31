import 'dart:async';
import 'package:modbus/modbus.dart' as modbus;
import '../models/temperature_reading.dart';
import '../models/peltier_status.dart';
import '../utils/constants.dart';

/// Simple Modbus service using the 'modbus' package
class ModbusSimpleService {
  modbus.ModbusClient? _client;
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

  ModbusSimpleService();

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

      print('🔌 Connecting to GMT PLC at $_host:$_port...');
      
      // Create TCP client - using RTU mode as GMT PLCs often use Modbus RTU over TCP
      _client = modbus.createTcpClient(
        _host,
        port: _port,
        mode: modbus.ModbusMode.rtu,
      );
      
      // Connect to the server
      await _client!.connect();
      
      // Set unit ID if not 1
      if (_unitId != 1) {
        _client!.setUnitId(_unitId);
      }
      
      _isConnected = true;
      _connectionStreamController.add(true);

      _startConnectionMonitoring();
      
      print('✅ Connected to Modbus server at $_host');
      
      // Test connection with a simple read
      try {
        // Try to read a register to verify connection
        await _client!.readHoldingRegisters(0, 1);
        print('✅ Connection verified with test read');
      } catch (e) {
        print('⚠️  Test read failed but connection established: $e');
      }
      
      return true;
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
        _client!.close();
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
      const Duration(seconds: 10),
      (timer) async {
        if (!await _checkConnection()) {
          _isConnected = false;
          _connectionStreamController.add(false);
          timer.cancel();
        }
      },
    );
  }

  Future<bool> _checkConnection() async {
    try {
      if (_client == null) return false;
      
      // Try to read a register to check connection
      await _client!.readHoldingRegisters(0, 1);
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<TemperatureReading?> readContainerTemperature() async {
    if (!_isConnected || _client == null) {
      throw Exception('Not connected to Modbus server');
    }

    try {
      print('🌡️  Reading thermocouple using modbus package...');
      
      // Method 1: Try batch reading starting from 2020
      try {
        print('📍 Attempting batch read 2020-2029 (10 registers)...');
        
        // Read 10 registers starting from 2020
        final registers = await _client!.readHoldingRegisters(2020, 10);
        
        if (registers != null && registers.length >= 7) {
          // Index 6 is address 2026 (2020 + 6)
          final rawValue = registers[6];
          final temperature = rawValue / 10.0; // Convert from tenths
          
          print('✅ Batch read successful! Address 2026 = $rawValue (${temperature.toStringAsFixed(1)}°C)');
          
          return TemperatureReading(
            temperature: temperature,
            timestamp: DateTime.now(),
            peltierId: 0, // Container temperature
          );
        } else {
          print('❌ Batch read returned insufficient data');
        }
      } catch (e) {
        print('❌ Batch read failed: $e');
      }
      
      // Method 2: Try single register read at 2026
      try {
        print('📍 Attempting single register read at 2026...');
        
        final registers = await _client!.readHoldingRegisters(2026, 1);
        
        if (registers != null && registers.isNotEmpty) {
          final rawValue = registers[0];
          final temperature = rawValue / 10.0;
          
          print('✅ Single read successful! Address 2026 = $rawValue (${temperature.toStringAsFixed(1)}°C)');
          
          return TemperatureReading(
            temperature: temperature,
            timestamp: DateTime.now(),
            peltierId: 0,
          );
        }
      } catch (e) {
        print('❌ Single read failed: $e');
      }
      
      // Method 3: Try different batch sizes
      final testRanges = [
        {'start': 2000, 'count': 30},
        {'start': 2000, 'count': 50},
        {'start': 2025, 'count': 5},
      ];
      
      for (final range in testRanges) {
        try {
          final start = range['start']!;
          final count = range['count']!;
          print('📍 Trying batch ${start}-${start + count - 1}...');
          
          final registers = await _client!.readHoldingRegisters(start, count);
          
          if (registers != null && start <= 2026 && 2026 < start + count) {
            final index = 2026 - start;
            if (registers.length > index) {
              final rawValue = registers[index];
              final temperature = rawValue / 10.0;
              
              print('✅ Found at index $index: $rawValue (${temperature.toStringAsFixed(1)}°C)');
              
              return TemperatureReading(
                temperature: temperature,
                timestamp: DateTime.now(),
                peltierId: 0,
              );
            }
          }
        } catch (e) {
          print('❌ Batch ${range['start']}-${range['start']! + range['count']! - 1} failed: $e');
        }
      }
      
      print('❌ All read attempts failed');
      
      // Return zero reading to maintain connection
      return TemperatureReading(
        temperature: 0.0,
        timestamp: DateTime.now(),
        peltierId: 0,
      );
    } catch (e) {
      print('⚠️  Error reading thermocouple: $e');
      
      return TemperatureReading(
        temperature: 0.0,
        timestamp: DateTime.now(),
        peltierId: 0,
      );
    }
  }

  Future<bool> setPeltierOutput(int peltierId, bool enabled) async {
    if (!_isConnected || _client == null) {
      throw Exception('Not connected to Modbus server');
    }

    final config = PeltierConstants.peltierConfigs
        .firstWhere((config) => config['id'] == peltierId);
    
    final addresses = config['digitalOutputAddresses'] as List<dynamic>;
    
    // Use the first address (we know it's 2 for Peltier 1, 4 for Peltier 2)
    final coilAddress = addresses[0] as int;
    
    try {
      print('🔧 Setting Peltier $peltierId (coil $coilAddress) to ${enabled ? "ON" : "OFF"}...');
      
      // Write single coil
      await _client!.writeSingleCoil(coilAddress, enabled);
      
      print('✅ Successfully set coil $coilAddress to ${enabled ? "ON" : "OFF"}');
      return true;
    } catch (e) {
      print('❌ Failed to control Peltier $peltierId at coil $coilAddress: $e');
      return false;
    }
  }

  Future<PeltierStatus?> readPeltierStatus(int peltierId, double containerTemperature) async {
    if (!_isConnected || _client == null) {
      throw Exception('Not connected to Modbus server');
    }

    final config = PeltierConstants.peltierConfigs
        .firstWhere((config) => config['id'] == peltierId);
    
    final addresses = config['digitalOutputAddresses'] as List<dynamic>;
    final coilAddress = addresses[0] as int;
    
    try {
      print('📖 Reading Peltier $peltierId status (coil $coilAddress)...');
      
      // Read single coil
      final coils = await _client!.readCoils(coilAddress, 1);
      
      if (coils != null && coils.isNotEmpty) {
        final isOn = coils[0] == true;
        final state = isOn ? PeltierState.cooling : PeltierState.idle;
        
        print('✅ Peltier $peltierId is ${isOn ? "ON" : "OFF"}');
        
        return PeltierStatus(
          id: peltierId,
          name: config['name'] as String,
          currentTemperature: containerTemperature,
          targetTemperature: PeltierConstants.targetTemperature,
          state: state,
          isConnected: true,
          lastUpdate: DateTime.now(),
        );
      } else {
        print('❌ Failed to read coil status');
      }
    } catch (e) {
      print('⚠️  Error reading Peltier $peltierId status: $e');
    }
    
    // Return error status if read failed
    return PeltierStatus(
      id: peltierId,
      name: config['name'] as String,
      currentTemperature: containerTemperature,
      targetTemperature: PeltierConstants.targetTemperature,
      state: PeltierState.error,
      isConnected: false,
      lastUpdate: DateTime.now(),
    );
  }

  Future<List<PeltierStatus>> readAllPeltierStatus(TemperatureReading? containerReading) async {
    final statuses = <PeltierStatus>[];
    final containerTemp = containerReading?.temperature ?? 0.0;
    
    for (final config in PeltierConstants.peltierConfigs) {
      final peltierId = config['id'] as int;
      final status = await readPeltierStatus(peltierId, containerTemp);
      if (status != null) {
        statuses.add(status);
      }
    }
    
    return statuses;
  }

  void dispose() {
    disconnect();
    _connectionStreamController.close();
  }
}