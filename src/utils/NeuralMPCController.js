/**
 * Neural Network Model Predictive Controller (NN-MPC)
 * An intelligent controller that learns system dynamics and predicts optimal control actions
 * 
 * Key Features:
 * - Online learning of temperature dynamics
 * - Predictive control with lookahead
 * - Adaptive to system changes
 * - Constraint handling for safe operation
 */

class NeuralMPCController {
  constructor(config = {}) {
    // Control parameters
    this.setpoint = config.setpoint || 5.0
    this.predictionHorizon = config.predictionHorizon || 10 // steps ahead
    this.controlHorizon = config.controlHorizon || 3 // control moves
    this.dt = config.dt || 1.0 // time step in seconds
    
    // Neural network architecture
    this.inputSize = 6 // [temp, peltier1, peltier2, temp_prev, action_prev1, action_prev2]
    this.hiddenSize = config.hiddenSize || 16
    this.outputSize = 1 // predicted temperature change
    
    // Initialize neural network weights (Xavier initialization)
    this.W1 = this.initializeWeights(this.inputSize, this.hiddenSize)
    this.b1 = new Array(this.hiddenSize).fill(0)
    this.W2 = this.initializeWeights(this.hiddenSize, this.outputSize)
    this.b2 = new Array(this.outputSize).fill(0)
    
    // Learning parameters
    this.learningRate = config.learningRate || 0.001
    this.momentumFactor = config.momentumFactor || 0.9
    this.adaptiveLearning = true
    
    // Momentum terms for weight updates
    this.vW1 = this.initializeWeights(this.inputSize, this.hiddenSize, 0)
    this.vb1 = new Array(this.hiddenSize).fill(0)
    this.vW2 = this.initializeWeights(this.hiddenSize, this.outputSize, 0)
    this.vb2 = new Array(this.outputSize).fill(0)
    
    // State tracking
    this.temperatureHistory = []
    this.actionHistory = []
    this.predictionErrors = []
    this.maxHistory = 100
    
    // Control constraints
    this.minOnTime = 3000 // 3 seconds
    this.minOffTime = 2000 // 2 seconds
    this.lastActionTime = { 1: 0, 2: 0 }
    this.lastActionState = { 1: false, 2: false }
    
    // Performance metrics
    this.totalPredictions = 0
    this.accuratePredictions = 0
    this.modelConfidence = 0.5
  }
  
  /**
   * Initialize weight matrix with Xavier initialization
   */
  initializeWeights(rows, cols, scale = null) {
    const weights = []
    const stdDev = scale !== null ? scale : Math.sqrt(2.0 / (rows + cols))
    
    for (let i = 0; i < rows; i++) {
      weights[i] = []
      for (let j = 0; j < cols; j++) {
        weights[i][j] = (Math.random() - 0.5) * 2 * stdDev
      }
    }
    return weights
  }
  
  /**
   * ReLU activation function
   */
  relu(x) {
    return Math.max(0, x)
  }
  
  /**
   * Sigmoid activation for output layer
   */
  sigmoid(x) {
    return 1 / (1 + Math.exp(-x))
  }
  
  /**
   * Forward pass through the neural network
   */
  forward(input) {
    // Hidden layer with ReLU
    const hidden = []
    for (let j = 0; j < this.hiddenSize; j++) {
      let sum = this.b1[j]
      for (let i = 0; i < this.inputSize; i++) {
        sum += input[i] * this.W1[i][j]
      }
      hidden[j] = this.relu(sum)
    }
    
    // Output layer (linear for regression)
    let output = this.b2[0]
    for (let j = 0; j < this.hiddenSize; j++) {
      output += hidden[j] * this.W2[j][0]
    }
    
    return { output, hidden }
  }
  
  /**
   * Backward pass and weight updates
   */
  backward(input, hidden, predictedChange, actualChange) {
    const error = predictedChange - actualChange
    const loss = error * error
    
    // Update learning rate based on recent performance
    if (this.adaptiveLearning) {
      if (Math.abs(error) < 0.1) {
        this.learningRate *= 0.999 // Decrease when accurate
      } else {
        this.learningRate = Math.min(0.01, this.learningRate * 1.001) // Increase when inaccurate
      }
    }
    
    // Output layer gradients
    const dOutput = 2 * error
    
    // Update output weights with momentum
    for (let j = 0; j < this.hiddenSize; j++) {
      this.vW2[j][0] = this.momentumFactor * this.vW2[j][0] - this.learningRate * dOutput * hidden[j]
      this.W2[j][0] += this.vW2[j][0]
    }
    this.vb2[0] = this.momentumFactor * this.vb2[0] - this.learningRate * dOutput
    this.b2[0] += this.vb2[0]
    
    // Hidden layer gradients
    const dHidden = []
    for (let j = 0; j < this.hiddenSize; j++) {
      dHidden[j] = hidden[j] > 0 ? dOutput * this.W2[j][0] : 0
    }
    
    // Update hidden weights with momentum
    for (let i = 0; i < this.inputSize; i++) {
      for (let j = 0; j < this.hiddenSize; j++) {
        this.vW1[i][j] = this.momentumFactor * this.vW1[i][j] - this.learningRate * dHidden[j] * input[i]
        this.W1[i][j] += this.vW1[i][j]
      }
    }
    
    for (let j = 0; j < this.hiddenSize; j++) {
      this.vb1[j] = this.momentumFactor * this.vb1[j] - this.learningRate * dHidden[j]
      this.b1[j] += this.vb1[j]
    }
    
    return loss
  }
  
