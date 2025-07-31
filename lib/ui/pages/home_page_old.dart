import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../controllers/temperature_controller.dart';
import '../widgets/temperature_card.dart';
import '../widgets/temperature_chart.dart';
import '../widgets/status_indicator.dart';
import '../theme/app_theme.dart';
import 'settings_page.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: _buildAppBar(context),
      body: Consumer<TemperatureController>(
        builder: (context, controller, child) {
          return Padding(
            padding: const EdgeInsets.all(AppTheme.defaultPadding),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildSystemSummary(controller),
                const SizedBox(height: AppTheme.defaultPadding),
                _buildPeltierGrid(controller),
                const SizedBox(height: AppTheme.defaultPadding),
                Expanded(
                  child: _buildTemperatureChart(controller),
                ),
              ],
            ),
          );
        },
      ),
      floatingActionButton: _buildConnectionFab(context),
    );
  }

  PreferredSizeWidget _buildAppBar(BuildContext context) {
    return AppBar(
      title: const Text('Container Temperature Control'),
      actions: [
        Consumer<TemperatureController>(
          builder: (context, controller, child) {
            return StatusIndicator(
              isConnected: controller.isConnected,
              usingMockData: controller.usingMockData,
            );
          },
        ),
        IconButton(
          icon: const Icon(Icons.settings),
          onPressed: () => _navigateToSettings(context),
        ),
      ],
    );
  }

  Widget _buildSystemSummary(TemperatureController controller) {
    final summary = controller.getSystemSummary();
    
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.defaultPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Container Temperature Control',
              style: AppTheme.titleStyle,
            ),
            const SizedBox(height: AppTheme.smallPadding),
            Row(
              children: [
                Expanded(
                  child: _buildSummaryItem(
                    'Connected',
                    '${controller.connectedPeltiersCount}/${summary['totalPeltiers']}',
                    controller.isConnected ? AppTheme.successColor : AppTheme.errorColor,
                  ),
                ),
                Expanded(
                  child: _buildSummaryItem(
                    'In Target',
                    '${controller.peltiersInTargetCount}/${summary['totalPeltiers']}',
                    controller.peltiersInTargetCount == summary['totalPeltiers'] 
                        ? AppTheme.successColor 
                        : AppTheme.warningColor,
                  ),
                ),
                Expanded(
                  child: _buildSummaryItem(
                    'Container Temp',
                    controller.averageTemperature != null
                        ? '${controller.averageTemperature!.toStringAsFixed(1)}°C'
                        : '--°C',
                    controller.averageTemperature != null
                        ? AppTheme.getTemperatureStatusColor(
                            controller.averageTemperature!, 5.0)
                        : AppTheme.textSecondaryColor,
                  ),
                ),
              ],
            ),
            if (controller.errorMessage != null) ...[
              const SizedBox(height: AppTheme.smallPadding),
              Container(
                padding: const EdgeInsets.all(AppTheme.smallPadding),
                decoration: BoxDecoration(
                  color: AppTheme.errorColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.error_outline,
                      color: AppTheme.errorColor,
                      size: 16,
                    ),
                    const SizedBox(width: AppTheme.smallPadding),
                    Expanded(
                      child: Text(
                        controller.errorMessage!,
                        style: AppTheme.captionStyle.copyWith(
                          color: AppTheme.errorColor,
                        ),
                      ),
                    ),
                    TextButton(
                      onPressed: controller.clearError,
                      child: const Text('Dismiss'),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryItem(String label, String value, Color color) {
    return Column(
      children: [
        Text(
          value,
          style: AppTheme.temperatureMediumStyle.copyWith(color: color),
        ),
        Text(
          label,
          style: AppTheme.captionStyle,
        ),
      ],
    );
  }

  Widget _buildPeltierGrid(TemperatureController controller) {
    return Row(
      children: controller.peltierStatusList.map((status) {
        return Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: TemperatureCard(status: status),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildTemperatureChart(TemperatureController controller) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.defaultPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Container Temperature History',
                  style: AppTheme.titleStyle,
                ),
                Row(
                  children: [
                    if (controller.usingMockData)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppTheme.smallPadding,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: AppTheme.warningColor.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.science,
                              size: 14,
                              color: AppTheme.warningColor,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'MOCK DATA',
                              style: AppTheme.captionStyle.copyWith(
                                color: AppTheme.warningColor,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    const SizedBox(width: AppTheme.smallPadding),
                    IconButton(
                      icon: const Icon(Icons.clear_all),
                      onPressed: controller.clearTemperatureHistory,
                      tooltip: 'Clear History',
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: AppTheme.smallPadding),
            Expanded(
              child: TemperatureChart(
                controller: controller,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildConnectionFab(BuildContext context) {
    return Consumer<TemperatureController>(
      builder: (context, controller, child) {
        if (controller.isConnecting) {
          return FloatingActionButton(
            onPressed: null,
            child: const CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
            ),
          );
        }

        return FloatingActionButton(
          onPressed: controller.isConnected 
              ? () => _showDisconnectDialog(context, controller)
              : () => _showConnectDialog(context, controller),
          backgroundColor: controller.isConnected 
              ? AppTheme.errorColor 
              : AppTheme.primaryColor,
          child: Icon(
            controller.isConnected ? Icons.stop : Icons.play_arrow,
          ),
        );
      },
    );
  }

  void _navigateToSettings(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => const SettingsPage(),
      ),
    );
  }

  void _showConnectDialog(BuildContext context, TemperatureController controller) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Connect to PLC'),
        content: Text(
          'Connect to PLC at ${controller.host}:${controller.port}?\n\n'
          'If connection fails, the app will use simulated data for testing.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              controller.connect();
            },
            child: const Text('Connect'),
          ),
        ],
      ),
    );
  }

  void _showDisconnectDialog(BuildContext context, TemperatureController controller) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Disconnect'),
        content: const Text('Disconnect from the data source?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              controller.disconnect();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.errorColor,
            ),
            child: const Text('Disconnect'),
          ),
        ],
      ),
    );
  }
}