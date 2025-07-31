import 'dart:async';
import 'dart:math';
import '../models/temperature_reading.dart';
import '../models/peltier_status.dart';
import '../utils/constants.dart';

class MockDataService {
  final Random _random = Random();
  Timer? _simulationTimer;
  
  // Simulation state
  final Map<int, double> _currentTemperatures = {};
  final Map<int, PeltierState> _currentStates = {};
  final Map<int, double> _targetTemperatures = {};
  bool _isRunning = false;
  
  // Stream controllers for mock data
  final _statusStreamController = StreamController<List<PeltierStatus>>.broadcast();
  final _temperatureStreamController = StreamController<List<TemperatureReading>>.broadcast();
  
  Stream<List<PeltierStatus>> get statusStream => _statusStreamController.stream;
  Stream<List<TemperatureReading>> get temperatureStream => _temperatureStreamController.stream;

  MockDataService() {
    _initializeSimulation();
  }

  void _initializeSimulation() {
    // Initialize mock data for each Peltier
    for (final config in PeltierConstants.peltierConfigs) {
      final peltierId = config['id'] as int;
      
      // Start with random temperatures around the target
      _currentTemperatures[peltierId] = PeltierConstants.targetTemperature + 
          (_random.nextDouble() - 0.5) * 4; // ±2°C variation
      
      _targetTemperatures[peltierId] = PeltierConstants.targetTemperature;
      _currentStates[peltierId] = PeltierState.idle;
    }
    
    print('🤖 MOCK DATA: Initialized simulation for ${PeltierConstants.peltierConfigs.length} Peltier coolers');
    print('🤖 MOCK DATA: Target temperature: ${PeltierConstants.targetTemperature}°C');
  }

  void startSimulation() {
    if (_isRunning) return;
    
    _isRunning = true;
    print('🤖 MOCK DATA: Starting temperature simulation...');
    
    _simulationTimer = Timer.periodic(
      ModbusConstants.defaultPollingInterval,
      (timer) => _updateSimulation(),
    );
    
    // Initial update
    _updateSimulation();
  }

  void stopSimulation() {
    _isRunning = false;
    _simulationTimer?.cancel();
    _simulationTimer = null;
    print('🤖 MOCK DATA: Stopped temperature simulation');
  }

  void _updateSimulation() {
    final now = DateTime.now();
    final statusList = <PeltierStatus>[];
    final temperatureReadings = <TemperatureReading>[];
    
    for (final config in PeltierConstants.peltierConfigs) {
      final peltierId = config['id'] as int;
      final peltierName = config['name'] as String;
      
      // Simulate temperature evolution
      final currentTemp = _currentTemperatures[peltierId]!;
      final targetTemp = _targetTemperatures[peltierId]!;
      final tempDifference = targetTemp - currentTemp;
      
      // Simulate cooling/heating behavior
      double newTemp = currentTemp;
      PeltierState newState;
      
      if (tempDifference.abs() < 0.1) {
        // Very close to target - minimal adjustment with noise
        newTemp += (_random.nextDouble() - 0.5) * 0.1;
        newState = PeltierState.idle;
      } else if (tempDifference > 0) {
        // Need to cool down
        newTemp += (tempDifference * 0.1) + (_random.nextDouble() - 0.5) * 0.2;
        newState = PeltierState.cooling;
      } else {
        // Need to heat up
        newTemp += (tempDifference * 0.1) + (_random.nextDouble() - 0.5) * 0.2;
        newState = PeltierState.heating;
      }
      
      // Add some random variation to make it realistic
      newTemp += (_random.nextDouble() - 0.5) * 0.05;
      
      // Occasionally simulate errors (5% chance)
      if (_random.nextDouble() < 0.05) {
        newState = PeltierState.error;
        print('🤖 MOCK DATA: $peltierName simulating error state');
      }
      
      _currentTemperatures[peltierId] = newTemp;
      _currentStates[peltierId] = newState;
      
      // Create temperature reading
      final reading = TemperatureReading(
        temperature: newTemp,
        timestamp: now,
        peltierId: peltierId,
      );
      temperatureReadings.add(reading);
      
      // Create status
      final status = PeltierStatus(
        id: peltierId,
        name: peltierName,
        currentTemperature: newTemp,
        targetTemperature: targetTemp,
        state: newState,
        isConnected: true, // Always connected in simulation
        lastUpdate: now,
        powerConsumption: _simulatepower(newState),
      );
      statusList.add(status);
    }
    
    // Log current status periodically (every 10 updates)
    if (_simulationTimer!.tick % 10 == 0) {
      print('🤖 MOCK DATA: Current temperatures:');
      for (final status in statusList) {
        print('🤖 MOCK DATA:   ${status.name}: ${status.currentTemperature.toStringAsFixed(1)}°C (${status.state.name})');
      }
    }
    
    // Emit updates
    _statusStreamController.add(statusList);
    _temperatureStreamController.add(temperatureReadings);
  }

  double? _simulatepower(PeltierState state) {
    switch (state) {
      case PeltierState.idle:
        return 5.0 + _random.nextDouble() * 2; // 5-7W idle
      case PeltierState.cooling:
        return 25.0 + _random.nextDouble() * 10; // 25-35W cooling  
      case PeltierState.heating:
        return 30.0 + _random.nextDouble() * 15; // 30-45W heating
      case PeltierState.error:
        return null; // No power reading during error
    }
  }

  void setTargetTemperature(int peltierId, double temperature) {
    if (_targetTemperatures.containsKey(peltierId)) {
      _targetTemperatures[peltierId] = temperature;
      print('🤖 MOCK DATA: Set target temperature for Peltier $peltierId to ${temperature.toStringAsFixed(1)}°C');
    }
  }

  void simulateConnectionLoss() {
    print('🤖 MOCK DATA: Simulating connection loss...');
    
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
    
    // Resume normal simulation after 5 seconds
    Timer(const Duration(seconds: 5), () {
      print('🤖 MOCK DATA: Restoring connection...');
      _updateSimulation();
    });
  }

  void dispose() {
    stopSimulation();
    _statusStreamController.close();
    _temperatureStreamController.close();
    print('🤖 MOCK DATA: Disposed mock data service');
  }
}