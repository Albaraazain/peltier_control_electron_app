/**
 * Stable Temperature Controller for Peltier Systems
 * Simplified controller focused on stability and reaching target temperature
 */

class StableController {
  constructor(config = {}) {
    // Target settings
    this.setpoint = config.setpoint || 5.0
    this.tolerance = config.tolerance || 0.5 // ±0.5°C acceptable range
    
    // Simple PID parameters - tuned for stability
    this.kp = config.kp || 3.0
    this.ki = config.ki || 0.1
    this.kd = config.kd || 0.5
    
    // Controller state
    this.integral = 0
    this.lastError = 0
    this.lastTemp = null
    this.lastTime = Date.now()
    
    // Peltier state tracking
    this.peltierStates = {
      1: { isOn: false, lastChange: 0 },
      2: { isOn: false, lastChange: 0 }
    }
    
    // Minimum times (ms)
    this.minOnTime = 5000  // 5 seconds minimum on
    this.minOffTime = 3000 // 3 seconds minimum off
    
    // Temperature history for stability check
    this.tempHistory = []
    this.maxHistory = 20
  }
  
  /**
   * Main control update
   */
  update(currentTemp) {
    const now = Date.now()
    const dt = (now - this.lastTime) / 1000.0
    
    // Skip if called too frequently
    if (dt < 0.5) return null
    
    // Update history
    this.tempHistory.push({ temp: currentTemp, time: now })
    if (this.tempHistory.length > this.maxHistory) {
      this.tempHistory.shift()
    }
    
    // Calculate error (positive means we need cooling)
    const error = currentTemp - this.setpoint
    
    // P term
    const P = this.kp * error
    
    // I term with anti-windup
    this.integral += error * dt
    this.integral = Math.max(-20, Math.min(20, this.integral)) // Limit integral
    const I = this.ki * this.integral
    
    // D term
    let D = 0
    if (this.lastTemp !== null) {
      const dTemp = currentTemp - this.lastTemp
      D = this.kd * (dTemp / dt)
    }
    
    // Total output (0-100%)
    let output = P + I + D
    output = Math.max(0, Math.min(100, output))
    
    // Determine Peltier states based on output and temperature
    const peltierControl = this.determinePeltierStates(output, error, now)
    
    // Update state
    this.lastError = error
    this.lastTemp = currentTemp
    this.lastTime = now
    
    return {
      timestamp: now,
      temperature: currentTemp,
      setpoint: this.setpoint,
      error: error,
      P: P,
      I: I,
      D: D,
      output: output,
      peltier1: peltierControl.peltier1,
      peltier2: peltierControl.peltier2,
      stable: this.isStable()
    }
  }
  
  /**
   * Determine Peltier states with hysteresis and stability
   */
  determinePeltierStates(output, error, now) {
    const result = {
      peltier1: false,
      peltier2: false
    }
    
    // Simple thresholds with hysteresis
    if (error > 2.0) {
      // Far above target - both on
      result.peltier1 = true
      result.peltier2 = true
    } else if (error > 1.0) {
      // Above target - Peltier 1 on, Peltier 2 conditional
      result.peltier1 = true
      result.peltier2 = output > 50
    } else if (error > 0.5) {
      // Slightly above - only Peltier 1
      result.peltier1 = true
      result.peltier2 = false
    } else if (error > -0.5) {
      // In tolerance band - maintain with Peltier 1
      result.peltier1 = output > 10
      result.peltier2 = false
    } else {
      // Below target - both off
      result.peltier1 = false
      result.peltier2 = false
    }
    
    // Apply minimum on/off times
    result.peltier1 = this.enforceMinTime(1, result.peltier1, now)
    result.peltier2 = this.enforceMinTime(2, result.peltier2, now)
    
    return result
  }
  
  /**
   * Enforce minimum on/off times
   */
  enforceMinTime(peltierId, wantOn, now) {
    const state = this.peltierStates[peltierId]
    const timeSinceChange = now - state.lastChange
    
    // If state matches desired, no change needed
    if (state.isOn === wantOn) {
      return state.isOn
    }
    
    // Check if we can change
    if (state.isOn && timeSinceChange < this.minOnTime) {
      // Currently on, haven't met minimum on time
      return true
    }
    
    if (!state.isOn && timeSinceChange < this.minOffTime) {
      // Currently off, haven't met minimum off time
      return false
    }
    
    // Change is allowed
    state.isOn = wantOn
    state.lastChange = now
    return wantOn
  }
  
  /**
   * Check if temperature is stable
   */
  isStable() {
    if (this.tempHistory.length < 10) return false
    
    // Check last 10 readings
    const recent = this.tempHistory.slice(-10)
    const temps = recent.map(h => h.temp)
    const avg = temps.reduce((a, b) => a + b) / temps.length
    const maxDev = Math.max(...temps.map(t => Math.abs(t - avg)))
    
    return maxDev < 0.3 && Math.abs(avg - this.setpoint) < this.tolerance
  }
  
  /**
   * Reset controller
   */
  reset() {
    this.integral = 0
    this.lastError = 0
    this.lastTemp = null
    this.lastTime = Date.now()
    this.tempHistory = []
    const now = Date.now()
    this.peltierStates = {
      1: { isOn: false, lastChange: now },
      2: { isOn: false, lastChange: now }
    }
  }
  
  /**
   * Set new target
   */
  setSetpoint(setpoint) {
    this.setpoint = setpoint
    this.reset()
  }
  
  /**
   * Get performance metrics
   */
  getMetrics() {
    if (this.tempHistory.length === 0) return null
    
    const currentTemp = this.tempHistory[this.tempHistory.length - 1].temp
    const currentError = Math.abs(this.setpoint - currentTemp)
    
    return {
      currentError: currentError,
      integral: this.integral,
      stable: this.isStable(),
      peltier1State: this.peltierStates[1].isOn,
      peltier2State: this.peltierStates[2].isOn
    }
  }
}

export { StableController }