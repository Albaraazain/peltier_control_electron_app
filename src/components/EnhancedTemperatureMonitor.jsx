import React, { useState, useEffect } from 'react'
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
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Switch } from './ui/switch'
import { Badge } from './ui/badge'
import { 
  Thermometer, 
  Zap, 
  Settings, 
  Wifi, 
  WifiOff, 
  AlertTriangle,
  RefreshCw,
  Power,
  Activity,
  Target,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react'
import { safeToFixed } from '../lib/utils'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const EnhancedTemperatureMonitor = ({ onOpenSettings }) => {
  const [currentTemp, setCurrentTemp] = useState(22.4)
  const [temperatureHistory, setTemperatureHistory] = useState([])
  const [connectionStatus, setConnectionStatus] = useState({ connected: true, mockMode: false })
  const [peltierStates, setPeltierStates] = useState({ 1: true, 2: true })
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [tempTrend, setTempTrend] = useState('stable')
  const [rbfController, setRbfController] = useState({ enabled: false, gains: { kp: 0, ki: 0, kd: 0 }, error: 0 })
  const maxDataPoints = 100
  const targetTemp = 5.0

  // Enhanced temperature classification
  const getTemperatureClass = (temp) => {
    const diff = Math.abs(temp - targetTemp)
    if (diff <= 0.5) return 'temperature-good'
    if (diff <= 1.5) return 'temperature-warning'
    return 'temperature-danger'
  }

  const getDeviationColor = (temp) => {
    const diff = Math.abs(temp - targetTemp)
    if (diff <= 0.5) return 'bg-green-500'
    if (diff <= 1.5) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getTrendIcon = () => {
    switch (tempTrend) {
      case 'rising': return <TrendingUp className="h-4 w-4 text-red-500" />
      case 'falling': return <TrendingDown className="h-4 w-4 text-blue-500" />
      default: return <Minus className="h-4 w-4 text-gray-500" />
    }
  }

  // Enhanced chart configuration
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
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: 'rgba(59, 130, 246, 1)',
        pointHoverBorderColor: 'white',
        pointHoverBorderWidth: 2,
      },
      {
        label: 'Target',
        data: Array(temperatureHistory.length).fill(targetTemp),
        borderColor: 'rgba(34, 197, 94, 1)',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [8, 4],
        pointRadius: 0,
        pointHoverRadius: 0,
      },
      {
        label: 'Upper Limit',
        data: Array(temperatureHistory.length).fill(targetTemp + 2),
        borderColor: 'rgba(239, 68, 68, 0.5)',
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderDash: [2, 2],
        pointRadius: 0,
        pointHoverRadius: 0,
      },
      {
        label: 'Lower Limit',
        data: Array(temperatureHistory.length).fill(targetTemp - 2),
        borderColor: 'rgba(239, 68, 68, 0.5)',
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderDash: [2, 2],
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
        display: true,
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            family: 'Inter',
            size: 12,
            weight: '500'
          }
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          title: (context) => `Time: ${context[0].label}`,
          label: (context) => {
            if (context.datasetIndex === 0) {
              return `Temperature: ${safeToFixed(context.parsed.y, 1)}°C`
            }
            return `${context.dataset.label}: ${safeToFixed(context.parsed.y, 1)}°C`
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        min: Math.min(targetTemp - 3, Math.min(...temperatureHistory.map(r => r.temperature)) - 1),
        max: Math.max(targetTemp + 3, Math.max(...temperatureHistory.map(r => r.temperature)) + 1),
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          lineWidth: 1,
        },
        ticks: {
          font: {
            family: 'Inter',
            size: 11
          },
          callback: (value) => `${safeToFixed(value, 1)}°C`
        },
        title: {
          display: true,
          text: 'Temperature (°C)',
          font: {
            family: 'Inter',
            size: 12,
            weight: '600'
          }
        }
      },
      x: {
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          lineWidth: 1,
        },
        ticks: {
          font: {
            family: 'Inter',
            size: 11
          },
          maxTicksLimit: 8
        },
        title: {
          display: true,
          text: 'Time',
          font: {
            family: 'Inter',
            size: 12,
            weight: '600'
          }
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index',
    },
    animation: {
      duration: 750,
      easing: 'easeInOutQuart'
    }
  }

  // Electron API integration
  useEffect(() => {
    if (!window.electronAPI) return

    const unsubscribeTemp = window.electronAPI.onTemperatureUpdate((_event, data) => {
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

    const unsubscribeControl = window.electronAPI.onControlDecision((_event, data) => {
      setRbfController({
        enabled: true,
        gains: data.gains || { kp: 0, ki: 0, kd: 0 },
        error: Math.abs(data.error),
        stable: data.stable,
        pid: data.pid
      })
    })

    handleConnect()
    loadRBFStatus()

    return () => {
      unsubscribeTemp?.()
      unsubscribeConnection?.()
      unsubscribePeltier?.()
      unsubscribeControl?.()
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
    if (!window.electronAPI) return
    
    const newState = !peltierStates[peltierId]
    try {
      await window.electronAPI.writePeltierControl(peltierId, newState)
      setPeltierStates(prev => ({
        ...prev,
        [peltierId]: newState
      }))
    } catch (error) {
      console.error(`Failed to toggle Peltier ${peltierId}:`, error)
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

  const loadRBFStatus = async () => {
    if (!window.electronAPI) return
    
    try {
      const status = await window.electronAPI.getRBFStatus()
      if (status.success) {
        setRbfController(prev => ({
          ...prev,
          enabled: status.config.enabled,
          gains: status.params?.gains || { kp: 0, ki: 0, kd: 0 }
        }))
      }
    } catch (error) {
      console.error('Failed to load RBF status:', error)
    }
  }

  const toggleRBFControl = async () => {
    if (!window.electronAPI) return
    
    try {
      const newState = !rbfController.enabled
      const result = await window.electronAPI.setRBFEnabled(newState)
      if (result.success) {
        setRbfController(prev => ({ ...prev, enabled: newState }))
      }
    } catch (error) {
      console.error('Failed to toggle RBF control:', error)
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between animate-fade-in-up">
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
              <Thermometer className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                Peltier Monitor
              </h1>
              <p className="text-gray-600 font-medium">Industrial Temperature Control System</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Badge variant={connectionStatus.connected ? "success" : connectionStatus.mockMode ? "warning" : "destructive"}>
              {connectionStatus.connected ? (
                <>
                  <Wifi className="h-3 w-3 mr-1" />
                  Connected
                </>
              ) : connectionStatus.mockMode ? (
                <>
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Mock Mode
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 mr-1" />
                  Disconnected
                </>
              )}
            </Badge>
            
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            
            <Button variant="outline" size="sm" onClick={onOpenSettings}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>

        {/* Current Temperature Display */}
        <Card className="temperature-display animate-fade-in-up">
          <div className="content">
            <div className="flex items-center justify-center mb-6">
              <div className="relative">
                <Thermometer className="h-16 w-16 text-blue-500 animate-float" />
                <div className="absolute -top-1 -right-1">
                  {getTrendIcon()}
                </div>
              </div>
            </div>
            
            <div className={`temperature-value ${getTemperatureClass(currentTemp)}`}>
              {safeToFixed(currentTemp, 1)}°C
            </div>
            
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-center gap-8">
                <div className="flex items-center gap-3">
                  <Target className="h-5 w-5 text-green-500" />
                  <span className="text-gray-700 font-medium">
                    Target: <span className="font-bold text-green-600">{safeToFixed(targetTemp, 1)}°C</span>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-blue-500" />
                  <span className="text-gray-700 font-medium">
                    Deviation: <span className={`font-bold ${Math.abs(currentTemp - targetTemp) <= 0.5 ? 'text-green-600' : Math.abs(currentTemp - targetTemp) <= 1.5 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {safeToFixed(Math.abs(currentTemp - targetTemp), 1)}°C
                    </span>
                  </span>
                </div>
              </div>
              
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-700">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                  <span className="text-sm font-medium">
                    Last updated: {lastUpdate.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Peltier Controls */}
          <div className="space-y-6">
            <Card className="animate-fade-in-up">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="h-5 w-5 mr-2 text-yellow-500" />
                  Peltier Control
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[1, 2].map(peltierId => (
                  <div key={peltierId} className="group p-4 rounded-xl border-2 border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${peltierStates[peltierId] ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                          <Power className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">Peltier {peltierId}</p>
                          <p className={`text-sm font-medium ${peltierStates[peltierId] ? 'text-green-600' : 'text-gray-500'}`}>
                            {peltierStates[peltierId] ? 'Active' : 'Inactive'}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={peltierStates[peltierId]}
                        onCheckedChange={() => handlePeltierToggle(peltierId)}
                      />
                    </div>
                    
                    {peltierStates[peltierId] && (
                      <div className="mt-3 p-2 rounded-lg bg-green-50">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-green-700 font-medium">Status</span>
                          <span className="text-green-600 font-semibold">Cooling</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* System Status */}
            {/* RBF Adaptive PID Controller Card */}
            <Card className="animate-fade-in-up border-2 border-green-200 bg-gradient-to-br from-emerald-50 to-teal-50">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white mr-3">
                    <Activity className="h-5 w-5" />
                  </div>
                  RBF Adaptive PID Controller
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-white border">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${rbfController.enabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                      <Zap className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">Adaptive Control</p>
                      <p className={`text-sm font-medium ${rbfController.enabled ? 'text-green-600' : 'text-gray-500'}`}>
                        {rbfController.enabled ? 'Learning & Optimizing' : 'Disabled'}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={rbfController.enabled}
                    onCheckedChange={toggleRBFControl}
                  />
                </div>

                {rbfController.enabled && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200">
                      <div className="text-sm font-medium text-gray-700 mb-2">Adaptive PID Gains</div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center">
                          <div className="text-xs text-gray-500">Kp</div>
                          <div className="font-bold text-emerald-600">{safeToFixed(rbfController.gains?.kp || 0, 2)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500">Ki</div>
                          <div className="font-bold text-emerald-600">{safeToFixed(rbfController.gains?.ki || 0, 2)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500">Kd</div>
                          <div className="font-bold text-emerald-600">{safeToFixed(rbfController.gains?.kd || 0, 2)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-2 bg-white rounded-lg border">
                        <div className="text-xs text-gray-500">Control Error</div>
                        <div className={`font-bold ${rbfController.error < 0.5 ? 'text-green-600' : rbfController.error < 1.0 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {safeToFixed(rbfController.error, 2)}°C
                        </div>
                      </div>
                      <div className="text-center p-2 bg-white rounded-lg border">
                        <div className="text-xs text-gray-500">Status</div>
                        <div className={`font-bold ${rbfController.stable ? 'text-green-600' : 'text-teal-600'}`}>
                          {rbfController.stable ? 'Stable' : 'Adapting'}
                        </div>
                      </div>
                    </div>
                    
                    {rbfController.pid && (
                      <div className="p-2 bg-white rounded-lg border">
                        <div className="text-xs text-gray-500 mb-1">PID Components</div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>P: {safeToFixed(rbfController.pid.P, 1)}</div>
                          <div>I: {safeToFixed(rbfController.pid.I, 1)}</div>
                          <div>D: {safeToFixed(rbfController.pid.D, 1)}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="animate-fade-in-up">
              <CardHeader>
                <CardTitle>System Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Connection:</span>
                    <Badge variant={connectionStatus.connected ? "success" : "warning"}>
                      {connectionStatus.connected ? "PLC" : connectionStatus.mockMode ? "Mock" : "Offline"}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Data Points:</span>
                    <span className="font-semibold">{temperatureHistory.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Polling:</span>
                    <Badge variant="success">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-2"></div>
                      Active
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Temperature Trend:</span>
                    <div className="flex items-center gap-1">
                      {getTrendIcon()}
                      <span className="text-sm font-medium capitalize">{tempTrend}</span>
                    </div>
                  </div>
                </div>
                
                {!connectionStatus.connected && (
                  <Button 
                    onClick={handleConnect} 
                    disabled={isLoading}
                    className="w-full mt-4"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      'Reconnect'
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Temperature Chart */}
          <div className="lg:col-span-3">
            <Card className="animate-fade-in-up">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Temperature History</span>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    Live Data
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-96">
                  {temperatureHistory.length > 0 ? (
                    <Line data={chartData} options={chartOptions} />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="animate-pulse">
                          <Thermometer className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                        </div>
                        <p className="text-gray-500 font-medium">Waiting for temperature data...</p>
                        <p className="text-sm text-gray-400 mt-2">Connect to PLC to view live readings</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EnhancedTemperatureMonitor