import 'dart:async';
import 'package:flutter/foundation.dart';
import '../models/temperature_reading.dart';
import '../models/peltier_status.dart';
import '../services/temperature_repository.dart';
import '../utils/constants.dart';

class TemperatureController extends ChangeNotifier {
  final TemperatureRepository _repository;
  
  // Connection settings
  String _host = ModbusConstants.defaultHost;
  int _port = ModbusConstants.defaultPort;
  int _unitId = ModbusConstants.defaultUnitId;
  
  // State
  bool _isConnected = false;
  bool _isConnecting = false;
  List<PeltierStatus> _peltierStatusList = [];
  Map<int, List<TemperatureReading>> _temperatureHistory = {};
  String? _errorMessage;
  TemperatureReading? _containerTemperature;
  List<TemperatureReading> _containerTemperatureHistory = [];
  
  // Stream subscriptions
  StreamSubscription<bool>? _connectionSubscription;
  StreamSubscription<List<PeltierStatus>>? _statusSubscription;
  StreamSubscription<List<TemperatureReading>>? _temperatureSubscription;

  TemperatureController(this._repository) {
    _initializeController();
  }

  // Getters
  bool get isConnected => _isConnected;
  bool get isConnecting => _isConnecting;
  bool get usingMockData => _repository.usingMockData;
  List<PeltierStatus> get peltierStatusList => List.unmodifiable(_peltierStatusList);
  List<PeltierStatus> get peltierStatuses => peltierStatusList; // Alias for new UI
  String get host => _host;
  int get port => _port;
  int get unitId => _unitId;
  String? get errorMessage => _errorMessage;
  TemperatureReading? get containerTemperature => _containerTemperature;
  List<TemperatureReading> get temperatureHistory => List.unmodifiable(_containerTemperatureHistory);
  
  bool get hasActiveAlerts {
    return _peltierStatusList.any((status) => status.needsAttention);
  }
  
  int get connectedPeltiersCount {
    return _peltierStatusList.where((status) => status.isConnected).length;
  }
  
  int get peltiersInTargetCount {
    return _peltierStatusList.where((status) => status.isInTarget).length;
  }
  
  double? get averageTemperature {
    if (_peltierStatusList.isEmpty) return null;
    
    final totalTemp = _peltierStatusList.fold<double>(
      0.0, 
      (sum, status) => sum + status.currentTemperature,
    );
    return totalTemp / _peltierStatusList.length;
  }

  void _initializeController() {
    // Initialize temperature history for each Peltier
    for (final config in PeltierConstants.peltierConfigs) {
      final peltierId = config['id'] as int;
      _temperatureHistory[peltierId] = [];
    }

    // Listen to repository streams
    _connectionSubscription = _repository.connectionStream.listen(_onConnectionChanged);
    _statusSubscription = _repository.statusStream.listen(_onStatusUpdate);
    _temperatureSubscription = _repository.temperatureStream.listen(_onTemperatureUpdate);
  }

  void _onConnectionChanged(bool connected) {
    _isConnected = connected;
    _isConnecting = false;
    
    if (!connected) {
      _errorMessage = 'Lost connection to PLC';
      // Clear status when disconnected
      _peltierStatusList = _createDisconnectedStatusList();
    } else {
      _errorMessage = null;
    }
    
    notifyListeners();
  }

  void _onStatusUpdate(List<PeltierStatus> statusList) {
    _peltierStatusList = statusList;
    _errorMessage = null;
    notifyListeners();
  }

  void _onTemperatureUpdate(List<TemperatureReading> readings) {
    print('🎯 CONTROLLER: Received ${readings.length} temperature readings');
    
    // Update temperature history
    for (final reading in readings) {
      print('🎯 CONTROLLER: Processing reading - PeltierID: ${reading.peltierId}, Temp: ${reading.temperature.toStringAsFixed(1)}°C');
      
      if (reading.peltierId == 0) {
        // Container temperature (peltierId 0)
        _containerTemperature = reading;
        _containerTemperatureHistory.add(reading);
        print('🎯 CONTROLLER: Updated container temperature to ${reading.temperature.toStringAsFixed(1)}°C');
        
        // Limit container history size
        while (_containerTemperatureHistory.length > AppConstants.maxHistoryPoints) {
          _containerTemperatureHistory.removeAt(0);
        }
      } else {
        // Individual peltier temperature (not used in current setup)
        final history = _temperatureHistory[reading.peltierId];
        if (history != null) {
          history.add(reading);
          
          // Limit history size
          while (history.length > AppConstants.maxHistoryPoints) {
            history.removeAt(0);
          }
        }
      }
    }
    
    print('🎯 CONTROLLER: Calling notifyListeners() to update UI...');
    notifyListeners();
  }

