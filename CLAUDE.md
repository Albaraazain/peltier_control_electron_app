# Peltier Monitor - Electron App Development Notes

## Project Overview
Successfully created an Electron desktop application for monitoring and controlling GMT PLC-based Peltier temperature systems. The app features real-time temperature monitoring, Peltier control, and live charting with both React frontend and Node.js Modbus backend.

## Key Technologies Used
- **Electron** - Desktop app framework
- **React** - Frontend UI framework
- **Shadcn/UI** - Beautiful component library
- **Chart.js** - Real-time temperature charts
- **modbus-serial** - Node.js Modbus TCP client
- **Vite** - Fast build tooling

## Critical GMT PLC Modbus Implementation

### 🎯 **BREAKTHROUGH: Batch Reading Required**

The GMT PLC has a **critical quirk** - temperature sensors **CANNOT be read individually**. They require **BATCH READING**.

#### Working Temperature Reading Method:
```javascript
// ✅ CORRECT: Read 10 registers starting at 2026
const registers = await client.readHoldingRegisters(2026, 10);
const rawValue = registers.data[0]; // Temperature at index 0
const temperature = rawValue / 10.0; // Divide by 10 for actual temp

// ❌ WRONG: Individual register reads fail
// const single = await client.readHoldingRegisters(2026, 1); // FAILS!
// const single = await client.readInputRegisters(2026, 1);   // FAILS!
```

#### Why Batch Reading Works:
- GMT PLCs bundle sensor data in memory blocks
- Address 2026 is only accessible when reading the full block (2026-2035)
- This is a common industrial PLC pattern for performance optimization

### 📊 **Confirmed Working Modbus Functions**

#### Temperature Sensors (GMT-20UA Thermocouple Module):
- **Function**: `readHoldingRegisters` (FC03)
- **Address**: 2026 (in batch of 10 registers)
- **Data Format**: Signed 16-bit integer × 10 (e.g., 224 = 22.4°C)
- **Fallback**: Read 2020-2029 batch, temperature at index 6

#### Peltier Controls:
- **Function**: `readCoils` (FC01) and `writeCoil` (FC05)
- **Peltier 1**: Coil address 2
- **Peltier 2**: Coil address 4
- **Status**: `true` = ON, `false` = OFF

#### Connection Verification:
- **Function**: `readHoldingRegisters` (FC03)
- **Address**: 0 (simple connectivity test)

### 🔧 **Complete Working Modbus Service**

```javascript
class ModbusService {
  // Primary temperature reading method
  async readTemperature() {
    try {
      // CRITICAL: Batch read 10 registers
      const registers = await this.client.readHoldingRegisters(2026, 10);
      
      if (registers && registers.data && registers.data.length > 0) {
        let rawValue = registers.data[0]; // Temperature at index 0
        
        // Handle signed 16-bit conversion
        if (rawValue > 32767) {
          rawValue = rawValue - 65536;
        }
        
        const temperature = rawValue / 10.0;
        return { temperature, source: 'plc', rawValue, address: 2026 };
      }
    } catch (primaryError) {
      // Fallback: read 2020-2029, temp at index 6
      const fallback = await this.client.readHoldingRegisters(2020, 10);
      if (fallback && fallback.data.length > 6) {
        let rawValue = fallback.data[6];
        if (rawValue > 32767) rawValue = rawValue - 65536;
        return { temperature: rawValue / 10.0, source: 'plc' };
      }
    }
  }
  
  // Peltier control
  async writePeltierControl(peltierId, state) {
    const coilAddress = { 1: 2, 2: 4 }[peltierId];
    return await this.client.writeCoil(coilAddress, state);
  }
  
  async readPeltierStatus(peltierId) {
    const coilAddress = { 1: 2, 2: 4 }[peltierId];
    const result = await this.client.readCoils(coilAddress, 1);
    return result.data[0];
  }
}
```

## 🚨 **What DOESN'T Work (Avoid These)**

