/**
 * PID Controller for Peltier Temperature Control
 * Implements a discrete PID controller with anti-windup and output limiting
 */
class PIDController {
  constructor(config = {}) {
    // PID gains
    this.kp = config.kp || 2.0      // Proportional gain
    this.ki = config.ki || 0.5      // Integral gain  
    this.kd = config.kd || 0.1      // Derivative gain
    
    // Controller settings
    this.setpoint = config.setpoint || 5.0  // Target temperature
    this.sampleTime = config.sampleTime || 1000  // Sample time in ms
    this.outputMin = config.outputMin || 0     // Minimum output (0%)
    this.outputMax = config.outputMax || 100   // Maximum output (100%)
    
    // Anti-windup limits (positive for cooling system)
    this.integralMin = config.integralMin || 0
    this.integralMax = config.integralMax || 100
    
    // Internal state
    this.lastError = 0
    this.integral = 0
    this.lastTime = Date.now()
    this.lastInput = null
    
    // Performance tracking
    this.history = []
    this.maxHistory = 100
  }
  
  /**
   * Update PID gains
   */
  setGains(kp, ki, kd) {
    this.kp = kp
    this.ki = ki
    this.kd = kd
  }
  
  /**
   * Set target temperature
   */
  setSetpoint(setpoint) {
    this.setpoint = setpoint
  }
  
  /**
   * Reset controller state
   */
  reset() {
    this.integral = 0
    this.lastError = 0
    this.lastTime = Date.now()
    this.lastInput = null
    this.history = []
  }
  
  /**
   * Calculate PID output
   * @param {number} currentTemp - Current temperature reading
   * @returns {Object} Controller output and components
   */
  update(currentTemp) {
    const now = Date.now()
    const dt = (now - this.lastTime) / 1000.0  // Convert to seconds
    
    // Skip if sample time hasn't elapsed
    if (dt < this.sampleTime / 1000.0) {
      return null
    }
    
    // Calculate error (negative when cooling needed)
    const error = this.setpoint - currentTemp
    
    // Proportional term
    const P = this.kp * error
    
    // Integral term with anti-windup
    // For cooling: accumulate positive integral when temp is above setpoint
    if (error < 0) {  // Temperature above setpoint, need cooling
      this.integral += Math.abs(error) * dt
    } else {  // Temperature below setpoint, reduce integral
      this.integral -= error * dt
    }
    this.integral = Math.max(this.integralMin, Math.min(this.integralMax, this.integral))
    const I = this.ki * this.integral
    
    // Derivative term (use derivative of input to avoid kick)
    let D = 0
    if (this.lastInput !== null) {
      const dInput = currentTemp - this.lastInput
      D = -this.kd * (dInput / dt)  // Negative because we want derivative of error
    }
    
    // Calculate total output
    let output = P + I + D
    
    // For cooling applications, ensure positive output when cooling is needed
    if (error < 0) {
      // Need cooling - use absolute values of P and D, positive I
      output = Math.abs(P) + I + Math.abs(D)
    } else {
      // Temperature below setpoint - reduce or stop cooling
      output = Math.max(0, -P + I - D)  // Allow some cooling to prevent overshoot
    }
    
    // Limit output to 0-100%
    output = Math.max(0, Math.min(this.outputMax, output))
    
    // Update state
    this.lastError = error
    this.lastTime = now
    this.lastInput = currentTemp
    
    // Store history
    const result = {
      timestamp: now,
      input: currentTemp,
      setpoint: this.setpoint,
      error: error,
      P: P,
      I: I,
      D: D,
      output: output,
      integral: this.integral
    }
    
    this.history.push(result)
    if (this.history.length > this.maxHistory) {
      this.history.shift()
    }
    
    return result
  }
  
  /**
   * Get controller performance metrics
   */
  getMetrics() {
    if (this.history.length === 0) return null
    
    const errors = this.history.map(h => Math.abs(h.error))
    const outputs = this.history.map(h => h.output)
    
    return {
      mae: errors.reduce((a, b) => a + b, 0) / errors.length,  // Mean Absolute Error
      maxError: Math.max(...errors),
      minError: Math.min(...errors),
      avgOutput: outputs.reduce((a, b) => a + b, 0) / outputs.length,
      settling: this.calculateSettlingTime(),
      overshoot: this.calculateOvershoot()
    }
  }
  
  /**
   * Calculate settling time (time to reach ±5% of setpoint)
   */
  calculateSettlingTime() {
    const tolerance = Math.abs(this.setpoint * 0.05) || 0.5
    
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (Math.abs(this.history[i].error) > tolerance) {
        return (Date.now() - this.history[i].timestamp) / 1000
      }
    }
    
    return 0
  }
  
  /**
   * Calculate overshoot percentage
   */
  calculateOvershoot() {
    if (this.history.length === 0) return 0
    
    let maxOvershoot = 0
    const recentHistory = this.history.slice(-50)  // Last 50 samples
    
    for (const h of recentHistory) {
      if (this.setpoint > this.lastInput) {
        // Cooling scenario
        const overshoot = Math.max(0, this.setpoint - h.input)
        maxOvershoot = Math.max(maxOvershoot, overshoot)
      } else {
        // Heating scenario
        const overshoot = Math.max(0, h.input - this.setpoint)
        maxOvershoot = Math.max(maxOvershoot, overshoot)
      }
    }
    
    return (maxOvershoot / Math.abs(this.setpoint)) * 100
  }
}

