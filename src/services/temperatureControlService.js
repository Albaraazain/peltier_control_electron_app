const { EventEmitter } = require('events');
const { NeuralMPCController } = require('../utils/NeuralMPCController');

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
   * Initialize the neural controller
   */
  initializeControllers(config = {}) {
    // Neural MPC Controller - Machine Learning based
    this.controller = new NeuralMPCController({
      setpoint: config.setpoint || 5.0,
      predictionHorizon: config.predictionHorizon || 10,
      controlHorizon: config.controlHorizon || 3,
      hiddenSize: config.hiddenSize || 16,
      learningRate: config.learningRate || 0.001
    });
    
    console.log('✅ Neural ML temperature controller initialized');
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
    
    console.log(`🔧 Neural ML temperature control ${enabled ? 'enabled' : 'disabled'}`);
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
      controller: 'neural',
      temperature,
      error: controlResult.error,
      peltier1: controlResult.peltier1,
      peltier2: controlResult.peltier2,
      processingTime,
      timestamp: controlResult.timestamp,
      modelConfidence: controlResult.modelConfidence || null,
      stable: controlResult.stable
    });
    
    // Emit control decision
    this.emit('controlDecision', {
      controller: 'neural',
      temperature,
      setpoint: controlResult.setpoint,
      peltier1: controlResult.peltier1,
      peltier2: controlResult.peltier2,
      error: controlResult.error,
      stable: controlResult.stable,
      metrics: this.controller.getMetrics ? this.controller.getMetrics() : null
    });
    
    this.lastUpdate = Date.now();
    
    return {
      peltier1: controlResult.peltier1,
      peltier2: controlResult.peltier2,
      controller: 'neural',
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
      controller: 'neural',
      enabled: this.isEnabled,
      lastUpdate: this.lastUpdate
    };
  }
  
  /**
   * Get neural controller parameters
   */
  getControllerParams() {
    if (!this.controller) return null;
    
    return {
      setpoint: this.controller.setpoint,
      predictionHorizon: this.controller.predictionHorizon,
      controlHorizon: this.controller.controlHorizon,
      hiddenSize: this.controller.hiddenSize,
      learningRate: this.controller.learningRate,
      modelConfidence: this.controller.modelConfidence
    };
  }
  
  /**
   * Update neural controller parameters
   */
  updateControllerParams(params) {
    if (!this.controller) return false;
    
    // Update parameters
    Object.keys(params).forEach(key => {
      if (this.controller.hasOwnProperty(key)) {
        this.controller[key] = params[key];
      }
    });
    
    console.log(`📝 Updated neural controller parameters:`, params);
    this.emit('controllerParamsUpdated', { type: 'neural', params });
    
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
      neural: {
        avgError,
        samples: this.performanceHistory.length,
        avgProcessingTime: recent.reduce((a, b) => a + b.processingTime, 0) / recent.length
      },
      current: {
        controller: 'neural',
        enabled: this.isEnabled,
        lastUpdate: this.lastUpdate
      }
    };
  }
  
  /**
   * Export neural network model (if using neural controller)
   */
  exportNeuralModel() {
    if (this.controllers.neural && this.controllers.neural.exportModel) {
      return this.controllers.neural.exportModel();
    }
    return null;
  }
  
  /**
   * Import neural network model
   */
  importNeuralModel(model) {
    if (this.controllers.neural && this.controllers.neural.importModel) {
      this.controllers.neural.importModel(model);
      console.log('✅ Neural model imported successfully');
      return true;
    }
    return false;
  }
  
  /**
   * Reset all controllers
   */
  reset() {
    Object.values(this.controllers).forEach(controller => {
      if (controller && controller.reset) {
        controller.reset();
      }
    });
    
    this.performanceHistory = [];
    this.lastUpdate = null;
    
    console.log('🔄 All controllers reset');
    this.emit('controllersReset');
  }
}

module.exports = TemperatureControlService;