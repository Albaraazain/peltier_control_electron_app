/**
 * Smart Adaptive Temperature Controller for Peltier Systems
 * Features:
 * - Adaptive gain scheduling based on error magnitude
 * - Intelligent PWM management to reduce oscillation
 * - Predictive control with temperature trend analysis
 * - Smart cascading for dual Peltier systems
 * - Anti-oscillation and stability mechanisms
 */

class SmartAdaptiveController {
  constructor(config = {}) {
    // Target settings
    this.setpoint = config.setpoint || 5.0
    this.tolerance = config.tolerance || 0.3 // ±0.3°C acceptable range
    
    // Adaptive PID parameters
    this.gains = {
      far: { kp: 8.0, ki: 0.2, kd: 2.0 },     // >10°C from target
      medium: { kp: 4.0, ki: 0.5, kd: 1.0 },   // 3-10°C from target
      near: { kp: 2.0, ki: 0.8, kd: 0.5 },     // 1-3°C from target
      fine: { kp: 1.0, ki: 0.3, kd: 0.2 }      // <1°C from target
    }
    
    // Controller state
    this.integral = 0
    this.lastError = 0
    this.lastTemp = null
    this.lastTime = Date.now()
    
    // Temperature trend tracking
    this.tempHistory = []
    this.maxHistory = 30
    this.trendWindow = 10
    
    // PWM management
    this.pwmState = {
      peltier1: { isOn: false, lastChange: 0, minOnTime: 3000, minOffTime: 2000 },
      peltier2: { isOn: false, lastChange: 0, minOnTime: 3000, minOffTime: 2000 }
    }
    
    // Oscillation detection
    this.oscillationDetector = {
      reversals: 0,
      lastDirection: null,
      threshold: 3,
      damping: false
    }
    
    // Performance metrics
    this.metrics = {
      overshoot: 0,
      settlingTime: null,
      steadyStateError: 0
    }
  }
  
  /**
   * Main control update function
   */
  update(currentTemp) {
    const now = Date.now()
    const dt = (now - this.lastTime) / 1000.0
    
    // Skip if called too frequently
    if (dt < 0.5) return null
    
    // Update temperature history
    this.updateHistory(currentTemp, now)
    
    // Calculate error
    const error = this.setpoint - currentTemp
    const absError = Math.abs(error)
    
    // Detect if we're in acceptable range
    if (absError <= this.tolerance) {
      return this.handleSteadyState(currentTemp, error)
    }
    
    // Select appropriate gains based on error magnitude
    const gains = this.selectGains(absError)
    
    // Calculate temperature trend
    const trend = this.calculateTrend()
    
    // Detect oscillation
    this.detectOscillation(error)
    
    // Calculate PID components with adaptive modifications
    const P = gains.kp * error
    
    // Adaptive integral with anti-windup
    if (this.oscillationDetector.damping) {
      // Reduce integral contribution during oscillation
      this.integral *= 0.95
    } else if (Math.sign(error) !== Math.sign(this.lastError) && this.lastError !== 0) {
      // Reset integral on error sign change (overshoot)
      this.integral *= 0.5
    } else {
      // Normal integral accumulation
      this.integral += error * dt
    }
    
    // Limit integral
    const integralLimit = 30 / gains.ki // Dynamic limit based on gain
    this.integral = Math.max(-integralLimit, Math.min(integralLimit, this.integral))
    const I = gains.ki * this.integral
    
    // Derivative with trend prediction
    let D = 0
    if (this.lastTemp !== null) {
      const tempChange = currentTemp - this.lastTemp
      D = -gains.kd * (tempChange / dt)
      
      // Add predictive component based on trend
      if (trend !== null && Math.abs(trend) > 0.05) {
        D += gains.kd * trend * 2.0 // Predict future based on trend
      }
    }
    
    // Calculate base output
    let output = P + I + D
    
    // For cooling systems, we need positive output when temperature is above setpoint
    if (error < 0) {
      output = Math.abs(P) + Math.abs(I) + Math.abs(D)
    } else {
      // Temperature below setpoint - reduce cooling
      output = Math.max(0, -P + I - D) * 0.5 // Gentler when below target
    }
    
    // Apply smart output shaping
    output = this.shapeOutput(output, absError, trend)
    
    // Limit output
    output = Math.max(0, Math.min(100, output))
    
    // Distribute to Peltiers with smart PWM
    const peltierControl = this.distributeToPeltiers(output, absError)
    
    // Update state
    this.lastError = error
    this.lastTime = now
    this.lastTemp = currentTemp
    
    return {
      timestamp: now,
      temperature: currentTemp,
      setpoint: this.setpoint,
      error: error,
      P: P,
      I: I,
      D: D,
      output: output,
      gains: gains,
      trend: trend,
      peltier1: peltierControl.peltier1,
      peltier2: peltierControl.peltier2,
      oscillating: this.oscillationDetector.damping
    }
  }
  
