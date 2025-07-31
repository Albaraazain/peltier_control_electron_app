enum PeltierState {
  idle,
  cooling,
  heating,
  error,
}

class PeltierStatus {
  final int id;
  final String name;
  final double currentTemperature;
  final double targetTemperature;
  final PeltierState state;
  final bool isConnected;
  final DateTime lastUpdate;
  final double? powerConsumption;

  PeltierStatus({
    required this.id,
    required this.name,
    required this.currentTemperature,
    required this.targetTemperature,
    required this.state,
    required this.isConnected,
    required this.lastUpdate,
    this.powerConsumption,
  });

  bool get isInTarget {
    const tolerance = 0.5; // ±0.5°C tolerance
    return (currentTemperature - targetTemperature).abs() <= tolerance;
  }

  bool get needsAttention {
    return !isConnected || 
           state == PeltierState.error ||
           (currentTemperature - targetTemperature).abs() > 2.0;
  }

  PeltierStatus copyWith({
    int? id,
    String? name,
    double? currentTemperature,
    double? targetTemperature,
    PeltierState? state,
    bool? isConnected,
    DateTime? lastUpdate,
    double? powerConsumption,
  }) {
    return PeltierStatus(
      id: id ?? this.id,
      name: name ?? this.name,
      currentTemperature: currentTemperature ?? this.currentTemperature,
      targetTemperature: targetTemperature ?? this.targetTemperature,
      state: state ?? this.state,
      isConnected: isConnected ?? this.isConnected,
      lastUpdate: lastUpdate ?? this.lastUpdate,
      powerConsumption: powerConsumption ?? this.powerConsumption,
    );
  }

  @override
  String toString() {
    return 'PeltierStatus(id: $id, name: $name, temp: $currentTemperature°C, target: $targetTemperature°C, state: $state)';
  }
}