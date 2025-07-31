const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Modbus communication
  connectToModbus: (config) => ipcRenderer.invoke('modbus:connect', config),
  disconnectModbus: () => ipcRenderer.invoke('modbus:disconnect'),
  readTemperature: () => ipcRenderer.invoke('modbus:read-temperature'),
  writePeltierControl: (peltierId, state) => ipcRenderer.invoke('modbus:write-peltier', peltierId, state),
  discoverPLCs: (networkBase) => ipcRenderer.invoke('modbus:discover', networkBase),
  scanModbusFunctions: () => ipcRenderer.invoke('modbus:scan-functions'),
  
  // Settings
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  
  // PID Settings
  savePIDSettings: (pidParams) => ipcRenderer.invoke('pid:save-settings', pidParams),
  getPIDSettings: () => ipcRenderer.invoke('pid:get-settings'),
  
  // System
  getSystemInfo: () => ipcRenderer.invoke('system:info'),
  
  // Events
  onTemperatureUpdate: (callback) => {
    ipcRenderer.on('temperature:update', callback);
    return () => ipcRenderer.removeListener('temperature:update', callback);
  },
  
  onConnectionStatusChange: (callback) => {
    ipcRenderer.on('modbus:connection-status', callback);
    return () => ipcRenderer.removeListener('modbus:connection-status', callback);
  },
  
  onPeltierStatusChange: (callback) => {
    ipcRenderer.on('peltier:status-change', callback);
    return () => ipcRenderer.removeListener('peltier:status-change', callback);
  }
});