  /**
   * Handle steady state (within tolerance)
   */
  handleSteadyState(currentTemp, error) {
    // Maintain minimal cooling to prevent drift
    const maintainOutput = 15 + (error * -5) // Base 15% + proportional
    
    return {
      temperature: currentTemp,
      setpoint: this.setpoint,
      error: error,
      output: Math.max(0, Math.min(30, maintainOutput)),
      peltier1: {
        shouldBeOn: true,
        dutyCycle: Math.max(0, Math.min(30, maintainOutput))
      },
      peltier2: {
        shouldBeOn: false,
        dutyCycle: 0
      },
      steadyState: true
    }
  }
  
  /**
   * Select PID gains based on error magnitude
   */
  selectGains(absError) {
    if (absError > 10) return this.gains.far
    if (absError > 3) return this.gains.medium
    if (absError > 1) return this.gains.near
    return this.gains.fine
  }
  
  /**
   * Update temperature history
   */
  updateHistory(temp, timestamp) {
    this.tempHistory.push({ temp, timestamp })
    
    // Limit history size
    while (this.tempHistory.length > this.maxHistory) {
      this.tempHistory.shift()
    }
  }
  
  /**
   * Calculate temperature trend (°C/second)
   */
  calculateTrend() {
    if (this.tempHistory.length < this.trendWindow) return null
    
    // Get recent samples
    const recent = this.tempHistory.slice(-this.trendWindow)
    const first = recent[0]
    const last = recent[recent.length - 1]
    
    const tempChange = last.temp - first.temp
    const timeChange = (last.timestamp - first.timestamp) / 1000.0
    
    return timeChange > 0 ? tempChange / timeChange : 0
  }
  
  /**
   * Detect oscillation
   */
  detectOscillation(error) {
    const direction = Math.sign(error)
    
    if (this.oscillationDetector.lastDirection !== null && 
        direction !== this.oscillationDetector.lastDirection) {
      this.oscillationDetector.reversals++
    } else {
      // Decay reversal count
      this.oscillationDetector.reversals = Math.max(0, this.oscillationDetector.reversals - 0.1)
    }
    
    this.oscillationDetector.lastDirection = direction
    this.oscillationDetector.damping = this.oscillationDetector.reversals >= this.oscillationDetector.threshold
  }
  
  /**
   * Shape output based on system state
   */
  shapeOutput(output, absError, trend) {
    // Apply exponential curve for large errors (aggressive far, gentle near)
    if (absError > 5) {
      output = output * (1 + (absError - 5) * 0.1)
    }
    
    // Reduce output if approaching setpoint too fast
    if (trend !== null && trend < -0.2 && absError < 3) {
      output *= 0.7 // Brake to prevent overshoot
    }
    
    // Boost output if temperature rising when it should be falling
    if (trend !== null && trend > 0.1 && absError > 2) {
      output *= 1.2
    }
    
    // Damping during oscillation
    if (this.oscillationDetector.damping) {
      output *= 0.6
    }
    
    return output
  }
  
