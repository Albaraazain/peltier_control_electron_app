class TemperatureReading {
  final double temperature;
  final DateTime timestamp;
  final int peltierId;

  TemperatureReading({
    required this.temperature,
    required this.timestamp,
    required this.peltierId,
  });

  Map<String, dynamic> toJson() {
    return {
      'temperature': temperature,
      'timestamp': timestamp.toIso8601String(),
      'peltierId': peltierId,
    };
  }

  factory TemperatureReading.fromJson(Map<String, dynamic> json) {
    return TemperatureReading(
      temperature: json['temperature'].toDouble(),
      timestamp: DateTime.parse(json['timestamp']),
      peltierId: json['peltierId'],
    );
  }

  @override
  String toString() {
    return 'TemperatureReading(temperature: $temperature°C, peltierId: $peltierId, timestamp: $timestamp)';
  }
}