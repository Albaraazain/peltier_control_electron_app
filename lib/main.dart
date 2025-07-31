import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'controllers/temperature_controller.dart';
import 'services/temperature_repository.dart';
// import 'services/modbus_service.dart';
// import 'services/modbus_simple_service.dart';
import 'services/custom_modbus_service.dart';
import 'ui/pages/home_page.dart';
import 'ui/theme/app_theme.dart';
import 'utils/constants.dart';

void main() {
  runApp(const PeltierMonitorApp());
}

class PeltierMonitorApp extends StatelessWidget {
  const PeltierMonitorApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<CustomModbusService>(
          create: (_) => CustomModbusService(),
          dispose: (_, service) => service.dispose(),
        ),
        ProxyProvider<CustomModbusService, TemperatureRepository>(
          create: (context) => TemperatureRepository(
            context.read<CustomModbusService>(),
          ),
          update: (context, modbusService, previous) =>
              previous ?? TemperatureRepository(modbusService),
          dispose: (_, repository) => repository.dispose(),
        ),
        ChangeNotifierProxyProvider<TemperatureRepository, TemperatureController>(
          create: (context) => TemperatureController(
            context.read<TemperatureRepository>(),
          ),
          update: (context, repository, previous) =>
              previous ?? TemperatureController(repository),
        ),
      ],
      child: MaterialApp(
        title: AppConstants.appTitle,
        theme: AppTheme.lightTheme,
        home: const HomePage(),
        debugShowCheckedModeBanner: false,
      ),
    );
  }
}