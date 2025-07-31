const { EventEmitter } = require('events');
const { RBFAdaptivePIDController } = require('../utils/RBFAdaptivePIDController');

class TemperatureControlService extends EventEmitter {
  constructor() {
    super();
    
    // Neural ML controller
    this.controller = null;
    
    // Control state
    this.isEnabled = false;
    this.lastUpdate = null;
    this.updateInterval = null;
    
    // Performance tracking
    this.performanceHistory = [];
    this.maxHistorySize = 100;
  }
  
  /**
   * Initialize the RBF Adaptive PID controller
   */
  initializeControllers(config = {}) {
    // RBF Neural Network-based Adaptive PID Controller
    this.controller = new RBFAdaptivePIDController({
      setpoint: config.setpoint || 5.0,
      kp: config.kp || 2.0,
      ki: config.ki || 0.5,
      kd: config.kd || 0.3,
      numCenters: config.numCenters || 5,
      learningRate: config.learningRate || 0.01,
      spread: config.spread || 2.0,
      nonlinearGain: config.nonlinearGain || 1.5
    });
    
    console.log('✅ RBF Adaptive PID temperature controller initialized');
  }
  
  
  /**
   * Enable/disable automatic control
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    
    if (!enabled && this.controller) {
      // Reset controller when disabling
      this.controller.reset();
    }
    
    console.log(`🔧 RBF Adaptive PID temperature control ${enabled ? 'enabled' : 'disabled'}`);
    this.emit('controlStateChanged', { enabled });
    
    return true;
  }
  
  /**
   * Process temperature update and return control actions
   */
  processTemperature(temperature) {
    if (!this.isEnabled || !this.controller) {
      return null;
    }
    
    const startTime = Date.now();
    
    // Get control decision from neural controller
    const controlResult = this.controller.update(temperature);
    
    if (!controlResult) {
      return null;
    }
    
    // Track performance
    const processingTime = Date.now() - startTime;
    this.trackPerformance({
      controller: 'rbf-pid',
      temperature,
      error: controlResult.error,
      peltier1: controlResult.peltier1,
      peltier2: controlResult.peltier2,
      processingTime,
      timestamp: controlResult.timestamp,
      stable: controlResult.stable,
      gains: controlResult.gains
    });
    
    // Emit control decision
    this.emit('controlDecision', {
      controller: 'rbf-pid',
      temperature,
      setpoint: controlResult.setpoint,
      peltier1: controlResult.peltier1,
      peltier2: controlResult.peltier2,
      error: controlResult.error,
      stable: controlResult.stable,
      gains: controlResult.gains,
      pid: controlResult.pid,
      metrics: this.controller.getMetrics ? this.controller.getMetrics() : null
    });
    
    this.lastUpdate = Date.now();
    
    return {
      peltier1: controlResult.peltier1,
      peltier2: controlResult.peltier2,
      controller: 'rbf-pid',
      metrics: controlResult
    };
  }
  
  /**
   * Set new temperature setpoint
   */
  setSetpoint(setpoint) {
    if (this.controller && this.controller.setSetpoint) {
      this.controller.setSetpoint(setpoint);
    }
    
    console.log(`🎯 Temperature setpoint changed to ${setpoint}°C`);
    this.emit('setpointChanged', { setpoint });
  }
  
  /**
   * Get current controller configuration
   */
  getConfiguration() {
    return {
      controller: 'rbf-pid',
      enabled: this.isEnabled,
      lastUpdate: this.lastUpdate
    };
  }
  
  /**
   * Get RBF Adaptive PID controller parameters
   */
  getControllerParams() {
    if (!this.controller) return null;
    
    return {
      setpoint: this.controller.setpoint,
      kp: this.controller.kp,
      ki: this.controller.ki,
      kd: this.controller.kd,
      numCenters: this.controller.numCenters,
      learningRate: this.controller.learningRate,
      spread: this.controller.spread,
      nonlinearGain: this.controller.nonlinearGain
    };
  }
  
  /**
   * Update RBF Adaptive PID controller parameters
   */
  updateControllerParams(params) {
    if (!this.controller) return false;
    
    // Update parameters
    Object.keys(params).forEach(key => {
      if (this.controller.hasOwnProperty(key)) {
        this.controller[key] = params[key];
      }
    });
    
    console.log(`📝 Updated RBF Adaptive PID controller parameters:`, params);
    this.emit('controllerParamsUpdated', { type: 'rbf-pid', params });
    
    return true;
  }
  
  /**
   * Track performance metrics
   */
  trackPerformance(data) {
    this.performanceHistory.push(data);
    
    if (this.performanceHistory.length > this.maxHistorySize) {
      this.performanceHistory.shift();
    }
  }
  
  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    if (this.performanceHistory.length === 0) {
      return null;
    }
    
    const recent = this.performanceHistory.slice(-20);
    const errors = recent.map(p => Math.abs(p.error));
    const avgError = errors.reduce((a, b) => a + b, 0) / errors.length;
    const maxError = Math.max(...errors);
    const minError = Math.min(...errors);
    const stableCount = recent.filter(p => p.stable).length;
    const stabilityRate = stableCount / recent.length;
    
    return {
      overall: {
        avgError,
        maxError,
        minError,
        stabilityRate,
        totalSamples: this.performanceHistory.length
      },
      rbfPid: {
        avgError,
        samples: this.performanceHistory.length,
        avgProcessingTime: recent.reduce((a, b) => a + b.processingTime, 0) / recent.length
      },
      current: {
        controller: 'rbf-pid',
        enabled: this.isEnabled,
        lastUpdate: this.lastUpdate
      }
    };
  }
  
  /**
   * Export RBF network weights and parameters
   */
  exportRBFModel() {
    if (!this.controller) return null;
    
    return {
      weights: this.controller.weights,
      centers: this.controller.centers,
      gains: { kp: this.controller.kp, ki: this.controller.ki, kd: this.controller.kd },
      parameters: {
        numCenters: this.controller.numCenters,
        learningRate: this.controller.learningRate,
        spread: this.controller.spread,
        nonlinearGain: this.controller.nonlinearGain
      }
    };
  }
  
  /**
   * Import RBF network weights and parameters
   */
  importRBFModel(model) {
    if (!this.controller || !model) return false;
    
    try {
      if (model.weights) this.controller.weights = model.weights;
      if (model.centers) this.controller.centers = model.centers;
      if (model.gains) {
        this.controller.kp = model.gains.kp;
        this.controller.ki = model.gains.ki;
        this.controller.kd = model.gains.kd;
      }
      if (model.parameters) {
        Object.keys(model.parameters).forEach(key => {
          if (this.controller.hasOwnProperty(key)) {
            this.controller[key] = model.parameters[key];
          }
        });
      }
      
      console.log('✅ RBF model imported successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to import RBF model:', error);
      return false;
    }
  }
  
  /**
   * Reset RBF Adaptive PID controller
   */
  reset() {
    if (this.controller && this.controller.reset) {
      this.controller.reset();
    }
    
    this.performanceHistory = [];
    this.lastUpdate = null;
    
    console.log('🔄 RBF Adaptive PID controller reset');
    this.emit('controllersReset');
  }
}

module.exports = TemperatureControlService;