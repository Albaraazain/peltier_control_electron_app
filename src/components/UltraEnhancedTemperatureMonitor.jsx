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
  Minus,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Clock,
  Calendar,
  AlertCircle
} from 'lucide-react'
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

const UltraEnhancedTemperatureMonitor = ({ onOpenSettings }) => {
  const chartRef = useRef(null)
  const [currentTemp, setCurrentTemp] = useState(22.4)
  const [temperatureHistory, setTemperatureHistory] = useState([])
  const [connectionStatus, setConnectionStatus] = useState({ connected: true, mockMode: false })
  const [peltierStates, setPeltierStates] = useState({ 1: true, 2: true })
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [tempTrend, setTempTrend] = useState('stable')
  const [timeRange, setTimeRange] = useState('live') // 'live', '1h', '6h', '24h'
  const [showAlerts, setShowAlerts] = useState(true)
  const [minTemp, setMinTemp] = useState(null)
  const [maxTemp, setMaxTemp] = useState(null)
  const [avgTemp, setAvgTemp] = useState(null)
  
  const maxDataPoints = 200
  const targetTemp = 5.0
  const warningThreshold = 1.5
  const criticalThreshold = 3.0

  // Enhanced temperature classification with more granular levels
  const getTemperatureClass = (temp) => {
    const diff = Math.abs(temp - targetTemp)
    if (diff <= 0.3) return 'temperature-excellent'
    if (diff <= 0.7) return 'temperature-good'
    if (diff <= 1.5) return 'temperature-warning'
    if (diff <= 3.0) return 'temperature-danger'
    return 'temperature-critical'
  }

  const getTemperatureColor = (temp) => {
    const diff = Math.abs(temp - targetTemp)
    if (diff <= 0.3) return '#10b981' // green-500
    if (diff <= 0.7) return '#34d399' // green-400
    if (diff <= 1.5) return '#fbbf24' // yellow-400
    if (diff <= 3.0) return '#f87171' // red-400
    return '#dc2626' // red-600
  }

  const getTrendIcon = () => {
    switch (tempTrend) {
      case 'rising-fast': return <TrendingUp className="h-4 w-4 text-red-600" />
      case 'rising': return <TrendingUp className="h-4 w-4 text-red-400" />
      case 'falling': return <TrendingDown className="h-4 w-4 text-blue-400" />
      case 'falling-fast': return <TrendingDown className="h-4 w-4 text-blue-600" />
      default: return <Minus className="h-4 w-4 text-gray-400" />
    }
  }

  // Calculate statistics
  useEffect(() => {
    if (temperatureHistory.length > 0) {
      const temps = temperatureHistory.map(r => r.temperature)
      setMinTemp(Math.min(...temps))
      setMaxTemp(Math.max(...temps))
      setAvgTemp(temps.reduce((a, b) => a + b, 0) / temps.length)
    }
  }, [temperatureHistory])

  // Create gradient for the chart
  const createGradient = (ctx, area) => {
    const gradient = ctx.createLinearGradient(0, area.bottom, 0, area.top)
    
    // Dynamic gradient based on temperature
    if (Math.abs(currentTemp - targetTemp) <= warningThreshold) {
      gradient.addColorStop(0, 'rgba(59, 130, 246, 0.01)')
      gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.1)')
      gradient.addColorStop(1, 'rgba(59, 130, 246, 0.3)')
    } else if (Math.abs(currentTemp - targetTemp) <= criticalThreshold) {
      gradient.addColorStop(0, 'rgba(251, 191, 36, 0.01)')
      gradient.addColorStop(0.5, 'rgba(251, 191, 36, 0.1)')
      gradient.addColorStop(1, 'rgba(251, 191, 36, 0.3)')
    } else {
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0.01)')
      gradient.addColorStop(0.5, 'rgba(239, 68, 68, 0.1)')
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0.3)')
    }
    
    return gradient
  }

  // Enhanced chart data configuration
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
        borderColor: (context) => {
          const chart = context.chart
          const {ctx} = chart
          const gradient = ctx.createLinearGradient(0, 0, chart.width, 0)
          gradient.addColorStop(0, '#3b82f6')
          gradient.addColorStop(0.5, '#8b5cf6')
          gradient.addColorStop(1, '#ec4899')
          return gradient
        },
        backgroundColor: (context) => {
          const chart = context.chart
          const {ctx, chartArea} = chart
          if (!chartArea) return null
          return createGradient(ctx, chartArea)
        },
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 8,
        pointHoverBackgroundColor: (context) => {
          const value = context.parsed.y
          return getTemperatureColor(value)
        },
        pointHoverBorderColor: 'white',
        pointHoverBorderWidth: 3,
        cubicInterpolationMode: 'monotone',
      },
      {
        label: 'Target',
        data: Array(temperatureHistory.length).fill(targetTemp),
        borderColor: '#10b981',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [10, 5],
        pointRadius: 0,
        pointHoverRadius: 0,
      },
      {
        label: 'Warning Zone',
        data: Array(temperatureHistory.length).fill(targetTemp + warningThreshold),
        borderColor: 'rgba(251, 191, 36, 0.3)',
        backgroundColor: 'rgba(251, 191, 36, 0.05)',
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: '+1',
      },
      {
        label: 'Warning Zone',
        data: Array(temperatureHistory.length).fill(targetTemp - warningThreshold),
        borderColor: 'rgba(251, 191, 36, 0.3)',
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        pointHoverRadius: 0,
        showLine: true,
      }
    ]
  }

  // Enhanced chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          padding: 15,
          font: {
            family: 'Inter',
            size: 11,
            weight: '500'
          },
          filter: (item) => {
            return item.text !== 'Warning Zone' || item.datasetIndex === 2
          }
        }
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        titleColor: '#f3f4f6',
        bodyColor: '#f3f4f6',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 12,
        padding: 12,
        displayColors: true,
        titleFont: {
          size: 13,
          weight: 'bold'
        },
        bodyFont: {
          size: 12
        },
        callbacks: {
          title: (context) => {
            const date = new Date()
            const time = context[0].label
            return `${date.toLocaleDateString()} ${time}`
          },
          label: (context) => {
            if (context.datasetIndex === 0) {
              const temp = context.parsed.y
              const diff = Math.abs(temp - targetTemp)
              const status = diff <= 0.3 ? '✅ Excellent' : 
                          diff <= 0.7 ? '✓ Good' :
                          diff <= 1.5 ? '⚠️ Warning' :
                          diff <= 3.0 ? '⚠️ High' : '🚨 Critical'
              return [
                `Temperature: ${safeToFixed(temp, 2)}°C`,
                `Deviation: ${safeToFixed(diff, 2)}°C`,
                `Status: ${status}`
              ]
            }
            return `${context.dataset.label}: ${safeToFixed(context.parsed.y, 1)}°C`
          },
          afterLabel: (context) => {
            if (context.datasetIndex === 0 && tempTrend !== 'stable') {
              return `Trend: ${tempTrend.replace('-', ' ')}`
            }
          }
        }
      },
      zoom: {
        zoom: {
          wheel: {
            enabled: true,
            speed: 0.1,
          },
          pinch: {
            enabled: true
          },
          mode: 'x',
        },
        pan: {
          enabled: true,
          mode: 'x',
        },
        limits: {
          x: {min: 'original', max: 'original'},
        },
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        min: Math.min(targetTemp - 4, minTemp ? minTemp - 1 : targetTemp - 4),
        max: Math.max(targetTemp + 4, maxTemp ? maxTemp + 1 : targetTemp + 4),
        grid: {
          color: (context) => {
            if (context.tick.value === targetTemp) return 'rgba(16, 185, 129, 0.3)'
            if (Math.abs(context.tick.value - targetTemp) === warningThreshold) return 'rgba(251, 191, 36, 0.2)'
            return 'rgba(0, 0, 0, 0.05)'
          },
          lineWidth: (context) => {
            if (context.tick.value === targetTemp) return 2
            return 1
          },
        },
        ticks: {
          font: {
            family: 'Inter',
            size: 11
          },
          callback: (value) => `${safeToFixed(value, 1)}°C`,
          color: (context) => {
            const diff = Math.abs(context.tick.value - targetTemp)
            if (diff <= 0.5) return '#10b981'
            if (diff <= warningThreshold) return '#6b7280'
            return '#ef4444'
          }
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
          color: 'rgba(0, 0, 0, 0.03)',
          lineWidth: 1,
        },
        ticks: {
          font: {
            family: 'Inter',
            size: 10
          },
          maxTicksLimit: 10,
          maxRotation: 0
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
    animation: {
      duration: 1000,
      easing: 'easeInOutCubic',
    },
    transitions: {
      zoom: {
        animation: {
          duration: 300,
          easing: 'easeOutCubic'
        }
      }
    }
  }

  // Chart control functions
  const resetZoom = () => {
    if (chartRef.current) {
      chartRef.current.resetZoom()
    }
  }

  const zoomIn = () => {
    if (chartRef.current) {
      chartRef.current.zoom(1.1)
    }
  }

  const zoomOut = () => {
    if (chartRef.current) {
      chartRef.current.zoom(0.9)
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

  // Electron API integration
  useEffect(() => {
    if (!window.electronAPI) return

    const unsubscribeTemp = window.electronAPI.onTemperatureUpdate((_event, data) => {
      const prevTemp = currentTemp
      setCurrentTemp(data.temperature)
      setLastUpdate(new Date(data.timestamp))
      
      // Enhanced trend calculation
      const diff = data.temperature - prevTemp
      if (diff > 0.3) setTempTrend('rising-fast')
      else if (diff > 0.1) setTempTrend('rising')
      else if (diff < -0.3) setTempTrend('falling-fast')
      else if (diff < -0.1) setTempTrend('falling')
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

  // Alert component
  const TemperatureAlert = () => {
    const diff = Math.abs(currentTemp - targetTemp)
    if (!showAlerts || diff <= warningThreshold) return null

    return (
      <div className={`animate-fade-in-up mb-6 p-4 rounded-xl border-2 flex items-center gap-3 ${
        diff <= criticalThreshold 
          ? 'bg-yellow-50 border-yellow-300 text-yellow-800' 
          : 'bg-red-50 border-red-300 text-red-800'
      }`}>
        <AlertCircle className="h-5 w-5 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-semibold">
            {diff <= criticalThreshold ? 'Temperature Warning' : 'Temperature Critical'}
          </p>
          <p className="text-sm opacity-90">
            Current temperature is {safeToFixed(diff, 1)}°C from target. 
            {peltierStates[1] && peltierStates[2] ? ' All Peltiers are active.' : ' Check Peltier status.'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAlerts(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          Dismiss
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between animate-fade-in-up">
          <div className="flex items-center space-x-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 text-white shadow-lg">
              <Thermometer className="h-10 w-10" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                Peltier Monitor Ultra
              </h1>
              <p className="text-gray-600 font-medium">Advanced Temperature Control System</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Badge 
              variant={connectionStatus.connected ? "success" : connectionStatus.mockMode ? "warning" : "destructive"}
              className="px-4 py-2"
            >
              {connectionStatus.connected ? (
                <>
                  <Wifi className="h-3 w-3 mr-2" />
                  PLC Connected
                </>
              ) : connectionStatus.mockMode ? (
                <>
                  <AlertTriangle className="h-3 w-3 mr-2" />
                  Mock Mode
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 mr-2" />
                  Disconnected
                </>
              )}
            </Badge>
            
            <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            
            <Button variant="outline" size="sm" onClick={onOpenSettings} className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </div>
        </div>

        {/* Temperature Alert */}
        <TemperatureAlert />

        {/* Current Temperature Display */}
        <Card className={`overflow-hidden animate-fade-in-up border-2 ${
          Math.abs(currentTemp - targetTemp) <= 0.5 ? 'border-green-200' :
          Math.abs(currentTemp - targetTemp) <= warningThreshold ? 'border-yellow-200' :
          'border-red-200'
        }`}>
          <div className="p-8 bg-gradient-to-br from-white to-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-6 mb-6">
                  <div className="relative">
                    <div className={`p-6 rounded-full bg-gradient-to-br ${
                      Math.abs(currentTemp - targetTemp) <= 0.5 ? 'from-green-400 to-green-600' :
                      Math.abs(currentTemp - targetTemp) <= warningThreshold ? 'from-yellow-400 to-yellow-600' :
                      'from-red-400 to-red-600'
                    } text-white shadow-xl`}>
                      <Thermometer className="h-20 w-20" />
                    </div>
                    <div className="absolute -top-1 -right-1 bg-white rounded-full p-2 shadow-lg">
                      {getTrendIcon()}
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-gray-500 text-sm font-medium mb-2">Current Temperature</p>
                    <div className={`text-6xl font-bold ${getTemperatureClass(currentTemp)}`}>
                      {safeToFixed(currentTemp, 1)}°C
                    </div>
                    <div className="flex items-center gap-4 mt-3">
                      <Badge variant="outline" className="gap-2">
                        <Target className="h-3 w-3" />
                        Target: {targetTemp}°C
                      </Badge>
                      <Badge 
                        variant={Math.abs(currentTemp - targetTemp) <= 0.5 ? "success" : 
                                Math.abs(currentTemp - targetTemp) <= warningThreshold ? "warning" : "destructive"}
                        className="gap-2"
                      >
                        <Activity className="h-3 w-3" />
                        Δ {safeToFixed(Math.abs(currentTemp - targetTemp), 2)}°C
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className="bg-blue-50 rounded-xl p-4">
                    <p className="text-blue-600 text-sm font-medium">Min Temperature</p>
                    <p className="text-2xl font-bold text-blue-700">
                      {minTemp !== null ? `${safeToFixed(minTemp, 1)}°C` : '--'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-gray-600 text-sm font-medium">Average</p>
                    <p className="text-2xl font-bold text-gray-700">
                      {avgTemp !== null ? `${safeToFixed(avgTemp, 1)}°C` : '--'}
                    </p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-4">
                    <p className="text-red-600 text-sm font-medium">Max Temperature</p>
                    <p className="text-2xl font-bold text-red-700">
                      {maxTemp !== null ? `${safeToFixed(maxTemp, 1)}°C` : '--'}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="ml-8 space-y-4">
                <div className="text-center p-4 bg-gray-50 rounded-xl">
                  <Clock className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-500">Last Update</p>
                  <p className="font-semibold text-gray-700">{lastUpdate.toLocaleTimeString()}</p>
                </div>
                
                <div className="text-center p-4 bg-blue-50 rounded-xl">
                  <div className="w-3 h-3 rounded-full bg-blue-500 mx-auto mb-2 animate-pulse"></div>
                  <p className="text-sm text-blue-600 font-medium">Live Monitoring</p>
                  <p className="text-xs text-blue-500">{temperatureHistory.length} data points</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Peltier Controls */}
          <div className="space-y-6">
            <Card className="animate-fade-in-up">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  Peltier Control
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[1, 2].map(peltierId => (
                  <div key={peltierId} className="group p-4 rounded-xl border-2 border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className={`p-3 rounded-xl ${
                          peltierStates[peltierId] 
                            ? 'bg-gradient-to-br from-green-400 to-green-600 text-white' 
                            : 'bg-gray-100 text-gray-400'
                        } transition-all duration-300`}>
                          <Power className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">Peltier {peltierId}</p>
                          <p className={`text-sm font-medium ${
                            peltierStates[peltierId] ? 'text-green-600' : 'text-gray-500'
                          }`}>
                            {peltierStates[peltierId] ? 'Active' : 'Inactive'}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={peltierStates[peltierId]}
                        onCheckedChange={() => handlePeltierToggle(peltierId)}
                        className="scale-110"
                      />
                    </div>
                    
                    {peltierStates[peltierId] && (
                      <div className="mt-3 p-3 rounded-lg bg-gradient-to-r from-green-50 to-blue-50">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 font-medium">Status</span>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-green-600 font-semibold">Cooling</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* System Status */}
            <Card className="animate-fade-in-up">
              <CardHeader>
                <CardTitle>System Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-lg transition-colors">
                    <span className="text-gray-600">Connection:</span>
                    <Badge variant={connectionStatus.connected ? "success" : "warning"}>
                      {connectionStatus.connected ? "PLC Active" : connectionStatus.mockMode ? "Mock Data" : "Offline"}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-lg transition-colors">
                    <span className="text-gray-600">Data Points:</span>
                    <span className="font-semibold">{temperatureHistory.length}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-lg transition-colors">
                    <span className="text-gray-600">Polling Rate:</span>
                    <Badge variant="success">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-2"></div>
                      1 Hz
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-lg transition-colors">
                    <span className="text-gray-600">Trend:</span>
                    <div className="flex items-center gap-2">
                      {getTrendIcon()}
                      <span className="text-sm font-medium capitalize">{tempTrend.replace('-', ' ')}</span>
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
                      'Reconnect to PLC'
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
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-500" />
                    Temperature History
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={exportData} className="gap-2">
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                      <Button variant="ghost" size="sm" onClick={zoomOut} className="p-2">
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={resetZoom} className="p-2">
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={zoomIn} className="p-2">
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[500px]">
                  {temperatureHistory.length > 0 ? (
                    <Line ref={chartRef} data={chartData} options={chartOptions} />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="h-32 w-32 bg-blue-100 rounded-full animate-ping"></div>
                          </div>
                          <div className="relative bg-white rounded-full p-8 shadow-lg">
                            <Thermometer className="h-16 w-16 mx-auto text-blue-500" />
                          </div>
                        </div>
                        <p className="text-gray-600 font-semibold mt-6 text-lg">Initializing Temperature Monitor</p>
                        <p className="text-gray-400 mt-2">Connecting to PLC system...</p>
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

export default UltraEnhancedTemperatureMonitor