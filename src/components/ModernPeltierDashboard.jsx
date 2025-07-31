import React, { useState, useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import zoomPlugin from 'chartjs-plugin-zoom'
import { 
  Thermometer, 
  Power, 
  AlertCircle, 
  Snowflake, 
  Zap,
  Settings,
  Wifi,
  WifiOff,
  AlertTriangle,
  RefreshCw,
  Activity,
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  Sliders,
  Cpu
} from 'lucide-react'
// Neural ML Controller is now handled by the backend service
import { safeToFixed } from '../lib/utils'

// Register Chart.js plugins
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  zoomPlugin
)

const ModernPeltierDashboard = ({ onOpenSettings }) => {
  const chartRef = useRef(null)
  // Neural controller is handled by backend service
  const [targetTemp, setTargetTemp] = useState(5)
  const [currentTemp, setCurrentTemp] = useState(22.4)
  const [temperatureHistory, setTemperatureHistory] = useState([])
  const [connectionStatus, setConnectionStatus] = useState({ connected: true, mockMode: false })
  const [peltierStates, setPeltierStates] = useState({ 1: false, 2: false })
  const [peltierDutyCycles, setPeltierDutyCycles] = useState({ 1: 0, 2: 0 })
  const [autoMode, setAutoMode] = useState(false)  // Start with manual mode until PID loads
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [tempTrend, setTempTrend] = useState('stable')
  const [showChart, setShowChart] = useState(false)
  const [showPIDTuning, setShowPIDTuning] = useState(false)
  const [pidParams, setPidParams] = useState({ kp: 5.0, ki: 1.2, kd: 0.5 })  // More aggressive cooling
  const [pidMetrics, setPidMetrics] = useState(null)
  const [controllerType, setControllerType] = useState('stable')  // Default to stable controller
  
  const maxDataPoints = 200
  const warningThreshold = 3.0
  
  // RBF Adaptive PID controller is now handled entirely by the backend service
  useEffect(() => {
    console.log('[Dashboard] RBF Adaptive PID Controller is active in backend service')
  }, [targetTemp])
  
  // Load PID settings on mount
  useEffect(() => {
    const loadPIDSettings = async () => {
      if (window.electronAPI) {
        const result = await window.electronAPI.getPIDSettings()
        if (result.success && result.params) {
          // Validate and ensure all required properties exist
          const validatedParams = {
            kp: typeof result.params.kp === 'number' ? result.params.kp : 5.0,
            ki: typeof result.params.ki === 'number' ? result.params.ki : 1.2,
            kd: typeof result.params.kd === 'number' ? result.params.kd : 0.5
          }
          setPidParams(validatedParams)
          console.log('🌍 Loaded PID settings:', validatedParams)
          // Reset PID controller with new logic
          console.log('[Dashboard] RBF controller reset handled by backend')
          // Enable auto mode after settings are loaded
          console.log('[Dashboard] Enabling auto mode after PID settings loaded')
          setAutoMode(true)
        }
      }
    }
    loadPIDSettings()
  }, [])
  
  // Save PID settings when they change
  useEffect(() => {
    const savePIDSettings = async () => {
      if (window.electronAPI) {
        await window.electronAPI.savePIDSettings(pidParams)
      }
    }
    savePIDSettings()
  }, [pidParams])

  const tempDiff = currentTemp - targetTemp
  const isWarning = Math.abs(tempDiff) > warningThreshold

  // Get trend icon
  const getTrendIcon = () => {
    switch (tempTrend) {
      case 'rising': return <TrendingUp className="h-4 w-4 text-red-500" />
      case 'falling': return <TrendingDown className="h-4 w-4 text-blue-500" />
      default: return <Minus className="h-4 w-4 text-gray-400" />
    }
  }

  // Chart configuration
  const chartData = {
    labels: temperatureHistory.map(reading => 
      new Date(reading.timestamp).toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      })
    ),
    datasets: [
      {
        label: 'Temperature',
        data: temperatureHistory.map(reading => reading.temperature),
        borderColor: 'rgba(147, 51, 234, 0.8)',
        backgroundColor: 'rgba(147, 51, 234, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: 'rgba(147, 51, 234, 1)',
        pointHoverBorderColor: 'white',
        pointHoverBorderWidth: 2,
      },
      {
        label: 'Target',
        data: Array(temperatureHistory.length).fill(targetTemp),
        borderColor: 'rgba(34, 197, 94, 0.8)',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [8, 4],
        pointRadius: 0,
        pointHoverRadius: 0,
      }
    ]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        titleColor: '#f3f4f6',
        bodyColor: '#f3f4f6',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          label: (context) => {
            if (context.datasetIndex === 0) {
              return `Temperature: ${safeToFixed(context.parsed.y, 1)}°C`
            }
            return `Target: ${safeToFixed(context.parsed.y, 1)}°C`
          }
        }
      },
      zoom: {
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true
          },
          mode: 'x',
        },
        pan: {
          enabled: true,
          mode: 'x',
        }
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          lineWidth: 1,
        },
        ticks: {
          font: {
            family: 'system-ui',
            size: 11,
            weight: '300'
          },
          callback: (value) => `${safeToFixed(value, 1)}°C`
        }
      },
      x: {
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          lineWidth: 1,
        },
        ticks: {
          font: {
            family: 'system-ui',
            size: 11,
            weight: '300'
          },
          maxTicksLimit: 8
        }
      }
    },
    animation: {
      duration: 750,
      easing: 'easeInOutQuart'
    }
  }

  // Auto mode control with smart or traditional controller
  useEffect(() => {
    if (autoMode) {
      // RBF Adaptive PID controller handles all temperature processing in the backend
      console.log(`🔧 RBF Adaptive PID: Current=${safeToFixed(currentTemp, 1)}°C, Target=${targetTemp}°C`)
      // RBF controller automatically handles all Peltier control decisions
    }
  }, [currentTemp, autoMode, targetTemp])

  // Electron API integration
  useEffect(() => {
    if (!window.electronAPI) return

    const unsubscribeTemp = window.electronAPI.onTemperatureUpdate((_event, data) => {
      console.log(`[Dashboard] Temperature update received: ${data.temperature}°C`)
      const prevTemp = currentTemp
      setCurrentTemp(data.temperature)
      setLastUpdate(new Date(data.timestamp))
      
      // Calculate trend
      if (data.temperature > prevTemp + 0.1) setTempTrend('rising')
      else if (data.temperature < prevTemp - 0.1) setTempTrend('falling')
      else setTempTrend('stable')
      
      setTemperatureHistory(prev => {
        const newHistory = [...prev, data]
        return newHistory.length > maxDataPoints 
          ? newHistory.slice(-maxDataPoints) 
          : newHistory
      })
    })

    const unsubscribeConnection = window.electronAPI.onConnectionStatusChange((_event, status) => {
      setConnectionStatus(status)
    })

    const unsubscribePeltier = window.electronAPI.onPeltierStatusChange((_event, status) => {
      setPeltierStates(prev => ({
        ...prev,
        [status.peltierId]: status.state
      }))
    })

    handleConnect()

    return () => {
      unsubscribeTemp?.()
      unsubscribeConnection?.()
      unsubscribePeltier?.()
    }
  }, [currentTemp])

  const handleConnect = async () => {
    if (!window.electronAPI) return
    
    setIsLoading(true)
    try {
      await window.electronAPI.connectToModbus({
        host: '10.5.5.95',
        port: 502,
        unitId: 1,
        timeout: 5000
      })
    } catch (error) {
      console.error('Connection failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePeltierToggle = async (peltierId) => {
    if (!window.electronAPI || autoMode) return
    
    const newState = !peltierStates[peltierId]
    try {
      await window.electronAPI.writePeltierControl(peltierId, newState)
      setPeltierStates(prev => ({
        ...prev,
        [peltierId]: newState
      }))
      // Reset duty cycle when manual control
      setPeltierDutyCycles(prev => ({
        ...prev,
        [peltierId]: newState ? 100 : 0
      }))
    } catch (error) {
      console.error(`Failed to toggle Peltier ${peltierId}:`, error)
    }
  }
  
  const handlePeltierControl = async (peltierId, state) => {
    if (!window.electronAPI) return
    
    console.log(`[Dashboard] Sending Peltier control command: Peltier ${peltierId} -> ${state ? 'ON' : 'OFF'}`)
    
    try {
      await window.electronAPI.writePeltierControl(peltierId, state)
      setPeltierStates(prev => ({
        ...prev,
        [peltierId]: state
      }))
    } catch (error) {
      console.error(`Failed to control Peltier ${peltierId}:`, error)
    }
  }
  
  const handleAutoModeToggle = () => {
    const newAutoMode = !autoMode
    console.log(`[Dashboard] Auto mode toggled: ${newAutoMode ? 'ON' : 'OFF'}`)
    setAutoMode(newAutoMode)
    
    if (!newAutoMode) {
      // RBF controller is disabled via backend
      setPeltierDutyCycles({ 1: 0, 2: 0 })
    } else if (newAutoMode) {
      console.log(`[Dashboard] RBF Adaptive PID Controller activated with target=${targetTemp}°C`)
    }
  }

  const handleRefresh = async () => {
    if (!window.electronAPI) return
    
    try {
      const reading = await window.electronAPI.readTemperature()
      if (reading && !reading.error) {
        setCurrentTemp(reading.temperature)
        setLastUpdate(new Date(reading.timestamp))
      }
    } catch (error) {
      console.error('Failed to refresh temperature:', error)
    }
  }

  const exportData = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Timestamp,Temperature (°C),Target (°C),Deviation (°C)\n"
      + temperatureHistory.map(reading => {
        const timestamp = new Date(reading.timestamp).toLocaleString()
        const deviation = safeToFixed(Math.abs(reading.temperature - targetTemp), 2)
        return `${timestamp},${safeToFixed(reading.temperature, 2)},${targetTemp},${deviation}`
      }).join("\n")
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `temperature_data_${new Date().toISOString()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-6xl font-extralight text-gray-900 mb-2 flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-300 to-purple-400 rounded-3xl blur-xl opacity-30 animate-pulse"></div>
                <div className="relative p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl shadow-xl">
                  <Snowflake className="text-white" size={36} />
                </div>
              </div>
              Peltier Cooling System
            </h1>
            <p className="text-gray-600 text-xl font-light ml-20">Advanced Temperature Control</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-full font-light text-sm flex items-center gap-2 ${
              connectionStatus.connected 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : connectionStatus.mockMode 
                  ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {connectionStatus.connected ? (
                <>
                  <Wifi className="h-4 w-4" />
                  PLC Connected
                </>
              ) : connectionStatus.mockMode ? (
                <>
                  <AlertTriangle className="h-4 w-4" />
                  Mock Mode
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4" />
                  Disconnected
                </>
              )}
            </div>
            
            <button
              onClick={handleRefresh}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <RefreshCw className="h-5 w-5 text-gray-600" />
            </button>
            
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <Settings className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Container Visualization */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-200 to-blue-200 rounded-[3rem] blur-3xl opacity-10"></div>
            <div className="relative bg-gray-50/50 backdrop-blur-sm rounded-[3rem] p-10 shadow-xl border border-gray-100">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-extralight text-gray-800">System Overview</h2>
                <div className="flex items-center gap-2">
                  {getTrendIcon()}
                  <span className="text-sm font-light text-gray-600 capitalize">{tempTrend}</span>
                </div>
              </div>
              
              <div className="relative">
                <svg viewBox="0 0 400 500" className="w-full h-auto">
                  {/* Gradient definitions */}
                  <defs>
                    <linearGradient id="glassGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#f3f4f6" stopOpacity="0.3" />
                    </linearGradient>
                    <linearGradient id="containerBg" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#e0e7ff" stopOpacity="0.5" />
                      <stop offset="50%" stopColor="#fef3c7" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#dbeafe" stopOpacity="0.5" />
                    </linearGradient>
                    <linearGradient id="tempGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                      <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.08"/>
                    </filter>
                  </defs>
                  
                  {/* Background orbs */}
                  <circle cx="100" cy="150" r="60" fill="#e9d5ff" opacity="0.3" filter="url(#glow)">
                    <animate attributeName="r" values="60;70;60" dur="4s" repeatCount="indefinite"/>
                  </circle>
                  <circle cx="300" cy="350" r="80" fill="#bfdbfe" opacity="0.3" filter="url(#glow)">
                    <animate attributeName="r" values="80;90;80" dur="5s" repeatCount="indefinite"/>
                  </circle>
                  
                  {/* Main Container */}
                  <g filter="url(#shadow)">
                    {/* Container background */}
                    <rect x="60" y="120" width="280" height="280" 
                          fill="url(#containerBg)" 
                          rx="40"
                          opacity="0.4"/>
                    
                    {/* Glass container */}
                    <rect x="60" y="120" width="280" height="280" 
                          fill="url(#glassGradient)" 
                          stroke="white" 
                          strokeWidth="1"
                          rx="40"/>
                  </g>
                  
                  {/* Air vents with modern design */}
                  <g filter="url(#shadow)">
                    {/* Air In */}
                    <rect x="120" y="80" width="70" height="50" 
                          fill="#60a5fa" 
                          rx="25"/>
                    <rect x="120" y="80" width="70" height="25" 
                          fill="white" 
                          opacity="0.4"
                          rx="25"/>
                    <text x="155" y="60" fill="#2563eb" textAnchor="middle" className="text-sm font-medium">Air In</text>
                    <text x="155" y="110" fill="white" textAnchor="middle" className="text-xs font-bold tracking-wider">IN</text>
                    
                    {/* Air Out */}
                    <rect x="210" y="80" width="70" height="50" 
                          fill="#f87171" 
                          rx="25"/>
                    <rect x="210" y="80" width="70" height="25" 
                          fill="white" 
                          opacity="0.4"
                          rx="25"/>
                    <text x="245" y="60" fill="#ef4444" textAnchor="middle" className="text-sm font-medium">Air Out</text>
                    <text x="245" y="110" fill="white" textAnchor="middle" className="text-xs font-bold tracking-wider">OUT</text>
                  </g>
                  
                  {/* Peltier modules with futuristic design */}
                  <g filter="url(#shadow)">
                    {/* Peltier 1 */}
                    <g className={peltierStates[1] ? "animate-pulse" : ""}>
                      <rect x="20" y="220" width="60" height="120" 
                            fill={peltierStates[1] ? "#22c55e" : "#f3f4f6"} 
                            rx="30"
                            opacity={peltierStates[1] ? "0.8" : "1"}/>
                      {peltierStates[1] && (
                        <rect x="20" y="220" width="60" height="60" 
                              fill="white" 
                              opacity="0.4"
                              rx="30"/>
                      )}
                      <circle cx="50" cy="280" r="20" 
                              fill={peltierStates[1] ? "white" : "#e5e7eb"} 
                              opacity="0.9"/>
                      <Zap x="38" y="268" size="24" color={peltierStates[1] ? "#22c55e" : "#6b7280"} />
                      {autoMode && peltierDutyCycles[1] > 0 && (
                        <>
                          <text x="50" y="310" fill="white" textAnchor="middle" className="text-xs font-bold">
                            {peltierDutyCycles[1]}%
                          </text>
                        </>
                      )}
                      {peltierStates[1] && (
                        <circle cx="50" cy="280" r="25" 
                                stroke="#22c55e" 
                                strokeWidth="2" 
                                fill="none" 
                                opacity="0.5">
                          <animate attributeName="r" values="20;30;20" dur="2s" repeatCount="indefinite"/>
                          <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite"/>
                        </circle>
                      )}
                    </g>
                    
                    {/* Peltier 2 */}
                    <g className={peltierStates[2] ? "animate-pulse" : ""}>
                      <rect x="320" y="220" width="60" height="120" 
                            fill={peltierStates[2] ? "#22c55e" : "#f3f4f6"} 
                            rx="30"
                            opacity={peltierStates[2] ? "0.8" : "1"}/>
                      {peltierStates[2] && (
                        <rect x="320" y="220" width="60" height="60" 
                              fill="white" 
                              opacity="0.4"
                              rx="30"/>
                      )}
                      <circle cx="350" cy="280" r="20" 
                              fill={peltierStates[2] ? "white" : "#e5e7eb"} 
                              opacity="0.9"/>
                      <Zap x="338" y="268" size="24" color={peltierStates[2] ? "#22c55e" : "#6b7280"} />
                      {autoMode && peltierDutyCycles[2] > 0 && (
                        <>
                          <text x="350" y="310" fill="white" textAnchor="middle" className="text-xs font-bold">
                            {peltierDutyCycles[2]}%
                          </text>
                        </>
                      )}
                      {peltierStates[2] && (
                        <circle cx="350" cy="280" r="25" 
                                stroke="#22c55e" 
                                strokeWidth="2" 
                                fill="none" 
                                opacity="0.5">
                          <animate attributeName="r" values="20;30;20" dur="2s" repeatCount="indefinite"/>
                          <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite"/>
                        </circle>
                      )}
                    </g>
                  </g>
                  
                  {/* Temperature Display - Floating design */}
                  <g filter="url(#shadow)">
                    {/* Outer glow ring */}
                    <circle cx="200" cy="260" r="85" 
                            fill="none" 
                            stroke="url(#tempGradient)" 
                            strokeWidth="1" 
                            opacity="0.3">
                      <animate attributeName="r" values="85;90;85" dur="3s" repeatCount="indefinite"/>
                    </circle>
                    
                    {/* Main temperature circle */}
                    <circle cx="200" cy="260" r="75" 
                            fill="white" 
                            opacity="0.95"/>
                    <circle cx="200" cy="260" r="75" 
                            fill="url(#tempGradient)" 
                            opacity="0.05"/>
                    
                    {/* Temperature value */}
                    <text x="200" y="250" fill="#1e293b" textAnchor="middle" className="text-6xl font-extralight">
                      {safeToFixed(currentTemp, 1)}°
                    </text>
                    <text x="200" y="280" fill="#64748b" textAnchor="middle" className="text-sm font-light tracking-widest">
                      CURRENT
                    </text>
                    
                    {/* Temperature indicator arc */}
                    <path d={`M 200 185 A 75 75 0 0 1 ${200 + 75 * Math.cos((tempDiff * 10 - 90) * Math.PI / 180)} ${260 + 75 * Math.sin((tempDiff * 10 - 90) * Math.PI / 180)}`}
                          fill="none"
                          stroke={tempDiff > 0 ? "#ef4444" : "#3b82f6"}
                          strokeWidth="3"
                          strokeLinecap="round"
                          opacity="0.8"/>
                  </g>
                  
                  {/* Cooling effect particles */}
                  {(peltierStates[1] || peltierStates[2]) && (
                    <>
                      {[...Array(5)].map((_, i) => (
                        <circle key={i} r="2" fill="#93c5fd" opacity="0.4">
                          <animate attributeName="cy" values="400;100" dur={`${3 + i * 0.5}s`} repeatCount="indefinite"/>
                          <animate attributeName="cx" values={`${150 + i * 40};${170 + i * 40}`} dur="2s" repeatCount="indefinite" begin={`${i * 0.3}s`}/>
                          <animate attributeName="opacity" values="0;0.4;0" dur={`${3 + i * 0.5}s`} repeatCount="indefinite"/>
                        </circle>
                      ))}
                    </>
                  )}
                </svg>
              </div>
              
              {/* Chart Toggle */}
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => setShowChart(!showChart)}
                  className="px-4 py-2 text-sm font-light text-gray-600 hover:text-gray-800 transition-colors flex items-center gap-2"
                >
                  <Activity className="h-4 w-4" />
                  {showChart ? 'Hide' : 'Show'} Temperature History
                </button>
              </div>
            </div>
          </div>

          {/* Control Panel */}
          <div className="space-y-6">
            {/* Temperature Control */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-200 to-pink-200 rounded-[2rem] blur-2xl opacity-10"></div>
              <div className="relative bg-gray-50/50 backdrop-blur-sm rounded-[2rem] p-8 shadow-xl border border-gray-100">
                <h2 className="text-xl font-light text-gray-800 mb-6 flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-orange-400 to-pink-500 rounded-2xl shadow-lg">
                    <Thermometer className="text-white" size={20} />
                  </div>
                  Temperature Control
                </h2>
                
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <label className="text-gray-700 font-light text-lg">Target Temperature</label>
                      <span className="text-4xl font-extralight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{targetTemp}°C</span>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full opacity-10 blur-lg"></div>
                      <input
                        type="range"
                        min="-10"
                        max="30"
                        value={targetTemp}
                        onChange={(e) => setTargetTemp(Number(e.target.value))}
                        className="relative w-full h-4 bg-gray-100 rounded-full appearance-none cursor-pointer slider"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-2">
                        <span>-10°C</span>
                        <span>30°C</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="relative overflow-hidden rounded-3xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 opacity-5"></div>
                    <div className="relative p-6 bg-gray-50/50 backdrop-blur-sm border border-gray-100">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700 font-light">Current Temperature</span>
                        <div className="text-right">
                          <div className={`text-5xl font-extralight ${isWarning ? 'text-red-500' : 'text-gray-800'}`}>
                            {safeToFixed(currentTemp, 1)}°C
                          </div>
                          <div className={`text-sm font-light mt-1 ${tempDiff > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                            {tempDiff > 0 ? '+' : ''}{safeToFixed(tempDiff, 1)}° from target
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {isWarning && (
                    <div className="flex items-center gap-3 p-5 bg-red-50 backdrop-blur-sm border border-red-100 rounded-2xl">
                      <div className="p-2 bg-red-100 rounded-xl">
                        <AlertCircle className="text-red-500" size={20} />
                      </div>
                      <span className="text-red-700 font-light">
                        Temperature deviation exceeds safe threshold
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Peltier Controls */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-green-200 to-cyan-200 rounded-[2rem] blur-2xl opacity-10"></div>
              <div className="relative bg-gray-50/50 backdrop-blur-sm rounded-[2rem] p-8 shadow-xl border border-gray-100">
                <h2 className="text-xl font-light text-gray-800 mb-6 flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-green-400 to-cyan-500 rounded-2xl shadow-lg">
                    <Power className="text-white" size={20} />
                  </div>
                  Peltier Controls
                </h2>
                
                <div className="space-y-6">
                  <div className="relative overflow-hidden rounded-2xl">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 opacity-5"></div>
                    <div className="relative p-5 bg-gray-50/50 flex items-center justify-between">
                      <div>
                        <span className="text-gray-800 font-light text-lg">Automatic Mode</span>
                        <p className="text-sm text-gray-500 font-light">PID-controlled temperature management</p>
                      </div>
                      <button
                        onClick={handleAutoModeToggle}
                        className={`relative w-20 h-10 rounded-full transition-all duration-500 ${
                          autoMode ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-gray-200'
                        }`}
                      >
                        <div className={`absolute top-1 w-8 h-8 bg-white rounded-full shadow-lg transition-all duration-500 ${
                          autoMode ? 'translate-x-10' : 'translate-x-1'
                        }`}>
                          <div className={`w-full h-full rounded-full ${autoMode ? 'bg-gradient-to-br from-blue-100 to-purple-100' : ''}`}></div>
                        </div>
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => handlePeltierToggle(1)}
                      disabled={autoMode}
                      className={`relative overflow-hidden p-8 rounded-3xl font-light transition-all duration-500 ${
                        peltierStates[1] 
                          ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-2xl scale-105' 
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                      } ${autoMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {peltierStates[1] && (
                        <div className="absolute inset-0 bg-white opacity-20">
                          <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white opacity-30"></div>
                        </div>
                      )}
                      <div className="relative">
                        <Power className="mx-auto mb-3" size={32} />
                        <div className="text-lg">Peltier 1</div>
                        <div className="text-xs mt-1 opacity-80">
                          {peltierStates[1] ? `Active • ${peltierDutyCycles[1]}%` : 'Standby'}
                        </div>
                        {autoMode && peltierDutyCycles[1] > 0 && (
                          <div className="mt-3">
                            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-white/60 transition-all duration-500"
                                style={{ width: `${peltierDutyCycles[1]}%` }}
                              />
                            </div>
                            <p className="text-xs mt-1 text-center opacity-70">Duty Cycle</p>
                          </div>
                        )}
                      </div>
                    </button>
                    
                    <button
                      onClick={() => handlePeltierToggle(2)}
                      disabled={autoMode}
                      className={`relative overflow-hidden p-8 rounded-3xl font-light transition-all duration-500 ${
                        peltierStates[2] 
                          ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-2xl scale-105' 
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                      } ${autoMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {peltierStates[2] && (
                        <div className="absolute inset-0 bg-white opacity-20">
                          <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white opacity-30"></div>
                        </div>
                      )}
                      <div className="relative">
                        <Power className="mx-auto mb-3" size={32} />
                        <div className="text-lg">Peltier 2</div>
                        <div className="text-xs mt-1 opacity-80">
                          {peltierStates[2] ? `Active • ${peltierDutyCycles[2]}%` : 'Standby'}
                        </div>
                        {autoMode && peltierDutyCycles[2] > 0 && (
                          <div className="mt-3">
                            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-white/60 transition-all duration-500"
                                style={{ width: `${peltierDutyCycles[2]}%` }}
                              />
                            </div>
                            <p className="text-xs mt-1 text-center opacity-70">Duty Cycle</p>
                          </div>
                        )}
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* System Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50/50 backdrop-blur-sm rounded-2xl border border-gray-100">
                <p className="text-xs text-gray-500 font-light mb-1">Data Points</p>
                <p className="text-xl font-light text-gray-800">{temperatureHistory.length}</p>
              </div>
              <div className="p-4 bg-gray-50/50 backdrop-blur-sm rounded-2xl border border-gray-100">
                <p className="text-xs text-gray-500 font-light mb-1">Update Rate</p>
                <p className="text-xl font-light text-gray-800">1 Hz</p>
              </div>
              <div className="p-4 bg-gray-50/50 backdrop-blur-sm rounded-2xl border border-gray-100">
                <p className="text-xs text-gray-500 font-light mb-1">Last Update</p>
                <p className="text-xl font-light text-gray-800">{lastUpdate.toLocaleTimeString().substring(0, 5)}</p>
              </div>
            </div>
            
            {/* PID Controller Tuning */}
            {autoMode && (
              <div className="mt-6 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-200 to-indigo-200 rounded-[2rem] blur-2xl opacity-10"></div>
                <div className="relative bg-gray-50/50 backdrop-blur-sm rounded-[2rem] p-6 shadow-xl border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-light text-gray-800 flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-xl shadow-lg">
                        <Cpu className="text-white" size={16} />
                      </div>
                      {controllerType === 'stable' ? 'Stable' : controllerType === 'smart' ? 'Smart Adaptive' : 'PID'} Controller
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowPIDTuning(!showPIDTuning)}
                        className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
                      >
                        <Sliders className="h-4 w-4 text-gray-600" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Controller Type Selector */}
                  <div className="mb-4 p-3 bg-white/50 rounded-xl">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-light text-gray-700 mb-2">Controller Algorithm</p>
                        <select 
                          value={controllerType}
                          onChange={(e) => setControllerType(e.target.value)}
                          className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-light focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="stable">Stable Controller - Simple & Reliable</option>
                          <option value="smart">Smart Adaptive - Advanced Features</option>
                          <option value="pid">Traditional PID - Classic Control</option>
                        </select>
                      </div>
                      <p className="text-xs text-gray-500 font-light">
                        {controllerType === 'stable' ? 'Threshold-based control with hysteresis for stability' : 
                         controllerType === 'smart' ? 'Adaptive gains with oscillation detection' : 
                         'Traditional PID with cascade control'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Controller Metrics */}
                  {pidMetrics && (
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {(controllerType === 'smart' || controllerType === 'stable') ? (
                        <>
                          <div className="p-3 bg-white/50 rounded-xl">
                            <p className="text-xs text-gray-500 font-light">Current Error</p>
                            <p className="text-lg font-light text-gray-800">{pidMetrics?.currentError?.toFixed(2) || '0'}°C</p>
                          </div>
                          <div className="p-3 bg-white/50 rounded-xl">
                            <p className="text-xs text-gray-500 font-light">Status</p>
                            <p className="text-lg font-light text-gray-800">
                              {pidMetrics?.oscillating ? 'Damping' : 'Stable'}
                            </p>
                          </div>
                        </>
                      ) : pidMetrics?.pid ? (
                        <>
                          <div className="p-3 bg-white/50 rounded-xl">
                            <p className="text-xs text-gray-500 font-light">Mean Error</p>
                            <p className="text-lg font-light text-gray-800">{pidMetrics?.pid?.mae?.toFixed(2) || '0'}°C</p>
                          </div>
                          <div className="p-3 bg-white/50 rounded-xl">
                            <p className="text-xs text-gray-500 font-light">Settling Time</p>
                            <p className="text-lg font-light text-gray-800">{pidMetrics?.pid?.settling?.toFixed(1) || '0'}s</p>
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}
                  
                  {/* PID Tuning Interface */}
                  {showPIDTuning && controllerType === 'pid' && (
                    <div className="space-y-4 pt-4 border-t border-gray-200">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-sm text-gray-700 font-light">Proportional (Kp)</label>
                          <span className="text-sm font-light text-purple-600">{pidParams?.kp?.toFixed(2) || '5.00'}</span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="10"
                          step="0.1"
                          value={pidParams?.kp || 5.0}
                          onChange={(e) => setPidParams(prev => ({ ...prev, kp: parseFloat(e.target.value) }))}
                          className="w-full h-2 bg-gray-100 rounded-full appearance-none cursor-pointer slider-purple"
                        />
                      </div>
                      
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-sm text-gray-700 font-light">Integral (Ki)</label>
                          <span className="text-sm font-light text-purple-600">{pidParams?.ki?.toFixed(2) || '1.20'}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="5"
                          step="0.1"
                          value={pidParams?.ki || 1.2}
                          onChange={(e) => setPidParams(prev => ({ ...prev, ki: parseFloat(e.target.value) }))}
                          className="w-full h-2 bg-gray-100 rounded-full appearance-none cursor-pointer slider-purple"
                        />
                      </div>
                      
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-sm text-gray-700 font-light">Derivative (Kd)</label>
                          <span className="text-sm font-light text-purple-600">{pidParams?.kd?.toFixed(2) || '0.50'}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="2"
                          step="0.05"
                          value={pidParams?.kd || 0.5}
                          onChange={(e) => setPidParams(prev => ({ ...prev, kd: parseFloat(e.target.value) }))}
                          className="w-full h-2 bg-gray-100 rounded-full appearance-none cursor-pointer slider-purple"
                        />
                      </div>
                      
                      <div className="pt-3 text-xs text-gray-500 font-light">
                        <p>Kp: Increases response speed and reduces steady-state error</p>
                        <p>Ki: Eliminates steady-state error but may cause overshoot</p>
                        <p>Kd: Reduces overshoot and improves stability</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Smart Controller Info */}
                  {showPIDTuning && (controllerType === 'smart' || controllerType === 'stable') && (
                    <div className="pt-4 border-t border-gray-200 space-y-3">
                      <div className="text-sm text-gray-600 font-light">
                        <p className="mb-2 font-medium">
                          {controllerType === 'stable' ? 'Stable Controller Features:' : 'Smart Adaptive Features:'}
                        </p>
                        <ul className="space-y-1 ml-4">
                          {controllerType === 'stable' ? (
                            <>
                              <li>• Simple threshold-based control</li>
                              <li>• Built-in hysteresis to prevent oscillation</li>
                              <li>• Minimum on/off times (5s on, 3s off)</li>
                              <li>• Clear state transitions</li>
                              <li>• Optimized for reaching 5°C target</li>
                            </>
                          ) : (
                            <>
                              <li>• Adaptive gain scheduling based on error magnitude</li>
                              <li>• Oscillation detection and damping</li>
                              <li>• Predictive control with temperature trend analysis</li>
                              <li>• Intelligent PWM to reduce Peltier switching</li>
                              <li>• Automatic overshoot prevention</li>
                            </>
                          )}
                        </ul>
                      </div>
                      {pidMetrics && (
                        <div className="mt-3 p-3 bg-white/50 rounded-lg">
                          <p className="text-xs text-gray-500 font-light mb-1">Temperature Trend</p>
                          <p className="text-sm font-light text-gray-700">
                            {pidMetrics?.trend ? `${safeToFixed(pidMetrics.trend * 60, 1)}°C/min` : 'Calculating...'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Temperature History Chart */}
        {showChart && (
          <div className="mt-10 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-200 to-purple-200 rounded-[3rem] blur-3xl opacity-10"></div>
            <div className="relative bg-gray-50/50 backdrop-blur-sm rounded-[3rem] p-10 shadow-xl border border-gray-100">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-extralight text-gray-800">Temperature History</h2>
                <button
                  onClick={exportData}
                  className="px-4 py-2 text-sm font-light text-gray-600 hover:text-gray-800 transition-colors flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export Data
                </button>
              </div>
              
              <div className="h-[400px]">
                {temperatureHistory.length > 0 ? (
                  <Line ref={chartRef} data={chartData} options={chartOptions} />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="h-32 w-32 bg-purple-100 rounded-full animate-ping"></div>
                        </div>
                        <div className="relative bg-white rounded-full p-8 shadow-lg">
                          <Thermometer className="h-16 w-16 mx-auto text-purple-500" />
                        </div>
                      </div>
                      <p className="text-gray-600 font-light mt-6 text-lg">Initializing Temperature Monitor</p>
                      <p className="text-gray-400 mt-2 font-light">Connecting to PLC system...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ModernPeltierDashboard