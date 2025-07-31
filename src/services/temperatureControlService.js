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
    
    if (!enabled && this.activeController) {
      // Reset controller when disabling
      this.activeController.reset();
    }
    
    console.log(`🔧 Temperature control ${enabled ? 'enabled' : 'disabled'}`);
    this.emit('controlStateChanged', { enabled });
    
    return true;
  }
  
  /**
   * Process temperature update and return control actions
   */
  processTemperature(temperature) {
    if (!this.isEnabled || !this.activeController) {
      return null;
    }
    
    const startTime = Date.now();
    
    // Get control decision from active controller
    const controlResult = this.activeController.update(temperature);
    
    if (!controlResult) {
      return null;
    }
    
    // Track performance
    const processingTime = Date.now() - startTime;
    this.trackPerformance({
      controller: this.activeControllerType,
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
      controller: this.activeControllerType,
      temperature,
      setpoint: controlResult.setpoint,
      peltier1: controlResult.peltier1,
      peltier2: controlResult.peltier2,
      error: controlResult.error,
      stable: controlResult.stable,
      metrics: this.activeController.getMetrics ? this.activeController.getMetrics() : null
    });
    
    this.lastUpdate = Date.now();
    
    return {
      peltier1: controlResult.peltier1,
      peltier2: controlResult.peltier2,
      controller: this.activeControllerType,
      metrics: controlResult
    };
  }
  
  /**
   * Set new temperature setpoint
   */
  setSetpoint(setpoint) {
    // Update all controllers
    Object.values(this.controllers).forEach(controller => {
      if (controller && controller.setSetpoint) {
        controller.setSetpoint(setpoint);
      }
    });
    
    console.log(`🎯 Temperature setpoint changed to ${setpoint}°C`);
    this.emit('setpointChanged', { setpoint });
  }
  
  /**
   * Get current controller configuration
   */
  getConfiguration() {
    return {
      activeController: this.activeControllerType,
      enabled: this.isEnabled,
      controllers: Object.keys(this.controllers),
      lastUpdate: this.lastUpdate
    };
  }
  
  /**
   * Get controller-specific parameters
   */
  getControllerParams(type) {
    const controller = this.controllers[type];
    if (!controller) return null;
    
    // Extract relevant parameters based on controller type
    switch (type) {
      case 'stable':
      case 'pid':
        return {
          kp: controller.kp,
          ki: controller.ki,
          kd: controller.kd,
          setpoint: controller.setpoint
        };
      
      case 'smart':
        return {
          kp: controller.kp,
          ki: controller.ki,
          kd: controller.kd,
          setpoint: controller.setpoint,
          adaptiveGain: controller.adaptiveGain || 1.0
        };
      
      case 'neural':
        return {
          setpoint: controller.setpoint,
          predictionHorizon: controller.predictionHorizon,
          controlHorizon: controller.controlHorizon,
          hiddenSize: controller.hiddenSize,
          learningRate: controller.learningRate,
          modelConfidence: controller.modelConfidence
        };
      
      default:
        return null;
    }
  }
  
  /**
   * Update controller parameters
   */
  updateControllerParams(type, params) {
    const controller = this.controllers[type];
    if (!controller) return false;
    
    // Update parameters based on controller type
    Object.keys(params).forEach(key => {
      if (controller.hasOwnProperty(key)) {
        controller[key] = params[key];
      }
    });
    
    console.log(`📝 Updated ${type} controller parameters:`, params);
    this.emit('controllerParamsUpdated', { type, params });
    
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
    
    // Controller-specific stats
    const byController = {};
    Object.keys(this.controllers).forEach(type => {
      const controllerData = this.performanceHistory.filter(p => p.controller === type);
      if (controllerData.length > 0) {
        const cErrors = controllerData.map(p => Math.abs(p.error));
        byController[type] = {
          avgError: cErrors.reduce((a, b) => a + b, 0) / cErrors.length,
          samples: controllerData.length,
          avgProcessingTime: controllerData.reduce((a, b) => a + b.processingTime, 0) / controllerData.length
        };
      }
    });
    
    return {
      overall: {
        avgError,
        maxError,
        minError,
        stabilityRate,
        totalSamples: this.performanceHistory.length
      },
      byController,
      current: {
        controller: this.activeControllerType,
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