  List<PeltierStatus> _createDisconnectedStatusList() {
    return PeltierConstants.peltierConfigs.map((config) {
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
  }

  Future<bool> connect({String? host, int? port, int? unitId}) async {
    if (_isConnecting) return false;
    
    _isConnecting = true;
    _errorMessage = null;
    notifyListeners();
    
    try {
      // Update connection parameters if provided
      if (host != null) _host = host;
      if (port != null) _port = port;
      if (unitId != null) _unitId = unitId;
      
      final success = await _repository.connect(
        host: _host,
        port: _port,
        unitId: _unitId,
      );
      
      if (!success) {
        _errorMessage = 'Failed to connect to PLC at $_host:$_port';
        _isConnecting = false;
        notifyListeners();
      }
      
      return success;
    } catch (e) {
      _errorMessage = 'Connection error: $e';
      _isConnecting = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> disconnect() async {
    try {
      await _repository.disconnect();
      _isConnected = false;
      _isConnecting = false;
      _peltierStatusList = _createDisconnectedStatusList();
      _errorMessage = null;
      notifyListeners();
    } catch (e) {
      _errorMessage = 'Disconnect error: $e';
      notifyListeners();
    }
  }

  Future<void> reconnect() async {
    await disconnect();
    await Future.delayed(const Duration(seconds: 1)); // Brief delay
    await connect();
  }

  Future<void> refreshData() async {
    // This triggers a manual refresh of data from the PLC
    // The repository should already be polling, but this can force an immediate update
    if (_isConnected) {
      notifyListeners(); // Notify UI to refresh
    }
  }

  List<TemperatureReading> getTemperatureHistory(int peltierId) {
    return _temperatureHistory[peltierId] ?? [];
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

  PeltierStatus? getPeltierStatus(int peltierId) {
    try {
      return _peltierStatusList.firstWhere((status) => status.id == peltierId);
    } catch (e) {
      return null;
    }
  }

  double? getLatestTemperature(int peltierId) {
    final history = _temperatureHistory[peltierId];
    if (history != null && history.isNotEmpty) {
      return history.last.temperature;
    }
    return null;
  }

  bool isTemperatureInRange(int peltierId) {
    final status = getPeltierStatus(peltierId);
    return status?.isInTarget ?? false;
  }

  bool hasTemperatureAlert(int peltierId) {
    final status = getPeltierStatus(peltierId);
    return status?.needsAttention ?? true;
  }

  void clearTemperatureHistory() {
    for (final history in _temperatureHistory.values) {
      history.clear();
    }
    notifyListeners();
  }

  Future<bool> setPeltierOutput(int peltierId, bool enabled) async {
    try {
      final success = await _repository.setPeltierOutput(peltierId, enabled);
      if (success) {
        // Trigger a refresh to update the status
        await Future.delayed(const Duration(milliseconds: 500)); // Brief delay for PLC to update
        // The status will be updated automatically by the polling timer
      }
      return success;
    } catch (e) {
      _errorMessage = 'Error controlling Peltier $peltierId: $e';
      notifyListeners();
      return false;
    }
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  Map<String, dynamic> getSystemSummary() {
    return {
      'isConnected': _isConnected,
      'totalPeltiers': PeltierConstants.peltierConfigs.length,
      'connectedPeltiers': connectedPeltiersCount,
      'peltiersInTarget': peltiersInTargetCount,
      'hasActiveAlerts': hasActiveAlerts,
      'averageTemperature': averageTemperature,
      'targetTemperature': PeltierConstants.targetTemperature,
      'lastUpdate': _peltierStatusList.isNotEmpty 
          ? _peltierStatusList.map((s) => s.lastUpdate).reduce((a, b) => a.isAfter(b) ? a : b)
          : null,
    };
  }

  @override
  void dispose() {
    _connectionSubscription?.cancel();
    _statusSubscription?.cancel();
    _temperatureSubscription?.cancel();
    _repository.dispose();
    super.dispose();
  }
}