import 'package:flutter/material.dart';
import 'package:modbus_client_tcp/modbus_client_tcp.dart';
import 'package:provider/provider.dart';
import '../../controllers/temperature_controller.dart';
import '../../utils/constants.dart';
import '../theme/app_theme.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  final _hostController = TextEditingController();
  final _portController = TextEditingController();
  final _unitIdController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    final controller = context.read<TemperatureController>();
    _hostController.text = controller.host;
    _portController.text = controller.port.toString();
    _unitIdController.text = controller.unitId.toString();
  }

  @override
  void dispose() {
    _hostController.dispose();
    _portController.dispose();
    _unitIdController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
        actions: [
          TextButton(
            onPressed: _saveSettings,
            child: const Text(
              'Save',
              style: TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(AppTheme.defaultPadding),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildConnectionSettings(),
                const SizedBox(height: AppTheme.largePadding),
                _buildSystemInfo(),
                const SizedBox(height: AppTheme.largePadding),
                _buildActions(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildConnectionSettings() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.defaultPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'PLC Connection',
              style: AppTheme.titleStyle,
            ),
            const SizedBox(height: AppTheme.defaultPadding),
            TextFormField(
              controller: _hostController,
              decoration: const InputDecoration(
                labelText: 'Host IP Address',
                hintText: '192.168.1.100',
                prefixIcon: Icon(Icons.computer),
              ),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Please enter a host IP address';
                }
                // Basic IP validation
                final parts = value.split('.');
                if (parts.length != 4) {
                  return 'Please enter a valid IP address';
                }
                try {
                  for (final part in parts) {
                    final num = int.parse(part);
                    if (num < 0 || num > 255) {
                      return 'Please enter a valid IP address';
                    }
                  }
                } catch (e) {
                  return 'Please enter a valid IP address';
                }
                return null;
              },
            ),
            const SizedBox(height: AppTheme.defaultPadding),
            TextFormField(
              controller: _portController,
              decoration: const InputDecoration(
                labelText: 'Port',
                hintText: '502',
                prefixIcon: Icon(Icons.settings_ethernet),
              ),
              keyboardType: TextInputType.number,
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Please enter a port number';
                }
                try {
                  final port = int.parse(value);
                  if (port < 1 || port > 65535) {
                    return 'Port must be between 1 and 65535';
                  }
                } catch (e) {
                  return 'Please enter a valid port number';
                }
                return null;
              },
            ),
            const SizedBox(height: AppTheme.defaultPadding),
            TextFormField(
              controller: _unitIdController,
              decoration: const InputDecoration(
                labelText: 'Unit ID',
                hintText: '1',
                prefixIcon: Icon(Icons.tag),
              ),
              keyboardType: TextInputType.number,
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Please enter a unit ID';
                }
                try {
                  final unitId = int.parse(value);
                  if (unitId < 1 || unitId > 255) {
                    return 'Unit ID must be between 1 and 255';
                  }
                } catch (e) {
                  return 'Please enter a valid unit ID';
                }
                return null;
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSystemInfo() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.defaultPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'System Information',
              style: AppTheme.titleStyle,
            ),
            const SizedBox(height: AppTheme.defaultPadding),
            _buildInfoRow('Target Temperature', '${PeltierConstants.targetTemperature}°C'),
            _buildInfoRow('Temperature Tolerance', '±${PeltierConstants.temperatureTolerance}°C'),
            _buildInfoRow('Polling Interval', '${ModbusConstants.defaultPollingInterval.inSeconds}s'),
            _buildInfoRow('Max History Points', '${AppConstants.maxHistoryPoints}'),
            Consumer<TemperatureController>(
              builder: (context, controller, child) {
                return Column(
                  children: [
                    _buildInfoRow('Current Status', 
                        controller.isConnected ? 'Connected' : 'Disconnected'),
                    if (controller.usingMockData)
                      _buildInfoRow('Data Source', 'Mock Data (Simulation)', 
                          textColor: AppTheme.warningColor),
                    if (!controller.usingMockData && controller.isConnected)
                      _buildInfoRow('Data Source', 'Real PLC Data', 
                          textColor: AppTheme.successColor),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, {Color? textColor}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: AppTheme.bodyStyle,
          ),
          Text(
            value,
            style: AppTheme.bodyStyle.copyWith(
              fontWeight: FontWeight.w500,
              color: textColor ?? AppTheme.textPrimaryColor,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActions() {
    return Consumer<TemperatureController>(
      builder: (context, controller, child) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Actions',
              style: AppTheme.titleStyle,
            ),
            const SizedBox(height: AppTheme.defaultPadding),
            ElevatedButton.icon(
              onPressed: controller.isConnected ? null : () => _testConnection(),
              icon: const Icon(Icons.network_check),
              label: const Text('Test Connection'),
            ),
            const SizedBox(height: AppTheme.smallPadding),
            ElevatedButton.icon(
              onPressed: _discoverPLC,
              icon: const Icon(Icons.search),
              label: const Text('Discover PLC'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.secondaryColor,
              ),
            ),
            const SizedBox(height: AppTheme.smallPadding),
            ElevatedButton.icon(
              onPressed: controller.clearTemperatureHistory,
              icon: const Icon(Icons.clear_all),
              label: const Text('Clear History'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.warningColor,
              ),
            ),
            const SizedBox(height: AppTheme.smallPadding),
            if (controller.isConnected)
              ElevatedButton.icon(
                onPressed: controller.reconnect,
                icon: const Icon(Icons.refresh),
                label: const Text('Reconnect'),
              ),
          ],
        );
      },
    );
  }

  void _saveSettings() {
    if (_formKey.currentState!.validate()) {
      // Settings are saved when connection is attempted
      Navigator.of(context).pop();
      
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Settings saved'),
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  void _testConnection() {
    if (!_formKey.currentState!.validate()) return;

    final controller = context.read<TemperatureController>();
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Test Connection'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: AppTheme.defaultPadding),
            Text(
              'Testing connection to ${_hostController.text}:${_portController.text}...',
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );

    controller.connect(
      host: _hostController.text,
      port: int.parse(_portController.text),
      unitId: int.parse(_unitIdController.text),
    ).then((success) {
      if (!mounted) return;
      
      Navigator.of(context).pop(); // Close dialog
      
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(success ? 'Connection Successful' : 'Connection Failed'),
          content: Text(
            success 
                ? controller.usingMockData
                    ? 'PLC connection failed, using simulated data for testing'
                    : 'Successfully connected to PLC'
                : 'Failed to connect to PLC',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('OK'),
            ),
          ],
        ),
      );
    });
  }

  void _discoverPLC() async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: const Text('Discovering PLC'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: AppTheme.defaultPadding),
            const Text('Scanning network for Modbus devices...'),
            const SizedBox(height: AppTheme.smallPadding),
            Text(
              'This may take a few moments',
              style: AppTheme.captionStyle,
            ),
          ],
        ),
      ),
    );

    try {
      // Get the network base (assumes 192.168.x.x network)
      final hostIP = _hostController.text.isNotEmpty 
          ? _hostController.text 
          : '192.168.1.1';
      
      // Extract network base from current host setting
      final parts = hostIP.split('.');
      final networkBase = '${parts[0]}.${parts[1]}.${parts[2]}.1';
      
      print('🔍 DISCOVERY: Starting scan from $networkBase');
      
      // Use the discovery feature from modbus_client_tcp
      final discoveredIP = await ModbusClientTcp.discover(networkBase);
      
      if (!mounted) return;
      Navigator.of(context).pop(); // Close discovery dialog
      
      if (discoveredIP != null) {
        // Update the host field with discovered IP
        _hostController.text = discoveredIP;
        
        showDialog(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('PLC Discovered!'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.check_circle,
                  color: AppTheme.successColor,
                  size: 48,
                ),
                const SizedBox(height: AppTheme.defaultPadding),
                Text('Found Modbus device at:'),
                const SizedBox(height: AppTheme.smallPadding),
                Text(
                  discoveredIP,
                  style: AppTheme.titleStyle.copyWith(
                    color: AppTheme.primaryColor,
                  ),
                ),
                const SizedBox(height: AppTheme.defaultPadding),
                const Text('The IP address has been automatically filled in. You can now test the connection.'),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('OK'),
              ),
              ElevatedButton(
                onPressed: () {
                  Navigator.of(context).pop();
                  _testConnection();
                },
                child: const Text('Test Connection'),
              ),
            ],
          ),
        );
      } else {
        showDialog(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('No PLC Found'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.error_outline,
                  color: AppTheme.warningColor,
                  size: 48,
                ),
                const SizedBox(height: AppTheme.defaultPadding),
                const Text('No Modbus devices found on the network.'),
                const SizedBox(height: AppTheme.defaultPadding),
                const Text('Make sure:'),
                const SizedBox(height: AppTheme.smallPadding),
                const Text('• PLC is connected to WiFi'),
                const Text('• Modbus TCP is enabled on PLC'),
                const Text('• Both devices are on same network'),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('OK'),
              ),
            ],
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      Navigator.of(context).pop(); // Close discovery dialog
      
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Discovery Error'),
          content: Text('Error during discovery: $e'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('OK'),
            ),
          ],
        ),
      );
    }
  }
}