  /**
   * Predict temperature change given current state and actions
   */
  predictTemperatureChange(temp, peltier1, peltier2, tempPrev, action1Prev, action2Prev) {
    const input = [
      (temp - this.setpoint) / 10, // Normalize temperature error
      peltier1 ? 1 : 0,
      peltier2 ? 1 : 0,
      (tempPrev - this.setpoint) / 10,
      action1Prev ? 1 : 0,
      action2Prev ? 1 : 0
    ]
    
    const { output } = this.forward(input)
    return output * 0.5 // Scale output to reasonable temperature change
  }
  
  /**
   * Simulate future trajectory given a control sequence
   */
  simulateTrajectory(currentTemp, controlSequence) {
    const trajectory = [currentTemp]
    let temp = currentTemp
    let tempPrev = currentTemp
    let action1Prev = this.lastActionState[1]
    let action2Prev = this.lastActionState[2]
    
    for (const actions of controlSequence) {
      const deltaT = this.predictTemperatureChange(
        temp, 
        actions.peltier1, 
        actions.peltier2,
        tempPrev,
        action1Prev,
        action2Prev
      )
      
      tempPrev = temp
      temp += deltaT
      
      // Apply physics constraints
      if (actions.peltier1 || actions.peltier2) {
        temp -= 0.1 * this.dt // Cooling effect
      } else {
        temp += 0.05 * this.dt // Ambient heating
      }
      
      trajectory.push(temp)
      action1Prev = actions.peltier1
      action2Prev = actions.peltier2
    }
    
    return trajectory
  }
  
  /**
   * Find optimal control sequence using gradient-free optimization
   */
  optimizeControl(currentTemp) {
    const numSequences = 20 // Random shooting
    const sequences = []
    const costs = []
    
    // Generate random control sequences
    for (let s = 0; s < numSequences; s++) {
      const sequence = []
      for (let t = 0; t < this.controlHorizon; t++) {
        // Bias towards reasonable actions based on temperature error
        const error = currentTemp - this.setpoint
        const p1Prob = Math.max(0.1, Math.min(0.9, 0.5 + error * 0.1))
        const p2Prob = Math.max(0, Math.min(0.8, error * 0.1))
        
        sequence.push({
          peltier1: Math.random() < p1Prob,
          peltier2: Math.random() < p2Prob
        })
      }
      sequences.push(sequence)
      
      // Evaluate sequence
      const trajectory = this.simulateTrajectory(currentTemp, sequence)
      let cost = 0
      
      // Trajectory cost
      for (let i = 1; i < trajectory.length; i++) {
        const error = trajectory[i] - this.setpoint
        cost += error * error
      }
      
      // Control effort penalty
      for (const action of sequence) {
        if (action.peltier1) cost += 0.1
        if (action.peltier2) cost += 0.2
      }
      
      costs.push(cost)
    }
    
    // Select best sequence
    const bestIdx = costs.indexOf(Math.min(...costs))
    return sequences[bestIdx]
  }
  
  /**
   * Main control update with learning
   */
  update(currentTemp) {
    const now = Date.now()
    
    // Learn from previous prediction if we have history
    if (this.temperatureHistory.length > 1) {
      const prevTemp = this.temperatureHistory[this.temperatureHistory.length - 2].temp
      const prevActions = this.actionHistory[this.actionHistory.length - 2] || { peltier1: false, peltier2: false }
      const prevPrevTemp = this.temperatureHistory.length > 2 ? 
        this.temperatureHistory[this.temperatureHistory.length - 3].temp : prevTemp
      const prevPrevActions = this.actionHistory.length > 2 ?
        this.actionHistory[this.actionHistory.length - 3] : prevActions
      
      // Create input for learning
      const input = [
        (prevTemp - this.setpoint) / 10,
        prevActions.peltier1 ? 1 : 0,
        prevActions.peltier2 ? 1 : 0,
        (prevPrevTemp - this.setpoint) / 10,
        prevPrevActions.peltier1 ? 1 : 0,
        prevPrevActions.peltier2 ? 1 : 0
      ]
      
      const { output, hidden } = this.forward(input)
      const predictedChange = output * 0.5
      const actualChange = currentTemp - prevTemp
      
      // Update neural network
      const loss = this.backward(input, hidden, predictedChange, actualChange)
      
      // Track prediction accuracy
      this.totalPredictions++
      if (Math.abs(predictedChange - actualChange) < 0.2) {
        this.accuratePredictions++
      }
      this.modelConfidence = this.accuratePredictions / Math.max(1, this.totalPredictions)
      
      // Store error for analysis
      this.predictionErrors.push({
        predicted: predictedChange,
        actual: actualChange,
        loss: loss,
        timestamp: now
      })
      if (this.predictionErrors.length > 50) {
        this.predictionErrors.shift()
      }
    }
    
    // Store current state
    this.temperatureHistory.push({ temp: currentTemp, time: now })
    if (this.temperatureHistory.length > this.maxHistory) {
      this.temperatureHistory.shift()
    }
    
    // Optimize control
    const optimalSequence = this.optimizeControl(currentTemp)
    const nextAction = optimalSequence[0]
    
    // Apply constraints
    const constrainedAction = this.applyConstraints(nextAction, now)
    
    // Store action
    this.actionHistory.push(constrainedAction)
    if (this.actionHistory.length > this.maxHistory) {
      this.actionHistory.shift()
    }
    
    // Update last action state
    if (constrainedAction.peltier1 !== this.lastActionState[1]) {
      this.lastActionTime[1] = now
      this.lastActionState[1] = constrainedAction.peltier1
    }
    if (constrainedAction.peltier2 !== this.lastActionState[2]) {
      this.lastActionTime[2] = now
      this.lastActionState[2] = constrainedAction.peltier2
    }
    
    // Calculate metrics
    const error = currentTemp - this.setpoint
    const predictedTrajectory = this.simulateTrajectory(currentTemp, optimalSequence)
    
    return {
      timestamp: now,
      temperature: currentTemp,
      setpoint: this.setpoint,
      error: error,
      peltier1: constrainedAction.peltier1,
      peltier2: constrainedAction.peltier2,
      predictedTrajectory: predictedTrajectory,
      modelConfidence: this.modelConfidence,
      learningRate: this.learningRate,
      controlHorizon: this.controlHorizon,
      stable: Math.abs(error) < 0.5
    }
  }
  
