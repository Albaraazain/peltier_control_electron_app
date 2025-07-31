const ModbusRTU = require('modbus-serial');
const { EventEmitter } = require('events');
const TemperatureControlService = require('./temperatureControlService');

class ModbusService extends EventEmitter {
  constructor() {
    super();
    this.client = new ModbusRTU();
    this.isConnected = false;
    this.config = {
      host: '10.5.5.95',
      port: 502,
      unitId: 1,
      timeout: 5000,
      thermocoupleAddress: 2026,
      peltierCoils: {
        1: 2, // Peltier 1 -> Coil 2
        2: 4  // Peltier 2 -> Coil 4
      }
    };
    this.pollingInterval = null;
    this.mockMode = false;
    this.mockData = {
      temperature: 5.2,
      peltierStates: { 1: false, 2: false },
      trend: 'increasing'
    };
    
    // Track actual Peltier states locally to avoid read timeouts
    this.actualPeltierStates = {
      1: false,
      2: false
    };
    
    // Initialize temperature control service
    this.controlService = new TemperatureControlService();
    this.controlService.initializeControllers({ setpoint: 5.0 });
    
    // Forward control service events
    this.controlService.on('controlDecision', (data) => {
      this.emit('controlDecision', data);
    });
    
    this.controlService.on('controllerChanged', (data) => {
      this.emit('controllerChanged', data);
    });
  }

  async connect(customConfig = {}) {
    this.config = { ...this.config, ...customConfig };
    
    try {
      await this.client.connectTCP(this.config.host, {
        port: this.config.port,
        timeout: this.config.timeout
      });
      
      this.client.setID(this.config.unitId);
      this.client.setTimeout(this.config.timeout);
      
      this.isConnected = true;
      this.mockMode = false;
      this.emit('connectionStatus', { connected: true, mockMode: false });
      
      console.log(`Connected to Modbus TCP at ${this.config.host}:${this.config.port}`);
      return true;
    } catch (error) {
      console.warn('Failed to connect to PLC, switching to mock mode:', error.message);
      this.isConnected = false;
      this.mockMode = true;
      this.emit('connectionStatus', { connected: false, mockMode: true });
      return false;
    }
  }

  async disconnect() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    if (this.client.isOpen) {
      await this.client.close();
    }
    
