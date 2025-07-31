import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/peltier_status.dart';
import '../../controllers/temperature_controller.dart';
import '../theme/app_theme.dart';

class TemperatureCard extends StatelessWidget {
  final PeltierStatus status;

  const TemperatureCard({
    super.key,
    required this.status,
  });

  @override
  Widget build(BuildContext context) {
    final statusColor = _getStatusColor();
    
    return Container(
      decoration: AppTheme.statusCardDecoration(statusColor),
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.defaultPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildHeader(),
            const SizedBox(height: AppTheme.smallPadding),
            _buildTemperatureDisplay(),
            const SizedBox(height: AppTheme.smallPadding),
            _buildStatusRow(),
            const SizedBox(height: AppTheme.smallPadding),
            _buildControlButtons(context),
            if (status.powerConsumption != null) ...[
              const SizedBox(height: AppTheme.smallPadding),
              _buildPowerConsumption(),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          status.name,
          style: AppTheme.titleStyle,
        ),
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: _getStatusColor(),
            shape: BoxShape.circle,
          ),
        ),
      ],
    );
  }

  Widget _buildTemperatureDisplay() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text(
              status.currentTemperature.toStringAsFixed(1),
              style: AppTheme.temperatureLargeStyle.copyWith(
                color: AppTheme.getTemperatureStatusColor(
                  status.currentTemperature,
                  status.targetTemperature,
                ),
              ),
            ),
            Text(
              '°C',
              style: AppTheme.temperatureMediumStyle.copyWith(
                color: AppTheme.textSecondaryColor,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Row(
          children: [
            Icon(
              Icons.adjust,
              size: 12,
              color: AppTheme.textSecondaryColor,
            ),
            const SizedBox(width: 4),
            Text(
              'Target: ${status.targetTemperature.toStringAsFixed(1)}°C (Container Air)',
              style: AppTheme.captionStyle,
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildStatusRow() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        _buildStatusChip(),
        if (status.isInTarget)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: AppTheme.successColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.check_circle,
                  size: 12,
                  color: AppTheme.successColor,
                ),
                const SizedBox(width: 2),
                Text(
                  'In Range',
                  style: AppTheme.captionStyle.copyWith(
                    color: AppTheme.successColor,
                    fontSize: 10,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildStatusChip() {
    final statusText = _getStatusText();
    final statusColor = _getStatusColor();
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: statusColor.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: statusColor.withValues(alpha: 0.3),
          width: 1,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _getStatusIcon(),
          const SizedBox(width: 4),
          Text(
            statusText,
            style: AppTheme.captionStyle.copyWith(
              color: statusColor,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildControlButtons(BuildContext context) {
    final controller = Provider.of<TemperatureController>(context, listen: false);
    final isOn = status.state == PeltierState.cooling;
    
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        Expanded(
          child: ElevatedButton.icon(
            onPressed: status.isConnected && !controller.usingMockData
                ? () => _setPeltierOutput(controller, false)
                : null,
            icon: const Icon(Icons.stop, size: 16),
            label: const Text('OFF'),
            style: ElevatedButton.styleFrom(
              backgroundColor: !isOn ? AppTheme.errorColor : Colors.grey,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 8),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: ElevatedButton.icon(
            onPressed: status.isConnected && !controller.usingMockData
                ? () => _setPeltierOutput(controller, true)
                : null,
            icon: const Icon(Icons.ac_unit, size: 16),
            label: const Text('ON'),
            style: ElevatedButton.styleFrom(
              backgroundColor: isOn ? AppTheme.primaryColor : Colors.grey,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 8),
            ),
          ),
        ),
      ],
    );
  }

  void _setPeltierOutput(TemperatureController controller, bool enabled) async {
    await controller.setPeltierOutput(status.id, enabled);
  }

  Widget _buildPowerConsumption() {
    return Row(
      children: [
        Icon(
          Icons.flash_on,
          size: 14,
          color: AppTheme.textSecondaryColor,
        ),
        const SizedBox(width: 4),
        Text(
          '${status.powerConsumption!.toStringAsFixed(1)}W',
          style: AppTheme.captionStyle,
        ),
      ],
    );
  }

  Color _getStatusColor() {
    if (!status.isConnected) {
      return AppTheme.temperatureOffline;
    }
    
    switch (status.state) {
      case PeltierState.idle:
        return status.isInTarget 
            ? AppTheme.successColor 
            : AppTheme.warningColor;
      case PeltierState.cooling:
        return AppTheme.primaryColor;
      case PeltierState.heating:
        return AppTheme.warningColor;
      case PeltierState.error:
        return AppTheme.errorColor;
    }
  }

  String _getStatusText() {
    if (!status.isConnected) {
      return 'Offline';
    }
    
    switch (status.state) {
      case PeltierState.idle:
        return 'Idle';
      case PeltierState.cooling:
        return 'Cooling';
      case PeltierState.heating:
        return 'Heating';
      case PeltierState.error:
        return 'Error';
    }
  }

  Widget _getStatusIcon() {
    if (!status.isConnected) {
      return Icon(
        Icons.wifi_off,
        size: 12,
        color: AppTheme.temperatureOffline,
      );
    }
    
    switch (status.state) {
      case PeltierState.idle:
        return Icon(
          Icons.pause,
          size: 12,
          color: _getStatusColor(),
        );
      case PeltierState.cooling:
        return Icon(
          Icons.ac_unit,
          size: 12,
          color: _getStatusColor(),
        );
      case PeltierState.heating:
        return Icon(
          Icons.whatshot,
          size: 12,
          color: _getStatusColor(),
        );
      case PeltierState.error:
        return Icon(
          Icons.error,
          size: 12,
          color: _getStatusColor(),
        );
    }
  }
}