  /**
   * Apply minimum on/off time constraints
   */
  applyConstraints(action, now) {
    const constrained = { ...action }
    
    // Check Peltier 1
    const timeSince1 = now - this.lastActionTime[1]
    if (this.lastActionState[1] && !action.peltier1 && timeSince1 < this.minOnTime) {
      constrained.peltier1 = true // Keep on
    } else if (!this.lastActionState[1] && action.peltier1 && timeSince1 < this.minOffTime) {
      constrained.peltier1 = false // Keep off
    }
    
    // Check Peltier 2
    const timeSince2 = now - this.lastActionTime[2]
    if (this.lastActionState[2] && !action.peltier2 && timeSince2 < this.minOnTime) {
      constrained.peltier2 = true // Keep on
    } else if (!this.lastActionState[2] && action.peltier2 && timeSince2 < this.minOffTime) {
      constrained.peltier2 = false // Keep off
    }
    
    return constrained
  }
  
  /**
   * Reset controller
   */
  reset() {
    this.temperatureHistory = []
    this.actionHistory = []
    this.predictionErrors = []
    this.totalPredictions = 0
    this.accuratePredictions = 0
    this.modelConfidence = 0.5
    this.lastActionTime = { 1: Date.now(), 2: Date.now() }
    this.lastActionState = { 1: false, 2: false }
    
    // Reset learning rate
    this.learningRate = 0.001
  }
  
  /**
   * Set new target temperature
   */
  setSetpoint(setpoint) {
    this.setpoint = setpoint
    // Don't reset the model - it can adapt
  }
  
  /**
   * Get controller metrics
   */
  getMetrics() {
    const recentErrors = this.predictionErrors.slice(-10)
    const avgError = recentErrors.length > 0 ?
      recentErrors.reduce((sum, e) => sum + Math.abs(e.predicted - e.actual), 0) / recentErrors.length : 0
    
    return {
      modelConfidence: this.modelConfidence,
      avgPredictionError: avgError,
      learningRate: this.learningRate,
      totalPredictions: this.totalPredictions,
      accuracyRate: this.totalPredictions > 0 ? this.accuratePredictions / this.totalPredictions : 0
    }
  }
  
  /**
   * Export model for persistence
   */
  exportModel() {
    return {
      weights: {
        W1: this.W1,
        b1: this.b1,
        W2: this.W2,
        b2: this.b2
      },
      momentum: {
        vW1: this.vW1,
        vb1: this.vb1,
        vW2: this.vW2,
        vb2: this.vb2
      },
      stats: {
        totalPredictions: this.totalPredictions,
        accuratePredictions: this.accuratePredictions,
        modelConfidence: this.modelConfidence
      }
    }
  }
  
  /**
   * Import model from saved state
   */
  importModel(model) {
    if (model.weights) {
      this.W1 = model.weights.W1
      this.b1 = model.weights.b1
      this.W2 = model.weights.W2
      this.b2 = model.weights.b2
    }
    
    if (model.momentum) {
      this.vW1 = model.momentum.vW1
      this.vb1 = model.momentum.vb1
      this.vW2 = model.momentum.vW2
      this.vb2 = model.momentum.vb2
    }
    
    if (model.stats) {
      this.totalPredictions = model.stats.totalPredictions
      this.accuratePredictions = model.stats.accuratePredictions
      this.modelConfidence = model.stats.modelConfidence
    }
  }
}

export { NeuralMPCController }