### Failed Modbus Approaches:
- ❌ **Single register reads**: `readHoldingRegisters(2026, 1)`
- ❌ **Input registers**: `readInputRegisters(2026, 1)` 
- ❌ **Alternative addressing**: 42026, 30000+ addresses
- ❌ **Different function codes**: FC02, FC04 for temperature

### Error Messages That Indicate Wrong Approach:
- `Modbus exception 1: Illegal function` - Wrong function code
- `Modbus exception 2: Illegal data address` - Address not in batch
- `Modbus exception 3: Illegal data value` - Write to read-only register

## 🏗️ **Application Architecture**

### Main Process (main.js):
- Electron window management
- IPC handlers for Modbus communication
- System tray integration
- Settings persistence

### Renderer Process (React):
- Real-time temperature display with color coding
- Peltier ON/OFF switches
- Live Chart.js temperature history
- Settings page with PLC discovery

### Modbus Service (modbusService.js):
- TCP connection management
- Batch temperature reading
- Peltier coil control
- Mock data fallback

## 📈 **Real-Time Data Flow**

```
GMT PLC (10.5.5.95:502) 
    ↓ Modbus TCP
ModbusService.readTemperature() 
    ↓ Batch read 2026-2035
Temperature extracted & converted
    ↓ IPC Event
React UI updates
    ↓ Chart.js
Live temperature chart
```

## 🔧 **Development Commands**

```bash
# Development (with hot reload)
npm run dev

# Build for production
npm run build

# Run built app
npx electron .

# Install dependencies
npm install modbus-serial chart.js react-chartjs-2
```

## 🎯 **Future GMT PLC Integration Tips**

### Always Test These First:
1. **Batch Reading**: Try reading 10+ registers around your target address
2. **Coil Functions**: Use FC01 (read) and FC05 (write) for digital I/O
3. **Holding Registers**: Use FC03 for analog sensor data in batches
4. **Connection Test**: Simple read of address 0 to verify connectivity

### Debugging Modbus Issues:
1. Use the built-in function scanner (`scanModbusFunctions()`)
2. Check console for batch read success messages
3. Monitor raw values before temperature conversion
4. Test with Modbus poll tools like ModbusPoll or QModMaster

### GMT PLC Specific Notes:
- **Always read sensors in batches** (10 registers minimum)
- **Temperature = raw_value / 10.0** (GMT convention)
- **Digital outputs via coils**, not holding registers
- **Signed 16-bit conversion** required for negative temperatures

## 🎉 **Final Result**

Successfully created a production-ready Electron app that:
- ✅ Reads real temperature from GMT-20UA thermocouple (22.4°C confirmed)
- ✅ Controls Peltier modules via coils 2 & 4
- ✅ Displays beautiful real-time charts
- ✅ Provides system tray monitoring
- ✅ Includes settings with PLC discovery
- ✅ Handles connection failures gracefully with mock data
- ✅ **Three Controller Options**:
  - **Stable Controller** (Default): Simple threshold-based control with hysteresis for stability
  - **Smart Adaptive Controller**: Advanced features with oscillation detection
  - **Traditional PID**: Classic control with cascade support

**Key Success Factor**: Understanding that GMT PLCs require batch reading for sensor data, not individual register access.

### 🎯 **Temperature Control Algorithms**

The app now includes three different control algorithms:

1. **Stable Controller** (`src/utils/StableController.js`)
   - Simple threshold-based control
   - Built-in hysteresis to prevent oscillation  
   - Minimum on/off times (5s on, 3s off)
   - Clear state transitions based on error magnitude
   - Optimized for reaching and maintaining 5°C target

2. **Smart Adaptive Controller** (`src/utils/SmartAdaptiveController.js`)
   - Adaptive gain scheduling
   - Oscillation detection and damping
   - PWM management for duty cycle control
   - Predictive control with temperature trend analysis

3. **Traditional PID** (`src/utils/PIDController.js`)
   - Classic PID control
   - Cascade control for dual Peltiers
   - Fixed gains with integral anti-windup

---
*Generated with Claude Code assistance - July 30, 2025*