import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../controllers/temperature_controller.dart';
import '../../models/peltier_status.dart';
import '../../utils/constants.dart';
import '../theme/app_theme.dart';
import 'settings_page.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _tempAnimation;
  double _previousTemp = 0;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      duration: const Duration(seconds: 1),
      vsync: this,
    );
    _tempAnimation = Tween<double>(begin: 0, end: 0).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<TemperatureController>(
      builder: (context, controller, child) {
        final currentTemp = controller.containerTemperature?.temperature ?? 0.0;
        
        // Animate temperature changes
        if (currentTemp != _previousTemp) {
          _tempAnimation = Tween<double>(
            begin: _previousTemp,
            end: currentTemp,
          ).animate(CurvedAnimation(
            parent: _animationController,
            curve: Curves.easeInOut,
          ));
          _animationController.forward(from: 0);
          _previousTemp = currentTemp;
        }

        return Scaffold(
          backgroundColor: AppTheme.backgroundColor,
          appBar: AppBar(
            backgroundColor: Colors.transparent,
            elevation: 0,
            title: const Text(
              'Container Temperature Control',
              style: TextStyle(
                color: AppTheme.textPrimaryColor,
                fontWeight: FontWeight.bold,
              ),
            ),
            centerTitle: true,
            actions: [
              IconButton(
                icon: Icon(
                  controller.isConnected ? Icons.wifi : Icons.wifi_off,
                  color: controller.isConnected ? AppTheme.primaryColor : AppTheme.errorColor,
                ),
                onPressed: () => _navigateToSettings(context),
              ),
            ],
          ),
          body: RefreshIndicator(
            onRefresh: () => controller.refreshData(),
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  _buildTemperatureDisplay(controller, currentTemp),
                  const SizedBox(height: 24),
                  _buildPeltierControls(controller),
                  const SizedBox(height: 24),
                  _buildTemperatureChart(controller),
                  const SizedBox(height: 16),
                  _buildStatusInfo(controller),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildTemperatureDisplay(TemperatureController controller, double currentTemp) {
    final isAtTarget = (currentTemp - PeltierConstants.targetTemperature).abs() < 
                       PeltierConstants.temperatureTolerance;
    final tempColor = isAtTarget ? AppTheme.successColor :
                      currentTemp > PeltierConstants.targetTemperature ? 
                      AppTheme.errorColor : AppTheme.primaryColor;

    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            tempColor.withValues(alpha: 0.1),
            tempColor.withValues(alpha: 0.05),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: tempColor.withValues(alpha: 0.3),
          width: 2,
        ),
      ),
      child: Column(
        children: [
          Text(
            'Container Temperature',
            style: TextStyle(
              fontSize: 16,
              color: AppTheme.textSecondaryColor,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 16),
          AnimatedBuilder(
            animation: _tempAnimation,
            builder: (context, child) {
              return Row(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _tempAnimation.value.toStringAsFixed(1),
                    style: TextStyle(
                      fontSize: 72,
                      fontWeight: FontWeight.bold,
                      color: tempColor,
                      height: 1,
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      '°C',
                      style: TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.w500,
                        color: tempColor,
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: AppTheme.surfaceColor,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.flag,
                  size: 16,
                  color: AppTheme.textSecondaryColor,
                ),
                const SizedBox(width: 8),
                Text(
                  'Target: ${PeltierConstants.targetTemperature}°C',
                  style: TextStyle(
                    color: AppTheme.textSecondaryColor,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPeltierControls(TemperatureController controller) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.cardBackgroundColor,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.ac_unit,
                color: AppTheme.primaryColor,
                size: 24,
              ),
              const SizedBox(width: 8),
              Text(
                'Peltier Controls',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textPrimaryColor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildPeltierSwitch(controller, 1),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildPeltierSwitch(controller, 2),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPeltierSwitch(TemperatureController controller, int peltierId) {
    final peltier = controller.peltierStatuses.firstWhere(
      (p) => p.id == peltierId,
      orElse: () => PeltierStatus(
        id: peltierId,
        name: 'Peltier $peltierId',
        currentTemperature: 0,
        targetTemperature: 0,
        state: PeltierState.idle,
        isConnected: false,
        lastUpdate: DateTime.now(),
      ),
    );

    final isOn = peltier.state == PeltierState.cooling;
    final isConnected = controller.isConnected && !controller.usingMockData;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surfaceColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isOn ? AppTheme.primaryColor.withValues(alpha: 0.3) : Colors.grey.withValues(alpha: 0.2),
          width: 1,
        ),
      ),
      child: Column(
        children: [
          Text(
            peltier.name,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppTheme.textPrimaryColor,
            ),
          ),
          const SizedBox(height: 12),
          Transform.scale(
            scale: 1.2,
            child: Switch.adaptive(
              value: isOn,
              onChanged: isConnected
                  ? (value) async {
                      try {
                        await controller.setPeltierOutput(peltierId, value);
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('${peltier.name} turned ${value ? "ON" : "OFF"}'),
                              backgroundColor: value ? AppTheme.successColor : AppTheme.warningColor,
                              duration: const Duration(seconds: 2),
                            ),
                          );
                        }
                      } catch (e) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('Failed to control ${peltier.name}'),
                              backgroundColor: AppTheme.errorColor,
                            ),
                          );
                        }
                      }
                    }
                  : null,
              activeColor: AppTheme.primaryColor,
              inactiveThumbColor: Colors.grey.shade400,
              inactiveTrackColor: Colors.grey.shade300,
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: isOn ? AppTheme.primaryColor.withValues(alpha: 0.1) : Colors.grey.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              isOn ? 'COOLING' : 'OFF',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: isOn ? AppTheme.primaryColor : Colors.grey,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTemperatureChart(TemperatureController controller) {
    final history = controller.temperatureHistory;
    if (history.isEmpty) {
      return Container(
        height: 200,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppTheme.cardBackgroundColor,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Center(
          child: Text(
            'No temperature data yet',
            style: TextStyle(
              color: AppTheme.textSecondaryColor,
            ),
          ),
        ),
      );
    }

    // Get the last 20 points for a cleaner chart
    final displayHistory = history.length > 20 
        ? history.sublist(history.length - 20) 
        : history;
    
    final spots = displayHistory.asMap().entries.map((entry) {
      return FlSpot(entry.key.toDouble(), entry.value.temperature);
    }).toList();

    final minY = displayHistory.map((e) => e.temperature).reduce((a, b) => a < b ? a : b) - 2;
    final maxY = displayHistory.map((e) => e.temperature).reduce((a, b) => a > b ? a : b) + 2;

    return Container(
      height: 250,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.cardBackgroundColor,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Temperature History',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: AppTheme.textPrimaryColor,
            ),
          ),
          const SizedBox(height: 16),
          Expanded(
            child: LineChart(
              LineChartData(
                minY: minY,
                maxY: maxY,
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  horizontalInterval: 5,
                  getDrawingHorizontalLine: (value) {
                    return FlLine(
                      color: AppTheme.dividerColor.withValues(alpha: 0.3),
                      strokeWidth: 1,
                    );
                  },
                ),
                titlesData: FlTitlesData(
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      interval: 5,
                      reservedSize: 40,
                      getTitlesWidget: (value, meta) {
                        return Text(
                          '${value.toInt()}°',
                          style: TextStyle(
                            color: AppTheme.textSecondaryColor,
                            fontSize: 12,
                          ),
                        );
                      },
                    ),
                  ),
                  rightTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                  topTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                  bottomTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                ),
                borderData: FlBorderData(show: false),
                lineBarsData: [
                  // Temperature line
                  LineChartBarData(
                    spots: spots,
                    isCurved: true,
                    gradient: LinearGradient(
                      colors: [
                        AppTheme.primaryColor.withValues(alpha: 0.8),
                        AppTheme.primaryColor,
                      ],
                    ),
                    barWidth: 3,
                    isStrokeCapRound: true,
                    dotData: const FlDotData(show: false),
                    belowBarData: BarAreaData(
                      show: true,
                      gradient: LinearGradient(
                        colors: [
                          AppTheme.primaryColor.withValues(alpha: 0.2),
                          AppTheme.primaryColor.withValues(alpha: 0.0),
                        ],
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                      ),
                    ),
                  ),
                  // Target line
                  LineChartBarData(
                    spots: List.generate(
                      spots.length,
                      (index) => FlSpot(index.toDouble(), PeltierConstants.targetTemperature),
                    ),
                    isCurved: false,
                    color: AppTheme.successColor.withValues(alpha: 0.5),
                    barWidth: 2,
                    isStrokeCapRound: true,
                    dotData: const FlDotData(show: false),
                    dashArray: [5, 5],
                  ),
                ],
                lineTouchData: LineTouchData(
                  touchTooltipData: LineTouchTooltipData(
                    fitInsideHorizontally: true,
                    fitInsideVertically: true,
                    getTooltipItems: (spots) {
                      return spots.map((spot) {
                        return LineTooltipItem(
                          '${spot.y.toStringAsFixed(1)}°C',
                          TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                          ),
                        );
                      }).toList();
                    },
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusInfo(TemperatureController controller) {
    final lastUpdate = controller.containerTemperature?.timestamp;
    final formattedTime = lastUpdate != null
        ? '${lastUpdate.hour.toString().padLeft(2, '0')}:${lastUpdate.minute.toString().padLeft(2, '0')}:${lastUpdate.second.toString().padLeft(2, '0')}'
        : 'Never';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surfaceColor.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildInfoItem(
            icon: Icons.update,
            label: 'Last Update',
            value: formattedTime,
          ),
          _buildInfoItem(
            icon: controller.isConnected ? Icons.link : Icons.link_off,
            label: 'PLC Status',
            value: controller.isConnected ? 'Connected' : 'Disconnected',
            valueColor: controller.isConnected ? AppTheme.successColor : AppTheme.errorColor,
          ),
          _buildInfoItem(
            icon: Icons.memory,
            label: 'Mode',
            value: controller.usingMockData ? 'Mock Data' : 'Live Data',
            valueColor: controller.usingMockData ? AppTheme.warningColor : AppTheme.successColor,
          ),
        ],
      ),
    );
  }

  Widget _buildInfoItem({
    required IconData icon,
    required String label,
    required String value,
    Color? valueColor,
  }) {
    return Column(
      children: [
        Icon(
          icon,
          size: 20,
          color: AppTheme.textSecondaryColor,
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: AppTheme.textSecondaryColor,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: valueColor ?? AppTheme.textPrimaryColor,
          ),
        ),
      ],
    );
  }

  void _navigateToSettings(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const SettingsPage()),
    );
  }
}