import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class StatusIndicator extends StatelessWidget {
  final bool isConnected;
  final bool usingMockData;

  const StatusIndicator({
    super.key,
    required this.isConnected,
    required this.usingMockData,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(right: AppTheme.defaultPadding),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildConnectionIndicator(),
          const SizedBox(width: AppTheme.smallPadding),
          _buildDataSourceIndicator(),
        ],
      ),
    );
  }

  Widget _buildConnectionIndicator() {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppTheme.smallPadding,
        vertical: 4,
      ),
      decoration: BoxDecoration(
        color: isConnected 
            ? AppTheme.successColor.withValues(alpha: 0.1)
            : AppTheme.errorColor.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isConnected 
              ? AppTheme.successColor.withValues(alpha: 0.3)
              : AppTheme.errorColor.withValues(alpha: 0.3),
          width: 1,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: isConnected ? AppTheme.successColor : AppTheme.errorColor,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 4),
          Text(
            isConnected ? 'Connected' : 'Disconnected',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: isConnected ? AppTheme.successColor : AppTheme.errorColor,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDataSourceIndicator() {
    if (!isConnected) {
      return const SizedBox.shrink();
    }

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppTheme.smallPadding,
        vertical: 4,
      ),
      decoration: BoxDecoration(
        color: usingMockData 
            ? AppTheme.warningColor.withValues(alpha: 0.1)
            : AppTheme.primaryColor.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: usingMockData 
              ? AppTheme.warningColor.withValues(alpha: 0.3)
              : AppTheme.primaryColor.withValues(alpha: 0.3),
          width: 1,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            usingMockData ? Icons.science : Icons.cable,
            size: 12,
            color: usingMockData ? AppTheme.warningColor : AppTheme.primaryColor,
          ),
          const SizedBox(width: 4),
          Text(
            usingMockData ? 'MOCK' : 'PLC',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: usingMockData ? AppTheme.warningColor : AppTheme.primaryColor,
            ),
          ),
        ],
      ),
    );
  }
}