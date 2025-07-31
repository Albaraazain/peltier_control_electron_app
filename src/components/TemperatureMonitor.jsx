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
  Power
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

const TemperatureMonitor = ({ onOpenSettings }) => {
  const [currentTemp, setCurrentTemp] = useState(5.0)
  const [temperatureHistory, setTemperatureHistory] = useState([])
  const [connectionStatus, setConnectionStatus] = useState({ connected: false, mockMode: true })
  const [peltierStates, setPeltierStates] = useState({ 1: false, 2: false })
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const maxDataPoints = 100
  const targetTemp = 5.0

  // Temperature color coding
  const getTemperatureColor = (temp) => {
    const diff = Math.abs(temp - targetTemp)
    if (diff <= 0.5) return 'text-green-600'
    if (diff <= 1.0) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getTemperatureBgColor = (temp) => {
    const diff = Math.abs(temp - targetTemp)
    if (diff <= 0.5) return 'bg-green-50 border-green-200'
    if (diff <= 1.0) return 'bg-yellow-50 border-yellow-200'
    return 'bg-red-50 border-red-200'
  }

  // Chart configuration
  const chartData = {
    labels: temperatureHistory.map(reading => 
      new Date(reading.timestamp).toLocaleTimeString()
    ),
    datasets: [
      {
        label: 'Temperature (°C)',
        data: temperatureHistory.map(reading => reading.temperature),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 4,
      },
      {
        label: 'Target Temperature',
        data: Array(temperatureHistory.length).fill(targetTemp),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [5, 5],
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
        position: 'top',
      },
      title: {
        display: true,
        text: 'Temperature History'
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        min: targetTemp - 3,
        max: targetTemp + 3,
        title: {
          display: true,
          text: 'Temperature (°C)'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Time'
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index',
    }
  }

  // Electron API integration
  useEffect(() => {
    if (!window.electronAPI) return

    // Listen for temperature updates
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

    // Listen for connection status changes
    const unsubscribeConnection = window.electronAPI.onConnectionStatusChange((_event, status) => {
      setConnectionStatus(status)
    })

    // Listen for Peltier status changes
    const unsubscribePeltier = window.electronAPI.onPeltierStatusChange((_event, status) => {
      setPeltierStates(prev => ({
        ...prev,
        [status.peltierId]: status.state
      }))
    })

    // Initial connection attempt
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
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Thermometer className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Peltier Monitor</h1>
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
        <Card className={`${getTemperatureBgColor(currentTemp)} transition-colors duration-300`}>
          <CardHeader className="text-center">
            <CardTitle className="text-6xl font-bold">
              <span className={getTemperatureColor(currentTemp)}>
                {safeToFixed(currentTemp, 1)}°C
              </span>
            </CardTitle>
            <p className="text-lg text-muted-foreground">
              Target: {safeToFixed(targetTemp, 1)}°C | 
              Deviation: {safeToFixed(Math.abs(currentTemp - targetTemp), 1)}°C
            </p>
            <p className="text-sm text-muted-foreground">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </p>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Peltier Controls */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="h-5 w-5 mr-2" />
                  Peltier Control
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[1, 2].map(peltierId => (
                  <div key={peltierId} className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center space-x-3">
                      <Power className={`h-5 w-5 ${peltierStates[peltierId] ? 'text-green-600' : 'text-gray-400'}`} />
                      <div>
                        <p className="font-medium">Peltier {peltierId}</p>
                        <p className="text-sm text-muted-foreground">
                          {peltierStates[peltierId] ? 'Active' : 'Inactive'}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={peltierStates[peltierId]}
                      onCheckedChange={() => handlePeltierToggle(peltierId)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* System Status */}
            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span>Connection:</span>
                  <Badge variant={connectionStatus.connected ? "success" : "warning"}>
                    {connectionStatus.connected ? "PLC" : connectionStatus.mockMode ? "Mock" : "Offline"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Data Points:</span>
                  <span>{temperatureHistory.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Polling:</span>
                  <Badge variant="success">Active</Badge>
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
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Temperature History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-96">
                  {temperatureHistory.length > 0 ? (
                    <Line data={chartData} options={chartOptions} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <Thermometer className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Waiting for temperature data...</p>
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

export default TemperatureMonitor