class ModbusConstants {
  // Modbus connection settings
  static const String defaultHost = '10.5.5.95';
  static const int defaultPort = 502;
  static const int defaultUnitId = 1;
  static const Duration defaultTimeout = Duration(seconds: 3);
  
  // Polling settings
  static const Duration defaultPollingInterval = Duration(seconds: 2);
}

class PeltierConstants {
  // Temperature settings
  static const double targetTemperature = 5.0; // 5°C
  static const double temperatureTolerance = 0.5; // ±0.5°C
  static const double maxTemperatureDeviation = 2.0; // Alert threshold
  
  // Thermocouple sensor configuration - GMT PLC with GMX-20UA module
  // Address 2026 works only with batch reading (must read addresses 2020-2029)
  // Temperature is stored as tenths of degrees (e.g., 300 = 30.0°C)
  static const int thermocoupleAddress = 2026;
  static const int thermocoupleOriginalAddress = 42027; // User's original address (2026 = 42027 - 40001)
  
  // Peltier configurations - Updated with confirmed addresses
  static const List<Map<String, dynamic>> peltierConfigs = [
    {
      'id': 1,
      'name': 'Peltier 1',
      'digitalOutputAddresses': [2], // Coil 2 confirmed as working peltier
    },
    {
      'id': 2,
      'name': 'Peltier 2', 
      'digitalOutputAddresses': [4], // Coil 4 confirmed as working peltier
    },
  ];
}

class AppConstants {
  static const String appTitle = 'Container Temperature Control';
  static const int maxHistoryPoints = 100;
  static const Duration chartUpdateInterval = Duration(seconds: 1);
}

class AppColors {
  static const Map<String, int> statusColors = {
    'normal': 0xFF4CAF50,     // Green
    'warning': 0xFFFF9800,    // Orange  
    'error': 0xFFF44336,      // Red
    'offline': 0xFF9E9E9E,    // Grey
  };
}