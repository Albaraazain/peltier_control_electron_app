const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let tray;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets/icon.png'),
    titleBarStyle: 'default'
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile('dist/index.html');
  }

  mainWindow.on('minimize', () => {
    if (process.platform === 'darwin') {
      mainWindow.hide();
    }
  });

  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin') {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, 'assets/tray-icon.png');
    if (!require('fs').existsSync(iconPath)) {
      console.log('Tray icon not found, skipping tray creation');
      return;
    }
    tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Peltier Monitor',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: 'Temperature Status',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Peltier Monitor');
  tray.setContextMenu(contextMenu);
  
  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
  } catch (error) {
    console.log('Could not create tray:', error.message);
  }
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  app.isQuiting = true;
});

// Modbus service integration
const ModbusService = require('./src/services/modbusService');
const modbusService = new ModbusService();

// Settings storage
const fs = require('fs');
const settingsPath = path.join(__dirname, 'settings.json');

function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  
  return {
    modbus: {
      host: '10.5.5.95',
      port: 502,
      unitId: 1,
      timeout: 5000
    },
    ui: {
      theme: 'light',
      pollingInterval: 2000,
      maxDataPoints: 100
    },
    pid: {
      kp: 5.0,
      ki: 1.2,
      kd: 0.5,
      cascadeThreshold: 50,
      balanceRatio: 0.6
    }
  };
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
}

// IPC handlers
ipcMain.handle('modbus:connect', async (event, config) => {
  try {
    const result = await modbusService.connect(config);
    if (result) {
      modbusService.startPolling();
    }
    return result;
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('modbus:disconnect', async () => {
  try {
    await modbusService.disconnect();
    return true;
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('modbus:read-temperature', async () => {
  try {
    return await modbusService.readTemperature();
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('modbus:write-peltier', async (event, peltierId, state) => {
  try {
    console.log(`[Main Process] Received Peltier control request: Peltier ${peltierId} -> ${state ? 'ON' : 'OFF'}`);
    return await modbusService.writePeltierControl(peltierId, state);
  } catch (error) {
    console.error(`[Main Process] Peltier control error:`, error);
    return { error: error.message };
  }
});

ipcMain.handle('modbus:discover', async (event, networkBase) => {
  try {
    return await modbusService.discoverPLCs(networkBase);
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('modbus:scan-functions', async () => {
  try {
    return await modbusService.scanModbusFunctions();
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('settings:save', async (event, settings) => {
  return saveSettings(settings);
});

ipcMain.handle('settings:load', async () => {
  return loadSettings();
});

ipcMain.handle('system:info', async () => {
  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    electronVersion: process.versions.electron
  };
});

// PID Settings handlers
ipcMain.handle('pid:save-settings', async (event, pidParams) => {
  try {
    const settings = loadSettings();
    settings.pid = { ...settings.pid, ...pidParams };
    const success = saveSettings(settings);
    return { success };
  } catch (error) {
    console.error('Failed to save PID settings:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('pid:get-settings', async () => {
  try {
    const settings = loadSettings();
    return { success: true, params: settings.pid };
  } catch (error) {
    console.error('Failed to get PID settings:', error);
    return { success: false, error: error.message };
  }
});

// Forward Modbus events to renderer
modbusService.on('temperatureUpdate', (data) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('temperature:update', data);
  }
  
  // Update tray tooltip with current temperature
  if (tray) {
    tray.setToolTip(`Peltier Monitor - ${data.temperature.toFixed(1)}°C`);
  }
});

modbusService.on('connectionStatus', (status) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('modbus:connection-status', status);
  }
});

modbusService.on('peltierStatusChange', (status) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('peltier:status-change', status);
  }
});

// Auto-connect on startup
app.whenReady().then(async () => {
  const settings = loadSettings();
  try {
    await modbusService.connect(settings.modbus);
    modbusService.startPolling(1000);  // 1 second for PID control
  } catch (error) {
    console.log('Auto-connect failed, will use mock mode');
  }
});