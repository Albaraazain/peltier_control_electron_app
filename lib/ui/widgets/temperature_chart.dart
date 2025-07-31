import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../controllers/temperature_controller.dart';
import '../../models/temperature_reading.dart';
import '../../utils/constants.dart';
import '../theme/app_theme.dart';

class TemperatureChart extends StatelessWidget {
  final TemperatureController controller;

  const TemperatureChart({
    super.key,
    required this.controller,
  });

  @override
  Widget build(BuildContext context) {
    final allReadings = controller.getAllTemperatureHistory();
    
    if (allReadings.isEmpty) {
      return _buildEmptyState();
    }

    return LineChart(
      _createLineChartData(allReadings),
      duration: AppTheme.shortAnimation,
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.timeline,
            size: 64,
            color: AppTheme.textHint,
          ),
          const SizedBox(height: AppTheme.defaultPadding),
          Text(
            'No temperature data available',
            style: AppTheme.subtitleStyle.copyWith(
              color: AppTheme.textSecondaryColor,
            ),
          ),
          const SizedBox(height: AppTheme.smallPadding),
          Text(
            'Connect to start monitoring temperatures',
            style: AppTheme.captionStyle,
          ),
        ],
      ),
    );
  }

  LineChartData _createLineChartData(List<TemperatureReading> allReadings) {
    final peltierLines = <LineChartBarData>[];
    final colors = [AppTheme.primaryColor, AppTheme.secondaryColor];
    
    // Group readings by Peltier ID
    final groupedReadings = <int, List<TemperatureReading>>{};
    for (final reading in allReadings) {
      groupedReadings.putIfAbsent(reading.peltierId, () => []).add(reading);
    }

    // Create a line for each Peltier
    int colorIndex = 0;
    for (final entry in groupedReadings.entries) {
      final readings = entry.value;
      
      if (readings.isEmpty) continue;

      final spots = readings.map((reading) {
        final x = reading.timestamp.millisecondsSinceEpoch.toDouble();
        final y = reading.temperature;
        return FlSpot(x, y);
      }).toList();

      peltierLines.add(
        LineChartBarData(
          spots: spots,
          color: colors[colorIndex % colors.length],
          barWidth: 2,
          isStrokeCapRound: true,
          belowBarData: BarAreaData(
            show: true,
            color: colors[colorIndex % colors.length].withValues(alpha: 0.1),
          ),
          dotData: const FlDotData(show: false),
        ),
      );
      
      colorIndex++;
    }

    // Calculate chart boundaries
    final minTime = allReadings.first.timestamp.millisecondsSinceEpoch.toDouble();
    final maxTime = allReadings.last.timestamp.millisecondsSinceEpoch.toDouble();
    final allTemps = allReadings.map((r) => r.temperature).toList();
    final minTemp = allTemps.reduce((a, b) => a < b ? a : b) - 1;
    final maxTemp = allTemps.reduce((a, b) => a > b ? a : b) + 1;

    return LineChartData(
      lineBarsData: peltierLines,
      minX: minTime,
      maxX: maxTime,
      minY: minTemp,
      maxY: maxTemp,
      titlesData: _createTitlesData(),
      gridData: _createGridData(),
      borderData: FlBorderData(
        show: true,
        border: Border.all(
          color: AppTheme.textHint,
          width: 1,
        ),
      ),
      lineTouchData: _createLineTouchData(),
      extraLinesData: _createExtraLinesData(),
    );
  }

  FlTitlesData _createTitlesData() {
    return FlTitlesData(
      leftTitles: AxisTitles(
        sideTitles: SideTitles(
          showTitles: true,
          reservedSize: 50,
          getTitlesWidget: (value, meta) {
            return Text(
              '${value.toStringAsFixed(1)}°C',
              style: AppTheme.captionStyle,
            );
          },
        ),
      ),
      bottomTitles: AxisTitles(
        sideTitles: SideTitles(
          showTitles: true,
          reservedSize: 40,
          interval: null, // Auto interval
          getTitlesWidget: (value, meta) {
            final date = DateTime.fromMillisecondsSinceEpoch(value.toInt());
            return Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}',
                style: AppTheme.captionStyle,
              ),
            );
          },
        ),
      ),
      topTitles: const AxisTitles(
        sideTitles: SideTitles(showTitles: false),
      ),
      rightTitles: const AxisTitles(
        sideTitles: SideTitles(showTitles: false),
      ),
    );
  }

  FlGridData _createGridData() {
    return FlGridData(
      show: true,
      horizontalInterval: 1,
      verticalInterval: null, // Auto interval
      getDrawingHorizontalLine: (value) {
        return FlLine(
          color: AppTheme.textHint.withValues(alpha: 0.2),
          strokeWidth: 1,
        );
      },
      getDrawingVerticalLine: (value) {
        return FlLine(
          color: AppTheme.textHint.withValues(alpha: 0.2),
          strokeWidth: 1,
        );
      },
    );
  }

  LineTouchData _createLineTouchData() {
    return LineTouchData(
      enabled: true,
      touchTooltipData: LineTouchTooltipData(
        getTooltipColor: (touchedSpot) => AppTheme.cardColor.withValues(alpha: 0.9),
        tooltipRoundedRadius: 8,
        tooltipPadding: const EdgeInsets.all(8),
        getTooltipItems: (touchedSpots) {
          return touchedSpots.map((touchedSpot) {
            final peltierId = touchedSpot.barIndex + 1; // Assuming 1-based IDs
            final peltierName = PeltierConstants.peltierConfigs
                .firstWhere((config) => config['id'] == peltierId)['name'] as String;
            
            final date = DateTime.fromMillisecondsSinceEpoch(
              touchedSpot.x.toInt(),
            );
            
            return LineTooltipItem(
              '$peltierName\n${touchedSpot.y.toStringAsFixed(1)}°C\n${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}',
              AppTheme.captionStyle.copyWith(
                color: touchedSpot.bar.color,
                fontWeight: FontWeight.w500,
              ),
            );
          }).toList();
        },
      ),
      touchSpotThreshold: 20,
    );
  }

  ExtraLinesData _createExtraLinesData() {
    // Add target temperature line
    return ExtraLinesData(
      horizontalLines: [
        HorizontalLine(
          y: PeltierConstants.targetTemperature,
          color: AppTheme.successColor,
          strokeWidth: 2,
          dashArray: [5, 5],
          label: HorizontalLineLabel(
            show: true,
            labelResolver: (line) => 'Target: ${line.y.toStringAsFixed(1)}°C',
            style: AppTheme.captionStyle.copyWith(
              color: AppTheme.successColor,
              fontWeight: FontWeight.w500,
            ),
            alignment: Alignment.topRight,
          ),
        ),
      ],
    );
  }
}