import 'dart:async';
import 'dart:collection';
import '../models/temperature_reading.dart';
import '../models/peltier_status.dart';
import '../utils/constants.dart';
// import 'modbus_service.dart';
// import 'modbus_simple_service.dart';
import 'custom_modbus_service.dart';
import 'mock_data_service.dart';

class TemperatureRepository {
  final CustomModbusService _modbusService;
  final MockDataService _mockDataService;
  Timer? _pollingTimer;
  
  // Data source tracking
  bool _usingMockData = false;
  
  // Temperature history storage
  final Map<int, Queue<TemperatureReading>> _temperatureHistory = {};
  
  // Stream controllers for real-time updates
  final _temperatureStreamController = StreamController<List<TemperatureReading>>.broadcast();
  final _statusStreamController = StreamController<List<PeltierStatus>>.broadcast();
  final _connectionStreamController = StreamController<bool>.broadcast();
  
  // Public streams
  Stream<List<TemperatureReading>> get temperatureStream => _temperatureStreamController.stream;
  Stream<List<PeltierStatus>> get statusStream => _statusStreamController.stream;
  Stream<bool> get connectionStream => _connectionStreamController.stream;
  
  // Current status cache
  final Map<int, PeltierStatus> _currentStatus = {};
  
  // Stream subscriptions for mock data
  StreamSubscription<List<PeltierStatus>>? _mockStatusSubscription;
  StreamSubscription<List<TemperatureReading>>? _mockTemperatureSubscription;
  
  TemperatureRepository(this._modbusService) : _mockDataService = MockDataService() {
    // Initialize history queues for each Peltier
    for (final config in PeltierConstants.peltierConfigs) {
      final peltierId = config['id'] as int;
      _temperatureHistory[peltierId] = Queue<TemperatureReading>();
    }
    
    _setupMockDataStreams();
  }

  bool get isConnected => _usingMockData ? true : _modbusService.isConnected;
  bool get usingMockData => _usingMockData;

  void _setupMockDataStreams() {
    _mockStatusSubscription = _mockDataService.statusStream.listen((statusList) {
      if (_usingMockData) {
        _statusStreamController.add(statusList);
        // Update current status cache
        for (final status in statusList) {
          _currentStatus[status.id] = status;
        }
      }
    });

    _mockTemperatureSubscription = _mockDataService.temperatureStream.listen((readings) {
      if (_usingMockData) {
        _temperatureStreamController.add(readings);
        // Add to history
        for (final reading in readings) {
          _addToHistory(reading);
        }
      }
    });
  }

  Future<bool> connect({
    String? host,
    int? port,
    int? unitId,
  }) async {
    print('📡 DATA SOURCE: Attempting to connect to PLC at ${host ?? ModbusConstants.defaultHost}:${port ?? ModbusConstants.defaultPort}');
    
    final success = await _modbusService.connect(
      host: host,
      port: port,
      unitId: unitId,
    );
    
    if (success) {
      print('✅ DATA SOURCE: Successfully connected to PLC - using REAL data');
      _usingMockData = false;
      _mockDataService.stopSimulation();
      _connectionStreamController.add(true);
      await startMonitoring();
    } else {
      print('❌ DATA SOURCE: Failed to connect to PLC - switching to MOCK data');
      _usingMockData = true;
      _mockDataService.startSimulation();
      _connectionStreamController.add(true); // Still report as connected since we have mock data
    }
    
    return true; // Always return true since we have either real or mock data
  }

  Future<void> disconnect() async {
    print('🔌 DATA SOURCE: Disconnecting from all data sources');
    
    await stopMonitoring();
    await _modbusService.disconnect();
    _mockDataService.stopSimulation();
    
    _usingMockData = false;
    _connectionStreamController.add(false);
  }

  Future<void> startMonitoring() async {
    if (_pollingTimer != null) {
      await stopMonitoring();
    }
    
    // Initial read
    await _updateAllReadings();
    
    // Start periodic polling
    _pollingTimer = Timer.periodic(
      ModbusConstants.defaultPollingInterval,
      (timer) async {
        try {
          await _updateAllReadings();
        } catch (e) {
          print('Error during polling: $e');
          // Continue polling even if there's an error
        }
      },
    );
  }

  Future<void> stopMonitoring() async {
    _pollingTimer?.cancel();
    _pollingTimer = null;
  }

