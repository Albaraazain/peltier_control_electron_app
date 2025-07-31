import React, { useState, useEffect } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Switch } from './ui/switch'
import { Badge } from './ui/badge'
import { 
  Thermometer, 
  Settings, 
  Wifi, 
  WifiOff, 
  AlertTriangle,
  RefreshCw
} from 'lucide-react'
import { safeToFixed } from '../lib/utils'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

const MinimalTemperatureMonitor = ({ onOpenSettings }) => {
  const [currentTemp, setCurrentTemp] = useState(22.4)
  const [temperatureHistory, setTemperatureHistory] = useState([])
  const [connectionStatus, setConnectionStatus] = useState({ connected: true, mockMode: false })
  const [peltierStates, setPeltierStates] = useState({ 1: true, 2: true })
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const maxDataPoints = 100
  const targetTemp = 5.0

  // Temperature classification
  const getTemperatureClass = (temp) => {
    const diff = Math.abs(temp - targetTemp)
    if (diff <= 0.5) return 'temperature-good'
    if (diff <= 1.5) return 'temperature-warning'
    return 'temperature-danger'
  }

  // Chart configuration - minimal and clean
  const chartData = {
    labels: temperatureHistory.map(reading => 
      new Date(reading.timestamp).toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    ),
    datasets: [
      {
        label: 'Temperature',
        data: temperatureHistory.map(reading => reading.temperature),
        borderColor: '#2563eb',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: '#2563eb',
        tension: 0.1,
      },
      {
        label: 'Target',
        data: Array(temperatureHistory.length).fill(targetTemp),
        borderColor: '#10b981',
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderDash: [4, 4],
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
        backgroundColor: '#ffffff',
        titleColor: '#374151',
        bodyColor: '#374151',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        cornerRadius: 4,
        displayColors: false,
        callbacks: {
          title: (context) => `${context[0].label}`,
          label: (context) => {
            if (context.datasetIndex === 0) {
              return `${safeToFixed(context.parsed.y, 1)}°C`
            }
            return null
          }
        }
      }
    },
    scales: {
      y: {
        display: false,
        min: Math.min(targetTemp - 2, Math.min(...temperatureHistory.map(r => r.temperature), currentTemp) - 1),
        max: Math.max(targetTemp + 2, Math.max(...temperatureHistory.map(r => r.temperature), currentTemp) + 1),
      },
      x: {
        display: false,
      }
    },
    interaction: {
      intersect: false,
      mode: 'index',
    },
    animation: {
      duration: 300,
    }
  }

  // Electron API integration
  useEffect(() => {
    if (!window.electronAPI) return

    const unsubscribeTemp = window.electronAPI.onTemperatureUpdate((_event, data) => {
      setCurrentTemp(data.temperature)
      setLastUpdate(new Date(data.timestamp))
      
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
  }, [])

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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <Thermometer className="h-6 w-6 text-gray-600" />
            <h1 className="text-2xl font-medium text-gray-900">Peltier Monitor</h1>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className={`status-dot ${connectionStatus.connected ? 'status-online' : connectionStatus.mockMode ? 'status-warning' : 'status-offline'}`}></div>
              <span className="text-sm text-gray-600">
                {connectionStatus.connected ? 'Connected' : connectionStatus.mockMode ? 'Mock' : 'Offline'}
              </span>
            </div>
            
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            
            <Button variant="outline" size="sm" onClick={onOpenSettings}>
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Temperature Display */}
          <div className="lg:col-span-2">
            <div className="temperature-display mb-6">
              <div className="text-sm font-medium text-gray-500 mb-2">Current Temperature</div>
              <div className={`temperature-value ${getTemperatureClass(currentTemp)}`}>
                {safeToFixed(currentTemp, 1)}°C
              </div>
              <div className="text-sm text-gray-500">
                Target: {safeToFixed(targetTemp, 1)}°C • Deviation: {safeToFixed(Math.abs(currentTemp - targetTemp), 1)}°C
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Updated {lastUpdate.toLocaleTimeString()}
              </div>
            </div>

            {/* Chart */}
            <div className="chart-container">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">History</h3>
                <div className="flex items-center space-x-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-0.5 bg-blue-600"></div>
                    <span className="text-gray-600">Temperature</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-0.5 border-t border-dashed border-green-600"></div>
                    <span className="text-gray-600">Target</span>
                  </div>
                </div>
              </div>
              
              <div className="h-80">
                {temperatureHistory.length > 0 ? (
                  <Line data={chartData} options={chartOptions} />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <div className="text-center">
                      <Thermometer className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Waiting for data...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-6">
            {/* Peltier Controls */}
            <Card>
              <CardHeader>
                <CardTitle>Peltier Control</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1, 2].map(peltierId => (
                    <div key={peltierId} className={`peltier-card ${peltierStates[peltierId] ? 'active' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">Peltier {peltierId}</div>
                          <div className="text-sm text-gray-500">
                            {peltierStates[peltierId] ? 'Active' : 'Inactive'}
                          </div>
                        </div>
                        <Switch
                          checked={peltierStates[peltierId]}
                          onCheckedChange={() => handlePeltierToggle(peltierId)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* System Info */}
            <Card>
              <CardHeader>
                <CardTitle>System</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Status</span>
                    <Badge variant={connectionStatus.connected ? "success" : "warning"}>
                      {connectionStatus.connected ? "Online" : "Mock"}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Data Points</span>
                    <span className="text-sm font-medium">{temperatureHistory.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Update Rate</span>
                    <span className="text-sm font-medium">2s</span>
                  </div>
                </div>
                
                {!connectionStatus.connected && (
                  <Button 
                    onClick={handleConnect} 
                    disabled={isLoading}
                    className="w-full mt-4"
                  >
                    {isLoading ? 'Connecting...' : 'Reconnect'}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MinimalTemperatureMonitor