  /**
   * Distribute output to Peltiers with intelligent PWM
   */
  distributeToPeltiers(output, absError) {
    const now = Date.now()
    const result = {
      peltier1: { shouldBeOn: false, dutyCycle: 0 },
      peltier2: { shouldBeOn: false, dutyCycle: 0 }
    }
    
    // Strategy based on output level
    if (output < 20) {
      // Low output: Use only Peltier 1 with PWM
      result.peltier1.dutyCycle = output * 2 // Scale up since using one
      result.peltier1.shouldBeOn = this.intelligentPWM('peltier1', result.peltier1.dutyCycle, now)
      result.peltier2.shouldBeOn = false
      
    } else if (output < 60) {
      // Medium output: Primary on Peltier 1, assist from Peltier 2
      result.peltier1.dutyCycle = 70 + (output - 20) * 0.75
      result.peltier2.dutyCycle = (output - 20) * 1.5
      
      result.peltier1.shouldBeOn = this.intelligentPWM('peltier1', result.peltier1.dutyCycle, now)
      result.peltier2.shouldBeOn = this.intelligentPWM('peltier2', result.peltier2.dutyCycle, now)
      
    } else {
      // High output: Both Peltiers with balanced load
      const totalDuty = output
      result.peltier1.dutyCycle = Math.min(100, totalDuty * 0.6)
      result.peltier2.dutyCycle = Math.min(100, totalDuty * 0.6)
      
      result.peltier1.shouldBeOn = this.intelligentPWM('peltier1', result.peltier1.dutyCycle, now)
      result.peltier2.shouldBeOn = this.intelligentPWM('peltier2', result.peltier2.dutyCycle, now)
    }
    
    // Apply minimum on/off times
    result.peltier1.shouldBeOn = this.enforceMinTimes('peltier1', result.peltier1.shouldBeOn, now)
    result.peltier2.shouldBeOn = this.enforceMinTimes('peltier2', result.peltier2.shouldBeOn, now)
    
    return result
  }
  
  /**
   * Intelligent PWM that reduces rapid switching
   */
  intelligentPWM(peltierId, dutyCycle, now) {
    // For high duty cycles, prefer continuous on
    if (dutyCycle > 85) return true
    if (dutyCycle < 15) return false
    
    // For mid-range, use longer PWM periods to reduce switching
    const pwmPeriod = 20000 // 20 second PWM period
    const cyclePosition = now % pwmPeriod
    const onTime = (dutyCycle / 100) * pwmPeriod
    
    return cyclePosition < onTime
  }
  
  /**
   * Enforce minimum on/off times to protect Peltiers
   */
  enforceMinTimes(peltierId, shouldBeOn, now) {
    const state = this.pwmState[peltierId]
    const timeSinceChange = now - state.lastChange
    
    // If no change needed, return current state
    if (shouldBeOn === state.isOn) {
      return state.isOn
    }
    
    // If trying to turn on but was recently turned off
    if (shouldBeOn && !state.isOn && timeSinceChange < state.minOffTime) {
      return false // Stay off
    }
    
    // If trying to turn off but was recently turned on
    if (!shouldBeOn && state.isOn && timeSinceChange < state.minOnTime) {
      return true // Stay on
    }
    
    // State change is allowed
    state.isOn = shouldBeOn
    state.lastChange = now
    
    return shouldBeOn
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
    this.oscillationDetector = {
      reversals: 0,
      lastDirection: null,
      threshold: 3,
      damping: false
    }
    
    // Reset PWM states
    const now = Date.now()
    this.pwmState.peltier1 = { isOn: false, lastChange: now, minOnTime: 3000, minOffTime: 2000 }
    this.pwmState.peltier2 = { isOn: false, lastChange: now, minOnTime: 3000, minOffTime: 2000 }
  }
  
  /**
   * Set new target temperature
   */
  setSetpoint(setpoint) {
    this.setpoint = setpoint
    this.reset() // Reset controller for new target
  }
  
  /**
   * Get performance metrics
   */
  getMetrics() {
    if (this.tempHistory.length === 0) return null
    
    const currentTemp = this.tempHistory[this.tempHistory.length - 1].temp
    const currentError = Math.abs(this.setpoint - currentTemp)
    
    // Calculate overshoot
    let maxOvershoot = 0
    for (const entry of this.tempHistory) {
      const overshoot = this.setpoint - entry.temp
      if (overshoot > 0) {
        maxOvershoot = Math.max(maxOvershoot, overshoot)
      }
    }
    
    return {
      currentError: currentError,
      maxOvershoot: maxOvershoot,
      oscillating: this.oscillationDetector.damping,
      reversals: this.oscillationDetector.reversals,
      trend: this.calculateTrend(),
      integral: this.integral
    }
  }
}

export { SmartAdaptiveController }