/**
 * PWM Controller for converting PID output to Peltier on/off control
 */
class PWMController {
  constructor(config = {}) {
    this.period = config.period || 10000  // PWM period in ms (10 seconds)
    this.minDutyCycle = config.minDutyCycle || 0     // Minimum duty cycle (0%)
    this.maxDutyCycle = config.maxDutyCycle || 100   // Maximum duty cycle (100%)
    
    this.dutyCycle = 0
    this.isOn = false
    this.cycleStartTime = Date.now()
    this.lastUpdate = Date.now()
  }
  
  /**
   * Update duty cycle from PID output (0-100%)
   */
  setDutyCycle(dutyCycle) {
    this.dutyCycle = Math.max(this.minDutyCycle, Math.min(this.maxDutyCycle, dutyCycle))
  }
  
  /**
   * Get current PWM state
   */
  getState() {
    const now = Date.now()
    const cycleTime = (now - this.cycleStartTime) % this.period
    const onTime = (this.dutyCycle / 100) * this.period
    
    // Reset cycle if needed
    if (now - this.cycleStartTime >= this.period) {
      this.cycleStartTime = now
    }
    
    // Determine if output should be on or off
    const shouldBeOn = cycleTime < onTime && this.dutyCycle > 0
    
    // Track state changes
    const stateChanged = shouldBeOn !== this.isOn
    this.isOn = shouldBeOn
    this.lastUpdate = now
    
    return {
      isOn: this.isOn,
      dutyCycle: this.dutyCycle,
      cycleProgress: (cycleTime / this.period) * 100,
      stateChanged: stateChanged
    }
  }
}

/**
 * Dual Peltier Controller with cascaded control
 */
class DualPeltierController {
  constructor(config = {}) {
    // Create PID controller
    this.pid = new PIDController({
      kp: config.kp || 3.0,
      ki: config.ki || 0.8,
      kd: config.kd || 0.2,
      setpoint: config.setpoint || 5.0,
      sampleTime: config.sampleTime || 1000
    })
    
    // Create PWM controllers for each Peltier
    this.pwm1 = new PWMController({ period: 10000 })
    this.pwm2 = new PWMController({ period: 10000 })
    
    // Control strategy settings
    this.cascadeThreshold = config.cascadeThreshold || 50  // Use both Peltiers above 50%
    this.balanceRatio = config.balanceRatio || 0.6  // Split ratio when using both
  }
  
  /**
   * Update control loop
   */
  update(currentTemp) {
    // Get PID output
    const pidResult = this.pid.update(currentTemp)
    if (!pidResult) return null
    
    // Distribute PID output to Peltiers
    const totalOutput = pidResult.output
    
    if (totalOutput <= this.cascadeThreshold) {
      // Use only Peltier 1 for low cooling demand
      this.pwm1.setDutyCycle(totalOutput * 2)  // Scale up since we're using one Peltier
      this.pwm2.setDutyCycle(0)
    } else {
      // Use both Peltiers for high cooling demand
      const excessOutput = totalOutput - this.cascadeThreshold
      const peltier1Output = this.cascadeThreshold + (excessOutput * this.balanceRatio)
      const peltier2Output = excessOutput * (1 - this.balanceRatio) * 2
      
      this.pwm1.setDutyCycle(Math.min(100, peltier1Output))
      this.pwm2.setDutyCycle(Math.min(100, peltier2Output))
    }
    
    // Get PWM states
    const pwm1State = this.pwm1.getState()
    const pwm2State = this.pwm2.getState()
    
    return {
      pid: pidResult,
      peltier1: {
        shouldBeOn: pwm1State.isOn,
        dutyCycle: pwm1State.dutyCycle,
        stateChanged: pwm1State.stateChanged
      },
      peltier2: {
        shouldBeOn: pwm2State.isOn,
        dutyCycle: pwm2State.dutyCycle,
        stateChanged: pwm2State.stateChanged
      },
      totalOutput: totalOutput
    }
  }
  
  /**
   * Reset all controllers
   */
  reset() {
    this.pid.reset()
    this.pwm1.setDutyCycle(0)
    this.pwm2.setDutyCycle(0)
  }
  
  /**
   * Update PID parameters
   */
  setPIDGains(kp, ki, kd) {
    this.pid.setGains(kp, ki, kd)
  }
  
  /**
   * Set target temperature
   */
  setSetpoint(setpoint) {
    this.pid.setSetpoint(setpoint)
  }
  
  /**
   * Get controller metrics
   */
  getMetrics() {
    return {
      pid: this.pid.getMetrics(),
      peltier1DutyCycle: this.pwm1.dutyCycle,
      peltier2DutyCycle: this.pwm2.dutyCycle
    }
  }
}

export { PIDController, PWMController, DualPeltierController }