    this.isConnected = false;
    this.mockMode = false;
    this.emit('connectionStatus', { connected: false, mockMode: false });
  }

  // Comprehensive Modbus function and address scanner
  async scanModbusFunctions() {
    if (!this.isConnected) return [];

    const results = [];
    const functions = [
      { name: 'readCoils', func: 'readCoils', desc: 'Read Coils (FC01)' },
      { name: 'readDiscreteInputs', func: 'readDiscreteInputs', desc: 'Read Discrete Inputs (FC02)' },
      { name: 'readHoldingRegisters', func: 'readHoldingRegisters', desc: 'Read Holding Registers (FC03)' },
      { name: 'readInputRegisters', func: 'readInputRegisters', desc: 'Read Input Registers (FC04)' }
    ];

    // Test common address ranges for GMT PLCs
    const addressRanges = [
      // Standard addresses
      { start: 0, end: 10, desc: 'Base addresses (0-10)' },
      { start: 100, end: 110, desc: 'Common I/O (100-110)' },
      { start: 1000, end: 1010, desc: 'Data registers (1000-1010)' },
      { start: 2000, end: 2030, desc: 'Sensor range (2000-2030)' },
      { start: 2025, end: 2030, desc: 'Thermocouple range (2025-2030)' },
      
      // Alternative addressing schemes
      { start: 30000, end: 30010, desc: 'Input registers alt (30000+)' },
      { start: 40000, end: 40010, desc: 'Holding registers alt (40000+)' },
      { start: 42000, end: 42030, desc: 'Sensor alt (42000+)' }
    ];

    console.log('🔍 Starting comprehensive Modbus scan...');

    for (const func of functions) {
      console.log(`\n📡 Testing ${func.desc}...`);
      
      for (const range of addressRanges) {
        for (let addr = range.start; addr <= range.end; addr++) {
          try {
            const result = await this.client[func.func](addr, 1);
            const value = Array.isArray(result.data) ? result.data[0] : result.data;
            
            console.log(`✅ SUCCESS: ${func.desc} @ ${addr} = ${value}`);
            results.push({
              function: func.desc,
              address: addr,
              value: value,
              success: true
            });
            
            // If we find a reasonable temperature value, note it
            if (func.func.includes('Register') && value > -500 && value < 1000) {
              console.log(`🌡️  POTENTIAL TEMPERATURE: ${addr} = ${value} (${value/10}°C)`);
            }
            
          } catch (error) {
            // Only log errors for the target sensor range to reduce noise
            if (addr >= 2020 && addr <= 2030) {
              console.log(`❌ ${func.desc} @ ${addr}: ${error.message}`);
            }
          }
          
          // Small delay to avoid overwhelming the PLC
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
    }

    console.log(`\n📊 Scan complete! Found ${results.length} working addresses.`);
    return results;
  }

  async readTemperature() {
    if (this.mockMode) {
      return this.generateMockTemperature();
    }

    if (!this.isConnected) {
      throw new Error('Not connected to Modbus device');
    }

    try {
      console.log('📊 Reading container temperature using BATCH method (exactly like Flutter app)...');
      
      // PRIMARY METHOD: Read BATCH of 10 registers starting at 2026 (GMT PLC quirk - 2026 only works in batch)
      try {
        const registers = await this.client.readHoldingRegisters(2026, 10);
        
        if (registers && registers.data && registers.data.length > 0) {
          // Extract thermocouple value at index 0 (address 2026)
          // GMT thermocouples use signed 16-bit values representing temperature * 10
          let rawValue = registers.data[0];
          
          // Handle signed 16-bit conversion
          if (rawValue > 32767) {
            rawValue = rawValue - 65536;
          }
          
          // Convert to actual temperature (divide by 10)
          const temperature = rawValue / 10.0;
          
          console.log(`📊 Batch read successful! Registers 2026-2035: ${registers.data.slice(0, 5).join(', ')}...`);
          console.log(`📊 Container temperature: ${temperature.toFixed(1)}°C (raw value: ${registers.data[0]} at address 2026)`);
          
          return {
            temperature,
            timestamp: new Date(),
            source: 'plc',
            rawValue: registers.data[0],
            address: 2026,
            method: 'batch-2026'
          };
        }
      } catch (primaryError) {
        console.log(`❌ Primary batch method (2026-2035) failed: ${primaryError.message}`);
      }

      // FALLBACK METHOD: batch read starting at 2020 (thermocouple at index 6)
      try {
        console.log('📊 Trying fallback method: batch read 2020-2029...');
        
        const fallbackRegisters = await this.client.readHoldingRegisters(2020, 10);
        
        if (fallbackRegisters && fallbackRegisters.data && fallbackRegisters.data.length > 6) {
          // Thermocouple is at index 6 (address 2026 = 2020 + 6)
          let rawValue = fallbackRegisters.data[6];
          
          // Handle signed 16-bit conversion
          if (rawValue > 32767) {
            rawValue = rawValue - 65536;
          }
          
          const temperature = rawValue / 10.0;
          
          console.log(`📊 Fallback successful! Register 2026 value: ${rawValue}`);
          console.log(`📊 Container temperature: ${temperature.toFixed(1)}°C (fallback method)`);
          
          return {
            temperature,
            timestamp: new Date(),
            source: 'plc',
            rawValue: fallbackRegisters.data[6],
            address: 2026,
            method: 'batch-2020-fallback'
          };
        }
      } catch (fallbackError) {
        console.log(`❌ Fallback method also failed: ${fallbackError.message}`);
      }
      
      console.log('❌ All batch methods failed to read container temperature');
      throw new Error('Both batch reading methods failed');
      
    } catch (error) {
      console.error('Error reading temperature:', error);
      // Fallback to mock mode on error
      this.mockMode = true;
      this.emit('connectionStatus', { connected: false, mockMode: true });
      return this.generateMockTemperature();
    }
  }

  generateMockTemperature() {
    // Simulate realistic temperature variations around 5°C target
    const baseTemp = 5.0;
    const variation = (Math.random() - 0.5) * 2; // ±1°C variation
    const trend = Math.sin(Date.now() / 30000) * 0.5; // Slow oscillation
    
    this.mockData.temperature = baseTemp + variation + trend;
    
    return {
      temperature: Math.round(this.mockData.temperature * 10) / 10,
      timestamp: new Date(),
      source: 'mock'
    };
  }

  async writePeltierControl(peltierId, state) {
    const coilAddress = this.config.peltierCoils[peltierId];
    
    if (!coilAddress) {
      throw new Error(`Invalid Peltier ID: ${peltierId}`);
    }

    if (this.mockMode) {
      this.mockData.peltierStates[peltierId] = state;
      this.emit('peltierStatusChange', { peltierId, state, source: 'mock' });
      return true;
    }

    if (!this.isConnected) {
      throw new Error('Not connected to Modbus device');
    }

    try {
      // Write to digital output coil
      console.log(`🔧 PID Control: Writing Peltier ${peltierId} state: ${state ? 'ON' : 'OFF'} to coil ${coilAddress}`);
      await this.client.writeCoil(coilAddress, state);
      
      // Track state locally to avoid read timeouts
      this.actualPeltierStates[peltierId] = state;
      
      this.emit('peltierStatusChange', { peltierId, state, source: 'plc' });
      console.log(`✅ Peltier ${peltierId} successfully set to ${state ? 'ON' : 'OFF'}`);
      return true;
    } catch (error) {
      console.error(`Error controlling Peltier ${peltierId}:`, error);
      throw error;
    }
  }

  async readPeltierStatus(peltierId) {
    const coilAddress = this.config.peltierCoils[peltierId];
    
    if (!coilAddress) {
      throw new Error(`Invalid Peltier ID: ${peltierId}`);
    }

    if (this.mockMode) {
      return {
        peltierId,
        state: this.mockData.peltierStates[peltierId],
        source: 'mock'
      };
    }
    
    // Return locally tracked state to avoid timeouts
    if (this.actualPeltierStates && this.actualPeltierStates.hasOwnProperty(peltierId)) {
      return {
        peltierId,
        state: this.actualPeltierStates[peltierId],
        source: 'plc-cached'
      };
    }

    if (!this.isConnected) {
      throw new Error('Not connected to Modbus device');
    }

    try {
      const result = await this.client.readCoils(coilAddress, 1);
      return {
        peltierId,
        state: result.data[0],
        source: 'plc'
      };
    } catch (error) {
      console.error(`Error reading Peltier ${peltierId} status:`, error);
      throw error;
    }
  }

  startPolling(interval = 1000) {  // 1 second for PID control
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollingInterval = setInterval(async () => {
      try {
        const tempReading = await this.readTemperature();
        this.emit('temperatureUpdate', tempReading);
        
        // Don't read Peltier statuses - causes timeouts
        // Status is tracked from write commands
      } catch (error) {
        this.emit('error', error);
      }
    }, interval);
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  getConnectionStatus() {
    return {
      connected: this.isConnected,
      mockMode: this.mockMode,
      config: this.config
    };
  }

  async discoverPLCs(networkBase = '10.5.5') {
    const discoveries = [];
    const promises = [];
    
    // Scan common PLC IP addresses
    for (let i = 1; i <= 254; i++) {
      const ip = `${networkBase}.${i}`;
      promises.push(this.testConnection(ip, 502));
    }
    
    const results = await Promise.allSettled(promises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        discoveries.push({
          ip: `${networkBase}.${index + 1}`,
          port: 502,
          status: 'online'
        });
      }
    });
    
    return discoveries;
  }

  async testConnection(host, port) {
    const testClient = new ModbusRTU();
    
    try {
      await testClient.connectTCP(host, { port, timeout: 1000 });
      await testClient.close();
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = ModbusService;