  Future<void> _updateAllReadings() async {
    // Skip PLC reading if using mock data
    if (_usingMockData) {
      return;
    }
    
    try {
      print('📊 DATA SOURCE: Reading from PLC (REAL data)');
      
      // First read the container temperature from thermocouple
      final containerReading = await _modbusService.readContainerTemperature();
      if (containerReading == null) {
        throw Exception('Failed to read container temperature');
      }
      
      // Add container temperature reading to history
      _addToHistory(containerReading);
      
      // Read status for all Peltiers using container temperature
      final statusList = await _modbusService.readAllPeltierStatus(containerReading);
      
      // Create temperature readings - container temperature with peltierId=0
      final temperatureReadings = <TemperatureReading>[];
      
      // Add container temperature reading (peltierId=0 for UI controller)
      final containerTempReading = TemperatureReading(
        temperature: containerReading.temperature,
        timestamp: containerReading.timestamp,
        peltierId: 0, // Container temperature
      );
      temperatureReadings.add(containerTempReading);
      
      // Update current status cache
      for (final status in statusList) {
        _currentStatus[status.id] = status;
      }
      
      // Emit updates to streams
      _temperatureStreamController.add(temperatureReadings);
      _statusStreamController.add(statusList);
      
    } catch (e) {
      print('❌ DATA SOURCE: Error reading from PLC: $e - switching to MOCK data');
      
      // Switch to mock data on PLC error
      _usingMockData = true;
      _mockDataService.startSimulation();
      
      // Still emit error status first
      final errorStatusList = PeltierConstants.peltierConfigs.map((config) {
        return PeltierStatus(
          id: config['id'] as int,
          name: config['name'] as String,
          currentTemperature: 0.0,
          targetTemperature: PeltierConstants.targetTemperature,
          state: PeltierState.error,
          isConnected: false,
          lastUpdate: DateTime.now(),
        );
      }).toList();
      
      _statusStreamController.add(errorStatusList);
    }
  }

  void _addToHistory(TemperatureReading reading) {
    final history = _temperatureHistory[reading.peltierId];
    if (history != null) {
      history.add(reading);
      
      // Limit history size
      while (history.length > AppConstants.maxHistoryPoints) {
        history.removeFirst();
      }
    }
  }

  List<TemperatureReading> getTemperatureHistory(int peltierId) {
    return _temperatureHistory[peltierId]?.toList() ?? [];
  }

  List<TemperatureReading> getAllTemperatureHistory() {
    final allReadings = <TemperatureReading>[];
    
    for (final history in _temperatureHistory.values) {
      allReadings.addAll(history);
    }
    
    // Sort by timestamp
    allReadings.sort((a, b) => a.timestamp.compareTo(b.timestamp));
    
    return allReadings;
  }

  PeltierStatus? getCurrentStatus(int peltierId) {
    return _currentStatus[peltierId];
  }

  List<PeltierStatus> getAllCurrentStatus() {
    return _currentStatus.values.toList();
  }

  double? getLatestTemperature(int peltierId) {
    final history = _temperatureHistory[peltierId];
    if (history != null && history.isNotEmpty) {
      return history.last.temperature;
    }
    return null;
  }

  bool isTemperatureInRange(int peltierId) {
    final temp = getLatestTemperature(peltierId);
    if (temp == null) return false;
    
    return (temp - PeltierConstants.targetTemperature).abs() <= 
           PeltierConstants.temperatureTolerance;
  }

  bool hasTemperatureAlert(int peltierId) {
    final temp = getLatestTemperature(peltierId);
    if (temp == null) return true; // No reading is an alert
    
    return (temp - PeltierConstants.targetTemperature).abs() > 
           PeltierConstants.maxTemperatureDeviation;
  }

  Map<String, dynamic> getSystemSummary() {
    final allStatus = getAllCurrentStatus();
    final totalPeltiers = PeltierConstants.peltierConfigs.length;
    final connectedPeltiers = allStatus.where((s) => s.isConnected).length;
    final peltiersInTarget = allStatus.where((s) => s.isInTarget).length;
    final peltiersWithAlerts = allStatus.where((s) => s.needsAttention).length;
    
    double? avgTemperature;
    if (allStatus.isNotEmpty) {
      final totalTemp = allStatus.fold<double>(
        0.0, 
        (sum, status) => sum + status.currentTemperature,
      );
      avgTemperature = totalTemp / allStatus.length;
    }
    
    return {
      'totalPeltiers': totalPeltiers,
      'connectedPeltiers': connectedPeltiers,
      'peltiersInTarget': peltiersInTarget,
      'peltiersWithAlerts': peltiersWithAlerts,
      'averageTemperature': avgTemperature,
      'lastUpdate': allStatus.isNotEmpty 
          ? allStatus.map((s) => s.lastUpdate).reduce((a, b) => a.isAfter(b) ? a : b)
          : null,
    };
  }

  Future<bool> setPeltierOutput(int peltierId, bool enabled) async {
    if (_usingMockData) {
      print('📊 DATA SOURCE: Peltier control not available in mock mode');
      return false;
    }
    
    try {
      return await _modbusService.setPeltierOutput(peltierId, enabled);
    } catch (e) {
      print('❌ DATA SOURCE: Error controlling Peltier $peltierId: $e');
      return false;
    }
  }

  void clearHistory() {
    for (final history in _temperatureHistory.values) {
      history.clear();
    }
  }

  void dispose() {
    print('🗑️  DATA SOURCE: Disposing temperature repository');
    
    stopMonitoring();
    _mockDataService.dispose();
    
    // Cancel mock data subscriptions
    _mockStatusSubscription?.cancel();
    _mockTemperatureSubscription?.cancel();
    
    // Close stream controllers
    _temperatureStreamController.close();
    _statusStreamController.close();
    _connectionStreamController.close();
    
    _modbusService.dispose();
  }
}